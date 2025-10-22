document.addEventListener('DOMContentLoaded', () => {

    // --- 1. ESTADO E BANCO DE DADOS ---
    let db = []; // Banco de dados mestre do ESTOQUE
    let historyDB = []; // Banco de dados do HISTÓRICO

    const DB_KEY = 'shoppingListDB';
    const HISTORY_DB_KEY = 'shoppingListHistoryDB';

    // --- 2. REFERÊNCIAS DO DOM ---
    const views = {
        stock: document.getElementById('view-stock'),
        list: document.getElementById('view-list'),
        history: document.getElementById('view-history'),
    };
    const navButtons = {
        stock: document.getElementById('nav-stock'),
        list: document.getElementById('nav-list'),
        history: document.getElementById('nav-history'),
    };
    const form = document.getElementById('form-add-item');
    const formInputs = {
        name: document.getElementById('item-name'),
        category: document.getElementById('item-category'),
        min: document.getElementById('item-min'),
        current: document.getElementById('item-current'),
    };
    const stockTableBody = document.getElementById('stock-table-body');
    const shoppingListBody = document.getElementById('shopping-list-body');
    const historyTableBody = document.getElementById('history-table-body');
    const totalCostEl = document.getElementById('total-cost');
    const btnClearHistory = document.getElementById('btn-clear-history');

    // --- 3. LÓGICAS DE CÁLCULO (Conforme Seção 5 e 6) ---

    /**
     * Calcula as propriedades automáticas de um item (Status e Qtd. a Comprar)
     * @param {object} item - O item do banco de dados
     * @returns {object} O item com as propriedades 'status' e 'qtd_a_comprar' atualizadas
     */
    const calculateItemProperties = (item) => {
        const { qtd_minima, qtd_atual } = item;
        
        // Cálculo de Quantidade a Comprar
        item.qtd_a_comprar = Math.max(0, qtd_minima - qtd_atual);

        // Cálculo de Status
        if (qtd_atual > qtd_minima) {
            item.status = 'Suficiente';
        } else if (qtd_atual === qtd_minima) {
            item.status = 'Limite';
        } else if (qtd_atual > 0) {
            item.status = 'Comprar';
        } else {
            item.status = 'Em falta';
        }
        
        return item;
    };

    /**
     * Retorna a classe CSS correspondente ao status
     * @param {string} status - O status (ex: "Em falta")
     * @returns {string} - A classe CSS (ex: "status-em-falta")
     */
    const getStatusClass = (status) => {
        return 'status-' + status.toLowerCase().replace(' ', '-');
    };

    /**
     * Formata um valor numérico para BRL (R$)
     */
    const formatCurrency = (value) => {
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    // --- 4. FUNÇÕES DE RENDERIZAÇÃO ---

    /**
     * Renderiza a tabela principal de Estoque (view-stock)
     */
    const renderStockTable = () => {
        stockTableBody.innerHTML = ''; // Limpa a tabela
        if (db.length === 0) {
            stockTableBody.innerHTML = '<tr><td colspan="7">Seu estoque está vazio. Adicione um item no formulário acima.</td></tr>';
            return;
        }

        db.sort((a, b) => a.nome.localeCompare(b.nome)); // Ordena por nome

        db.forEach(item => {
            calculateItemProperties(item); // Garante que os cálculos estão corretos
            
            const tr = document.createElement('tr');
            tr.className = getStatusClass(item.status);
            tr.dataset.itemId = item.id;

            tr.innerHTML = `
                <td><span class="status-badge">${item.status}</span></td>
                <td>${item.nome}</td>
                <td>${item.categoria}</td>
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
    };

    /**
     * Renderiza a Lista de Compras (view-list)
     */
    const renderShoppingList = () => {
        shoppingListBody.innerHTML = '';
        
        // Filtra apenas itens com status "Comprar" ou "Em falta"
        const itemsToBuy = db.filter(item => item.status === 'Comprar' || item.status === 'Em falta');
        
        if (itemsToBuy.length === 0) {
            shoppingListBody.innerHTML = '<tr><td colspan="6">Sua lista de compras está vazia!</td></tr>';
            totalCostEl.textContent = formatCurrency(0);
            return;
        }
        
        let totalCost = 0;

        itemsToBuy.sort((a, b) => a.categoria.localeCompare(b.categoria)); // Ordena por categoria

        itemsToBuy.forEach(item => {
            const tr = document.createElement('tr');
            tr.className = getStatusClass(item.status);
            tr.dataset.itemId = item.id;
            
            const itemPrice = item.preco_unitario || 0;
            const itemCost = item.qtd_a_comprar * itemPrice;
            totalCost += itemCost;

            tr.innerHTML = `
                <td><span class="status-badge">${item.status}</span></td>
                <td>${item.nome}</td>
                <td>${item.categoria}</td>
                <td>${item.qtd_a_comprar}</td>
                <td>
                    <input type="number" class="input-price" min="0" step="0.01" placeholder="R$ 0,00" value="${itemPrice || ''}">
                </td>
                <td>
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

        // Ordena por data, mais recente primeiro
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

    /**
     * Renderiza todas as seções de uma vez
     */
    const renderAll = () => {
        renderStockTable();
        renderShoppingList();
        renderHistoryTable();
    };

    // --- 5. PERSISTÊNCIA (localStorage) ---

    const saveDB = () => {
        localStorage.setItem(DB_KEY, JSON.stringify(db));
    };
    
    const loadDB = () => {
        db = JSON.parse(localStorage.getItem(DB_KEY)) || [];
    };

    const saveHistoryDB = () => {
        localStorage.setItem(HISTORY_DB_KEY, JSON.stringify(historyDB));
    };

    const loadHistoryDB = () => {
        historyDB = JSON.parse(localStorage.getItem(HISTORY_DB_KEY)) || [];
    };

    // --- 6. MANIPULADORES DE EVENTOS ---

    /**
     * Navegação por Abas
     */
    const handleNavigation = (e) => {
        const targetView = e.target.id.split('-')[1]; // ex: "nav-stock" -> "stock"

        // Oculta todos
        Object.values(views).forEach(view => view.classList.remove('active'));
        Object.values(navButtons).forEach(btn => btn.classList.remove('active'));
        
        // Mostra o alvo
        views[targetView].classList.add('active');
        navButtons[targetView].classList.add('active');

        // Mostra/oculta formulário
        form.style.display = (targetView === 'stock') ? 'block' : 'none';
    };

    /**
     * Adicionar novo item (submit do formulário)
     */
    const handleAddItem = (e) => {
        e.preventDefault();

        const newItem = {
            id: Date.now(), // ID único
            nome: formInputs.name.value.trim(),
            categoria: formInputs.category.value,
            qtd_minima: parseInt(formInputs.min.value),
            qtd_atual: parseInt(formInputs.current.value),
            preco_unitario: 0,
            data_ultima_compra: null,
        };

        db.push(newItem);
        saveDB();
        renderAll();

        form.reset();
        formInputs.name.focus();
    };

    /**
     * Ações na tabela de Estoque (Editar, Excluir)
     */
    const handleStockActions = (e) => {
        const target = e.target;
        if (!target.classList.contains('btn-action')) return;

        const tr = target.closest('tr');
        const itemId = parseInt(tr.dataset.itemId);

        if (target.classList.contains('btn-delete')) {
            if (confirm(`Tem certeza que deseja excluir o item "${db.find(i => i.id === itemId).nome}"?`)) {
                db = db.filter(item => item.id !== itemId);
                saveDB();
                renderAll();
            }
        }

        if (target.classList.contains('btn-edit')) {
            const item = db.find(i => i.id === itemId);
            const newMin = prompt(`Quantidade MÍNIMA para "${item.nome}":`, item.qtd_minima);
            const newCurrent = prompt(`Quantidade ATUAL para "${item.nome}":`, item.qtd_atual);

            if (newMin !== null && newCurrent !== null) {
                item.qtd_minima = parseInt(newMin) || 0;
                item.qtd_atual = parseInt(newCurrent) || 0;
                saveDB();
                renderAll();
            }
        }
    };

    /**
     * Ações na Lista de Compras (Comprar, Atualizar Preço)
     */
    const handleShoppingListActions = (e) => {
        const target = e.target;
        const tr = target.closest('tr');
        if (!tr) return;
        const itemId = parseInt(tr.dataset.itemId);
        const item = db.find(i => i.id === itemId);

        // Ação: Marcar como Comprado
        if (target.classList.contains('btn-buy')) {
            const qtdComprada = item.qtd_a_comprar;
            const preco = parseFloat(tr.querySelector('.input-price').value) || item.preco_unitario || 0;

            if (qtdComprada === 0) {
                alert("Este item não precisa ser comprado.");
                return;
            }

            // 1. Atualiza o estoque
            item.qtd_atual += qtdComprada;
            item.preco_unitario = preco; // Salva o último preço pago
            item.data_ultima_compra = new Date().toISOString();

            // 2. Adiciona ao histórico
            historyDB.push({
                id: Date.now(),
                data: item.data_ultima_compra,
                nome: item.nome,
                qtd_comprada: qtdComprada,
                custo_total: qtdComprada * preco,
            });

            // 3. Salva e renderiza
            saveDB();
            saveHistoryDB();
            renderAll();
        }

        // Ação: Atualizar Preço (ao sair do input)
        if (target.classList.contains('input-price') && e.type === 'change') {
            item.preco_unitario = parseFloat(target.value) || 0;
            saveDB();
            renderAll(); // Recalcula o total
        }
    };

    /**
     * Limpar Histórico
     */
    const handleClearHistory = () => {
        if (confirm("Tem certeza que deseja limpar TODO o histórico de compras? Esta ação não pode ser desfeita.")) {
            historyDB = [];
            saveHistoryDB();
            renderAll();
        }
    };

    // --- 7. INICIALIZAÇÃO E EVENT LISTENERS ---
    
    // Carrega os dados
    loadDB();
    loadHistoryDB();

    // Renderiza pela primeira vez
    renderAll();

    // Navegação
    Object.values(navButtons).forEach(button => {
        button.addEventListener('click', handleNavigation);
    });

    // Formulário
    form.addEventListener('submit', handleAddItem);

    // Listeners das Tabelas
    stockTableBody.addEventListener('click', handleStockActions);
    shoppingListBody.addEventListener('click', handleShoppingListActions);
    shoppingListBody.addEventListener('change', handleShoppingListActions); // Para o input de preço

    // Histórico
    btnClearHistory.addEventListener('click', handleClearHistory);
});