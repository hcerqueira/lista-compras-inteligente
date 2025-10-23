document.addEventListener('DOMContentLoaded', () => {

    // --- 1. ESTADO E BANCO DE DADOS ---
    let db = []; // Banco de dados mestre do ESTOQUE
    let historyDB = []; // Banco de dados do HISTÓRICO
    let isChecklistMode = true; // NOVO: Começa no modo supermercado simples

    const DB_KEY = 'shoppingListDB';
    const HISTORY_DB_KEY = 'shoppingListHistoryDB';

    // Itens sugeridos para o primeiro uso (Onboarding)
    const initialItems = [
        { id: 1, nome: "Arroz (5kg)", categoria: "Mercearia", qtd_minima: 1, qtd_atual: 1, preco_unitario: 25.00, frequencia: "Mensal", qtd_manual: 0, data_ultima_compra: null },
        { id: 2, nome: "Detergente", categoria: "Limpeza", qtd_minima: 3, qtd_atual: 1, preco_unitario: 2.50, frequencia: "Semanal", qtd_manual: 0, data_ultima_compra: null },
        { id: 3, nome: "Leite (L)", categoria: "Laticínios", qtd_minima: 6, qtd_atual: 2, preco_unitario: 5.20, frequencia: "Semanal", qtd_manual: 0, data_ultima_compra: null },
        { id: 4, nome: "Café", categoria: "Mercearia", qtd_minima: 1, qtd_atual: 0, preco_unitario: 15.00, frequencia: "Mensal", qtd_manual: 0, data_ultima_compra: null },
    ];


    // --- 2. REFERÊNCIAS DO DOM ---
    const views = {
        stock: document.getElementById('view-stock'),
        list: document.getElementById('view-list'),
        history: document.getElementById('view-history'),
        settings: document.getElementById('view-settings'),
    };
    const navButtons = {
        stock: document.getElementById('nav-stock'),
        list: document.getElementById('nav-list'),
        history: document.getElementById('nav-history'),
        settings: document.getElementById('nav-settings'),
    };
    const form = document.getElementById('form-add-item');
    const formInputs = {
        name: document.getElementById('item-name'),
        category: document.getElementById('item-category'),
        frequency: document.getElementById('item-frequency'),
        min: document.getElementById('item-min'),
        current: document.getElementById('item-current'),
    };
    const stockTableBody = document.getElementById('stock-table-body');
    const shoppingListBody = document.getElementById('shopping-list-body');
    const historyTableBody = document.getElementById('history-table-body');
    const totalCostEl = document.getElementById('total-cost');
    const btnClearHistory = document.getElementById('btn-clear-history');
    
    // Elementos do Modo Supermercado
    const listTable = document.getElementById('list-table');
    const btnSwitchMode = document.getElementById('btn-switch-mode');
    const btnCompletePurchase = document.getElementById('btn-complete-purchase');

    // Elementos de Backup
    const btnExportData = document.getElementById('btn-export-data');
    const inputImportData = document.getElementById('input-import-data');
    const btnImportData = document.getElementById('btn-import-data');

    // --- 3. LÓGICAS DE CÁLCULO ---

    const calculateItemProperties = (item) => {
        const { qtd_minima, qtd_atual } = item;
        
        // 1. Cálculo de Necessidade (Qtd. a Comprar)
        item.qtd_a_comprar = Math.max(0, qtd_minima - qtd_atual);

        // 2. Qtd. Manual (usa a Qtd. a Comprar se for 0 ou se for menor que a necessidade)
        if (!item.qtd_manual || item.qtd_manual < item.qtd_a_comprar) {
            item.qtd_manual = item.qtd_a_comprar;
        }

        // 3. Cálculo de Status
        if (qtd_atual > qtd_minima) {
            item.status = 'Suficiente';
        } else if (qtd_atual === qtd_minima) {
            item.status = 'Limite';
        } else if (qtd_atual > 0) {
            item.status = 'Comprar';
        } else {
            item.status = 'Em falta';
        }
        
        // 4. Estado temporário para o checklist
        if (typeof item.checked === 'undefined') {
            item.checked = false;
        }

        return item;
    };

    const getStatusClass = (status) => {
        return 'status-' + status.toLowerCase().replace(' ', '-');
    };

    const formatCurrency = (value) => {
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    // --- 4. FUNÇÕES DE RENDERIZAÇÃO ---

    /**
     * Renderiza a tabela principal de Estoque, AGRUPANDO por Categoria
     */
    const renderStockTable = () => {
        stockTableBody.innerHTML = ''; 
        if (db.length === 0) {
            stockTableBody.innerHTML = '<tr><td colspan="7">Seu estoque está vazio. Adicione um item no formulário acima.</td></tr>';
            return;
        }

        const grouped = db.reduce((acc, item) => {
            acc[item.categoria] = acc[item.categoria] || [];
            acc[item.categoria].push(item);
            return acc;
        }, {});

        const sortedCategories = Object.keys(grouped).sort();

        sortedCategories.forEach(category => {
            // Insere o cabeçalho da categoria
            const headerRow = document.createElement('tr');
            headerRow.innerHTML = `<td colspan="7" class="category-header">${category}</td>`;
            stockTableBody.appendChild(headerRow);

            // Ordena os itens dentro da categoria por nome
            grouped[category].sort((a, b) => a.nome.localeCompare(b.nome));

            grouped[category].forEach(item => {
                calculateItemProperties(item);
                
                const tr = document.createElement('tr');
                tr.className = getStatusClass(item.status);
                tr.dataset.itemId = item.id;

                tr.innerHTML = `
                    <td><span class="status-badge">${item.status}</span></td>
                    <td>${item.nome}</td>
                    <td>${item.frequencia}</td>
                    <td>${item.qtd_atual}</td>
                    <td>${item.qtd_minima}</td>
                    <td>${item.qtd_a_comprar}</td>
                    <td>
                        <div class="actions">
                            <button class="btn-action btn-edit" title="Editar">&#9998;</button>
                            <button class="btn-action btn-delete" title="Excluir">&#128465;</button>
                        </div>
                    </td>
                `;
                stockTableBody.appendChild(tr);
            });
        });
    };

    /**
     * Renderiza a Lista de Compras (view-list) com lógica de Modo Supermercado
     */
    const renderShoppingList = () => {
        shoppingListBody.innerHTML = '';
        
        // Aplica a classe para esconder/mostrar colunas
        listTable.classList.toggle('checklist-mode', isChecklistMode);
        
        // Atualiza os botões de controle
        btnCompletePurchase.style.display = isChecklistMode ? 'block' : 'none';
        btnSwitchMode.textContent = isChecklistMode ? '🛠️ Mudar p/ Edição de Preço' : '🛒 Mudar p/ Modo Supermercado';

        const itemsToBuy = db.filter(item => item.status === 'Comprar' || item.status === 'Em falta');
        
        if (itemsToBuy.length === 0) {
            shoppingListBody.innerHTML = '<tr><td colspan="6">Sua lista de compras está vazia!</td></tr>';
            totalCostEl.textContent = formatCurrency(0);
            return;
        }
        
        let totalCost = 0;

        // Ordena por categoria (melhor para o supermercado)
        itemsToBuy.sort((a, b) => a.categoria.localeCompare(b.categoria));

        itemsToBuy.forEach(item => {
            calculateItemProperties(item); 
            
            const tr = document.createElement('tr');
            tr.className = getStatusClass(item.status);
            tr.dataset.itemId = item.id;
            
            const itemPrice = item.preco_unitario || 0;
            // O custo é calculado pela QTD MANUAL, não pela QTD A COMPRAR
            const itemCost = item.qtd_manual * itemPrice; 
            totalCost += itemCost;

            tr.innerHTML = `
                <td>
                    <input type="checkbox" class="list-checkbox" data-item-id="${item.id}" ${item.checked ? 'checked' : ''}>
                </td>
                <td>${item.nome} (${item.categoria})</td>
                <td>${item.qtd_a_comprar}</td>
                <td class="editable-col">
                    <input type="number" class="input-manual-qty" min="0" value="${item.qtd_manual}" ${isChecklistMode ? 'disabled' : ''}>
                </td>
                <td class="editable-col">
                    <input type="number" class="input-price" min="0" step="0.01" placeholder="R$ 0,00" value="${itemPrice || ''}" ${isChecklistMode ? 'disabled' : ''}>
                </td>
                <td class="editable-col">
                    <div class="actions">
                        <button class="btn-action btn-buy" title="Marcar como Comprado">&#10004;</button>
                    </div>
                </td>
            `;
            shoppingListBody.appendChild(tr);
        });

        totalCostEl.textContent = formatCurrency(totalCost);
    };

    /**
     * Renderiza a tabela de Histórico (view-history)
     */
    const renderHistoryTable = () => {
        historyTableBody.innerHTML = '';
        if (historyDB.length === 0) {
            historyTableBody.innerHTML = '<tr><td colspan="4">Nenhum item comprado recentemente.</td></tr>';
            return;
        }

        historyDB.sort((a, b) => new Date(b.data) - new Date(a.data));

        historyDB.forEach(entry => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${new Date(entry.data).toLocaleDateString('pt-BR')}</td>
                <td>${entry.nome}</td>
                <td>${entry.qtd_comprada}</td>
                <td>${formatCurrency(entry.custo_total)}</td>
            `;
            historyTableBody.appendChild(tr);
        });
    };

    const renderAll = () => {
        renderStockTable();
        renderShoppingList();
        renderHistoryTable();
    };

    // --- 5. PERSISTÊNCIA (localStorage) ---

    const saveDB = () => {
        // Remove a propriedade temporária 'checked' antes de salvar o DB mestre
        const cleanDB = db.map(item => {
            const { checked, ...rest } = item;
            return rest;
        });
        localStorage.setItem(DB_KEY, JSON.stringify(cleanDB));
    };
    
    /**
     * Carrega DB, adicionando itens iniciais se estiver vazio
     */
    const loadDB = () => {
        const storedDB = JSON.parse(localStorage.getItem(DB_KEY));
        if (!storedDB || storedDB.length === 0) {
            // Inicializa com itens de Onboarding, garantindo o ID único
            db = initialItems.map(item => ({...item, id: Date.now() + item.id}));
        } else {
            db = storedDB;
        }
    };

    const saveHistoryDB = () => {
        localStorage.setItem(HISTORY_DB_KEY, JSON.stringify(historyDB));
    };

    const loadHistoryDB = () => {
        historyDB = JSON.parse(localStorage.getItem(HISTORY_DB_KEY)) || [];
    };

    // --- 6. FUNCIONALIDADES DE BACKUP E RESTAURAÇÃO (NOVAS) ---
    
    /**
     * Exporta o DB completo (Estoque + Histórico) para um arquivo JSON
     */
    const exportData = () => {
        const data = {
            // Limpa o estado 'checked' antes de exportar
            db: db.map(item => { 
                const { checked, ...rest } = item;
                return rest;
            }),
            historyDB: historyDB
        };
        const dataStr = JSON.stringify(data, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lista_inteligente_backup_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        alert("Backup exportado com sucesso! Guarde o arquivo em local seguro.");
    };

    /**
     * Importa o DB completo de um arquivo JSON
     */
    const importData = (file) => {
        if (!file) return;

        if (!confirm("Tem certeza que deseja importar? Os dados atuais do seu Estoque e Histórico serão PERDIDOS e substituídos.")) {
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                
                if (importedData.db && importedData.historyDB) {
                    db = importedData.db;
                    historyDB = importedData.historyDB;
                    
                    saveDB();
                    saveHistoryDB();
                    
                    alert("Dados importados com sucesso! O aplicativo será recarregado.");
                    location.reload(); // Força o recarregamento para aplicar o novo DB
                } else {
                    alert("Erro: O arquivo JSON não está no formato correto (faltam 'db' ou 'historyDB').");
                }
            } catch (error) {
                console.error("Erro ao importar dados:", error);
                alert("Erro ao ler o arquivo. Certifique-se de que é um arquivo JSON válido de backup.");
            }
        };
        reader.readAsText(file);
    };

    // --- 7. MANIPULADORES DE EVENTOS ---
    
    const handleNavigation = (e) => {
        const targetView = e.target.id.split('-')[1];

        Object.values(views).forEach(view => view.classList.remove('active'));
        Object.values(navButtons).forEach(btn => btn.classList.remove('active'));
        
        views[targetView].classList.add('active');
        navButtons[targetView].classList.add('active');

        form.style.display = (targetView === 'stock') ? 'block' : 'none';
        
        if(targetView === 'list') {
            renderShoppingList(); // Garante que a lista seja renderizada com o modo correto
        }
    };

    const handleAddItem = (e) => {
        e.preventDefault();

        const newItem = {
            id: Date.now(),
            nome: formInputs.name.value.trim(),
            categoria: formInputs.category.value,
            frequencia: formInputs.frequency.value,
            qtd_minima: parseInt(formInputs.min.value),
            qtd_atual: parseInt(formInputs.current.value),
            preco_unitario: 0,
            qtd_manual: 0,
            data_ultima_compra: null,
        };

        db.push(calculateItemProperties(newItem));
        saveDB();
        renderAll();

        form.reset();
        formInputs.name.focus();
    };

    // Ações na tabela de Estoque
    const handleStockActions = (e) => {
        const target = e.target;
        if (!target.classList.contains('btn-action')) return;

        const tr = target.closest('tr');
        const itemId = parseInt(tr.dataset.itemId);
        const item = db.find(i => i.id === itemId);

        if (target.classList.contains('btn-delete')) {
            if (confirm(`Tem certeza que deseja excluir o item "${item.nome}"?`)) {
                db = db.filter(i => i.id !== itemId);
                saveDB();
                renderAll();
            }
        }

        if (target.classList.contains('btn-edit')) {
            const newMin = prompt(`Quantidade MÍNIMA para "${item.nome}":`, item.qtd_minima);
            const newCurrent = prompt(`Quantidade ATUAL para "${item.nome}":`, item.qtd_atual);

            if (newMin !== null && newCurrent !== null) {
                item.qtd_minima = parseInt(newMin) || 0;
                item.qtd_atual = parseInt(newCurrent) || 0;
                item.qtd_manual = item.qtd_a_comprar;
                saveDB();
                renderAll();
            }
        }
    };
    
    /**
     * Função central para finalizar a compra (individual ou massa)
     */
    const completePurchaseItem = (item) => {
        const qtdComprada = item.qtd_manual; 
        const preco = item.preco_unitario || 0;

        if (qtdComprada <= 0) {
            alert(`O item ${item.nome} foi ignorado. A Quantidade Manual precisa ser maior que zero.`);
            return false;
        }

        // 1. Atualiza o estoque
        item.qtd_atual += qtdComprada;
        item.data_ultima_compra = new Date().toISOString();
        item.qtd_manual = 0; // Reseta a quantidade manual após a compra
        item.checked = false; // Reseta o checklist

        // 2. Adiciona ao histórico
        historyDB.push({
            id: Date.now(),
            data: item.data_ultima_compra,
            nome: item.nome,
            qtd_comprada: qtdComprada,
            custo_total: qtdComprada * preco,
        });
        return true;
    };


    /**
     * Ações na Lista de Compras (Comprar Individual, Atualizar Preço, Atualizar Qtd. Manual, Checklist)
     */
    const handleShoppingListActions = (e) => {
        const target = e.target;
        const tr = target.closest('tr');
        if (!tr) return;
        const itemId = parseInt(tr.dataset.itemId);
        const item = db.find(i => i.id === itemId);

        // Ação: Checklist (Toggle Checkbox)
        if (target.classList.contains('list-checkbox')) {
            item.checked = target.checked;
        }

        // Ação: Atualizar Preço ou Qtd Manual (change event)
        if (e.type === 'change' && (target.classList.contains('input-price') || target.classList.contains('input-manual-qty'))) {
            
            if (target.classList.contains('input-price')) {
                item.preco_unitario = parseFloat(target.value) || 0;
            }
            
            if (target.classList.contains('input-manual-qty')) {
                item.qtd_manual = parseInt(target.value) || 0;
                if (item.qtd_manual < 0) item.qtd_manual = 0;
            }
            
            saveDB();
            renderShoppingList();
        }
        
        // Ação: Marcar como Comprado (Individual)
        if (target.classList.contains('btn-buy')) {
            completePurchaseItem(item);
            renderAll();
        }
    };
    
    /**
     * Alterna entre Modo Checklist e Modo Edição de Preço/Qtd
     */
    const handleSwitchMode = () => {
        isChecklistMode = !isChecklistMode;
        renderShoppingList();
    };

    /**
     * Finaliza a compra de todos os itens checados (Compra em Massa)
     */
    const handleCompletePurchase = () => {
        const checkedItems = db.filter(item => item.checked);
        if (checkedItems.length === 0) {
            alert("Nenhum item foi checado. Marque os itens que você colocou no carrinho.");
            return;
        }

        if (!confirm(`Deseja marcar ${checkedItems.length} itens checados como comprados, atualizando o estoque?`)) {
            return;
        }
        
        let successCount = 0;
        checkedItems.forEach(item => {
            if(completePurchaseItem(item)) {
                successCount++;
            }
        });

        // 3. Salva e renderiza tudo
        saveDB();
        saveHistoryDB();
        alert(`${successCount} itens registrados e estoque atualizado!`);
        renderAll();
    };


    const handleClearHistory = () => {
        if (confirm("Tem certeza que deseja limpar TODO o histórico de compras? Esta ação não pode ser desfeita.")) {
            historyDB = [];
            saveHistoryDB();
            renderAll();
        }
    };

    // --- 8. INICIALIZAÇÃO E EVENT LISTENERS ---
    
    loadDB();
    loadHistoryDB();

    renderAll();

    // Navegação
    Object.values(navButtons).forEach(button => {
        button.addEventListener('click', handleNavigation);
    });

    // Formulário (Estoque)
    form.addEventListener('submit', handleAddItem);

    // Listeners das Tabelas (Estoque e Lista)
    stockTableBody.addEventListener('click', handleStockActions);
    shoppingListBody.addEventListener('click', handleShoppingListActions);
    shoppingListBody.addEventListener('change', handleShoppingListActions);

    // Lista de Compras (Modo Supermercado)
    btnSwitchMode.addEventListener('click', handleSwitchMode);
    btnCompletePurchase.addEventListener('click', handleCompletePurchase);

    // Histórico
    btnClearHistory.addEventListener('click', handleClearHistory);

    // Backup e Restauração (Configurações)
    btnExportData.addEventListener('click', exportData);
    btnImportData.addEventListener('click', () => {
        if (inputImportData.files.length > 0) {
            importData(inputImportData.files[0]);
        } else {
            alert("Por favor, selecione um arquivo de backup (.json) para importar.");
        }
    });
});
