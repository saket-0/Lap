document.addEventListener('DOMContentLoaded', () => {

    // --- MOCK DATABASE & AUTH ---
    // (Simulating PostgreSQL tables from the SRS)

    const MOCK_USERS = [
        { id: 'uuid-admin-001', employeeId: 'EMP-20251029-0001', name: 'Dr. Evelyn Reed', email: 'admin@bims.com', role: 'Admin' },
        { id: 'uuid-manager-002', employeeId: 'EMP-20251029-0002', name: 'Marcus Cole', email: 'manager@bims.com', role: 'Inventory Manager' },
        { id: 'uuid-auditor-003', employeeId: 'EMP-20251029-0003', name: 'Anya Sharma', email: 'auditor@bims.com', role: 'Auditor' }
    ];
    
    const DB_KEY = 'bimsChain'; // For the blockchain
    const AUTH_KEY = 'bimsUser'; // For the current user
    const USERS_KEY = 'bimsUsers'; // For the list of users (for Admin panel)

    // --- STATE MANAGEMENT ---
    let blockchain = [];
    let inventory = new Map(); // The "World State"
    let currentUser = null;
    let usersDb = [];

    // --- DOM ELEMENTS ---
    const loginOverlay = document.getElementById('login-overlay');
    const loginForm = document.getElementById('login-form');
    const loginEmailSelect = document.getElementById('login-email');
    const appWrapper = document.getElementById('app-wrapper');
    const appContent = document.getElementById('app-content');
    const logoutButton = document.getElementById('logout-button');
    
    // Nav links
    const navLinks = {
        dashboard: document.getElementById('nav-dashboard'),
        products: document.getElementById('nav-products'),
        admin: document.getElementById('nav-admin'),
        ledger: document.getElementById('nav-ledger'),
    };

    // Toast Elements
    const errorToast = document.getElementById('error-toast');
    const errorMessage = document.getElementById('error-message');
    const successToast = document.getElementById('success-toast');
    const successMessage = document.getElementById('success-message');

    // Templates
    const templates = {
        dashboard: document.getElementById('dashboard-view-template'),
        productList: document.getElementById('product-list-view-template'),
        productDetail: document.getElementById('product-detail-view-template'),
        admin: document.getElementById('admin-view-template'),
        ledger: document.getElementById('ledger-view-template'),
    };

    // --- SERVICES (Simulating Backend Logic) ---

    /**
     * Authentication Service (Mock)
     */
    const authService = {
        init: () => {
            // Populate user select
            MOCK_USERS.forEach(user => {
                const option = document.createElement('option');
                option.value = user.email;
                option.textContent = `${user.name} (${user.role})`;
                loginEmailSelect.appendChild(option);
            });
            
            // Populate users DB (simulates user table)
            if (!localStorage.getItem(USERS_KEY)) {
                localStorage.setItem(USERS_KEY, JSON.stringify(MOCK_USERS));
            }
            usersDb = JSON.parse(localStorage.getItem(USERS_KEY));

            // Check for logged-in user
            const savedUser = localStorage.getItem(AUTH_KEY);
            if (savedUser) {
                currentUser = JSON.parse(savedUser);
                showApp();
            } else {
                showLogin();
            }
        },
        login: (email, password) => {
            if (password !== 'password') {
                showError("Invalid password. (Hint: use 'password')");
                return;
            }
            const user = usersDb.find(u => u.email === email);
            if (user) {
                currentUser = user;
                localStorage.setItem(AUTH_KEY, JSON.stringify(currentUser));
                showApp();
            } else {
                showError("User not found.");
            }
        },
        logout: () => {
            currentUser = null;
            localStorage.removeItem(AUTH_KEY);
            showLogin();
        }
    };

    /**
     * Permission Service (Mock)
     */
    const permissionService = {
        can: (action) => {
            if (!currentUser) return false;
            const role = currentUser.role;

            switch (action) {
                case 'VIEW_DASHBOARD':
                    return true;
                case 'VIEW_PRODUCTS':
                    return true;
                case 'CREATE_ITEM':
                    return role === 'Admin';
                case 'UPDATE_STOCK': // Add, Remove, Move
                    return role === 'Admin' || role === 'Inventory Manager';
                case 'VIEW_ITEM_HISTORY':
                    return true;
                case 'VIEW_ADMIN_PANEL':
                    return role === 'Admin';
                case 'MANAGE_USERS':
                    return role === 'Admin';
                case 'VIEW_LEDGER':
                    return role === 'Admin' || role === 'Auditor';
                case 'VERIFY_CHAIN':
                    return role === 'Admin' || role === 'Auditor';
                case 'CLEAR_DB':
                    return role === 'Admin';
                default:
                    return false;
            }
        }
    };

    // --- NAVIGATION & UI CONTROL ---

    const showLogin = () => {
        loginOverlay.style.display = 'flex';
        appWrapper.classList.add('hidden');
    };

    const showApp = () => {
        loginOverlay.style.display = 'none';
        appWrapper.classList.remove('hidden');
        
        // Update user info in sidebar
        document.getElementById('user-name').textContent = currentUser.name;
        document.getElementById('user-role').textContent = currentUser.role;
        document.getElementById('user-employee-id').textContent = currentUser.employeeId;

        // Show/hide nav links based on role
        navLinks.admin.style.display = permissionService.can('VIEW_ADMIN_PANEL') ? 'flex' : 'none';
        navLinks.ledger.style.display = permissionService.can('VIEW_LEDGER') ? 'flex' : 'none';

        loadBlockchain();
        rebuildInventoryState();
        navigateTo('dashboard');
    };

    const navigateTo = (view, context = {}) => {
        appContent.innerHTML = ''; // Clear content
        
        // Remove 'active' class from all nav links
        Object.values(navLinks).forEach(link => link.classList.remove('active'));

        let viewTemplate;
        switch (view) {
            case 'products':
                navLinks.products.classList.add('active');
                viewTemplate = templates.productList.content.cloneNode(true);
                appContent.appendChild(viewTemplate);
                renderProductList();
                break;
            
            case 'detail':
                navLinks.products.classList.add('active'); // Keep 'Products' active
                viewTemplate = templates.productDetail.content.cloneNode(true);
                appContent.appendChild(viewTemplate);
                renderProductDetail(context.productId);
                break;

            case 'admin':
                if (!permissionService.can('VIEW_ADMIN_PANEL')) return navigateTo('dashboard');
                navLinks.admin.classList.add('active');
                viewTemplate = templates.admin.content.cloneNode(true);
                appContent.appendChild(viewTemplate);
                renderAdminPanel();
                break;

            case 'ledger':
                if (!permissionService.can('VIEW_LEDGER')) return navigateTo('dashboard');
                navLinks.ledger.classList.add('active');
                viewTemplate = templates.ledger.content.cloneNode(true);
                appContent.appendChild(viewTemplate);
                renderFullLedger();
                break;

            case 'dashboard':
            default:
                navLinks.dashboard.classList.add('active');
                viewTemplate = templates.dashboard.content.cloneNode(true);
                appContent.appendChild(viewTemplate);
                renderDashboard();
                break;
        }
    };

    // --- CORE LOGIC (Blockchain & Inventory) ---

    const addTransactionToChain = (transaction) => {
        const index = blockchain.length;
        const previousHash = blockchain[blockchain.length - 1].hash;
        const newBlock = createBlock(index, transaction, previousHash); // from blockchain.js
        blockchain.push(newBlock);
        saveBlockchain();
    };

    const processTransaction = (transaction, suppressErrors = false) => {
        const { txType, itemSku, itemName, quantity, fromLocation, toLocation, location } = transaction;

        let product;
        if (txType !== 'CREATE_ITEM' && !inventory.has(itemSku)) {
            showError(`Product ${itemSku} not found.`, suppressErrors);
            return false;
        }
        
        if (txType !== 'CREATE_ITEM') {
            product = inventory.get(itemSku);
        }

        switch (txType) {
            case 'CREATE_ITEM':
                if (inventory.has(itemSku) && !suppressErrors) {
                    showError(`Product SKU ${itemSku} already exists.`);
                    return false;
                }
                if (!inventory.has(itemSku)) {
                     inventory.set(itemSku, {
                        productName: itemName,
                        locations: new Map()
                    });
                }
                product = inventory.get(itemSku);
                const currentAddQty = product.locations.get(toLocation) || 0;
                product.locations.set(toLocation, currentAddQty + quantity);
                return true;
        
            case 'MOVE':
                const fromQty = product.locations.get(fromLocation) || 0;
                if (fromQty < quantity) {
                    showError(`Insufficient stock at ${fromLocation}. Only ${fromQty} available.`, suppressErrors);
                    return false;
                }
                const toQty = product.locations.get(toLocation) || 0;
                product.locations.set(fromLocation, fromQty - quantity);
                product.locations.set(toLocation, toQty + quantity);
                return true;
            
            case 'STOCK_IN':
                const currentStockInQty = product.locations.get(location) || 0;
                product.locations.set(location, currentStockInQty + quantity);
                return true;
            
            case 'STOCK_OUT':
                const currentStockOutQty = product.locations.get(location) || 0;
                if (currentStockOutQty < quantity) {
                    showError(`Insufficient stock at ${location}. Only ${currentStockOutQty} available.`, suppressErrors);
                    return false;
                }
                product.locations.set(location, currentStockOutQty - quantity);
                return true;
        }
        return false;
    };
    
    // --- EVENT HANDLERS (Delegated & Static) ---

    // Login/Logout
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = loginEmailSelect.value;
        const password = document.getElementById('login-password').value;
        authService.login(email, password);
    });
    logoutButton.addEventListener('click', authService.logout);

    // Sidebar Navigation
    navLinks.dashboard.addEventListener('click', (e) => { e.preventDefault(); navigateTo('dashboard'); });
    navLinks.products.addEventListener('click', (e) => { e.preventDefault(); navigateTo('products'); });
    navLinks.admin.addEventListener('click', (e) => { e.preventDefault(); navigateTo('admin'); });
    navLinks.ledger.addEventListener('click', (e) => { e.preventDefault(); navigateTo('ledger'); });

    // Dynamic content events (delegated from appContent)
    appContent.addEventListener('submit', (e) => {
        e.preventDefault();
        
        if (e.target.id === 'add-item-form') {
            if (!permissionService.can('CREATE_ITEM')) return showError("Access Denied.");
            handleAddItem(e.target);
        }
        
        if (e.target.id === 'update-stock-form') {
            if (!permissionService.can('UPDATE_STOCK')) return showError("Access Denied.");
            handleUpdateStock(e.target);
        }
    });

    appContent.addEventListener('click', (e) => {
        // Back to list
        if (e.target.closest('#back-to-list-button')) {
            navigateTo('products');
            return;
        }
        
        // *** NEW ***
        // Dashboard View All Activity
        if (e.target.closest('#dashboard-view-ledger')) {
            e.preventDefault();
            navigateTo('ledger');
            return;
        }
        // *** END NEW ***

        // Product card click
        const productCard = e.target.closest('.product-card');
        if (productCard && productCard.dataset.productId) {
            navigateTo('detail', { productId: productCard.dataset.productId });
            return;
        }
        // Admin buttons
        if (e.target.closest('#clear-db-button')) {
            if (!permissionService.can('CLEAR_DB')) return showError("Access Denied.");
            handleClearDb();
        }
        if (e.target.closest('#verify-chain-button')) {
            if (!permissionService.can('VERIFY_CHAIN')) return showError("Access Denied.");
            handleVerifyChain();
        }
        // User role change
        if (e.target.classList.contains('role-select')) {
            if (!permissionService.can('MANAGE_USERS')) return showError("Access Denied.");
            handleRoleChange(e.target.dataset.userId, e.target.value);
        }
    });

    // --- FORM HANDLERS ---

    const handleAddItem = (form) => {
        const itemSku = form.querySelector('#add-product-id').value;
        const itemName = form.querySelector('#add-product-name').value;
        const quantity = parseInt(form.querySelector('#add-quantity').value, 10);
        const toLocation = form.querySelector('#add-to').value;

        if (!itemSku || !itemName || !quantity || quantity <= 0) {
            return showError("Please fill out all fields with valid data.");
        }

        // Get 'before' state (which is 0 for a new item)
        const beforeQuantity = 0;
        const afterQuantity = quantity;

        // Build transaction payload as per SRS
        const transaction = {
            txType: "CREATE_ITEM",
            itemSku,
            itemName,
            quantity,
            beforeQuantity,
            afterQuantity,
            toLocation,
            userId: currentUser.id,
            employeeId: currentUser.employeeId,
            userName: currentUser.name,
            timestamp: new Date().toISOString()
        };

        if (processTransaction(transaction)) {
            addTransactionToChain(transaction);
            renderProductList();
            showSuccess(`Product ${itemName} added!`);
            form.reset();
            form.querySelector('#add-product-id').value = `SKU-${Math.floor(100 + Math.random() * 900)}`;
            form.querySelector('#add-product-name').value = "New Product";
        }
    };

    const handleUpdateStock = (form) => {
        const itemSku = form.querySelector('#update-product-id').value;
        const quantity = parseInt(form.querySelector('#update-quantity').value, 10);
        const actionType = form.querySelector('#update-action-type').value;

        if (!itemSku || !quantity || quantity <= 0) return showError("Please enter a valid quantity.");
        
        const product = inventory.get(itemSku);
        let transaction = {};
        let success = false;
        let beforeQuantity, afterQuantity;

        switch (actionType) {
            case 'MOVE':
                const fromLocation = form.querySelector('#update-from').value;
                const toLocation = form.querySelector('#update-to').value;
                if (fromLocation === toLocation) return showError("'From' and 'To' locations cannot be the same.");

                beforeQuantity = { from: product.locations.get(fromLocation) || 0, to: product.locations.get(toLocation) || 0 };
                afterQuantity = { from: beforeQuantity.from - quantity, to: beforeQuantity.to + quantity };
                
                transaction = { txType: "MOVE", itemSku, quantity, fromLocation, toLocation, beforeQuantity, afterQuantity,
                                userId: currentUser.id, employeeId: currentUser.employeeId, userName: currentUser.name, timestamp: new Date().toISOString() };
                success = processTransaction(transaction);
                break;
            
            case 'STOCK_IN':
                const locationIn = form.querySelector('#update-to').value;
                beforeQuantity = product.locations.get(locationIn) || 0;
                afterQuantity = beforeQuantity + quantity;

                transaction = { txType: "STOCK_IN", itemSku, quantity, location: locationIn, beforeQuantity, afterQuantity,
                                userId: currentUser.id, employeeId: currentUser.employeeId, userName: currentUser.name, timestamp: new Date().toISOString() };
                success = processTransaction(transaction);
                break;
                
            case 'STOCK_OUT':
                const locationOut = form.querySelector('#update-from').value;
                beforeQuantity = product.locations.get(locationOut) || 0;
                afterQuantity = beforeQuantity - quantity;
                
                transaction = { txType: "STOCK_OUT", itemSku, quantity, location: locationOut, beforeQuantity, afterQuantity,
                                userId: currentUser.id, employeeId: currentUser.employeeId, userName: currentUser.name, timestamp: new Date().toISOString() };
                success = processTransaction(transaction);
                break;
        }

        if (success) {
            addTransactionToChain(transaction);
            renderProductDetail(itemSku); // Re-render this view
            showSuccess(`Stock for ${itemSku} updated!`);
        }
    };

    const handleClearDb = () => {
        localStorage.removeItem(DB_KEY);
        localStorage.removeItem(USERS_KEY); // Also clear user roles
        inventory.clear();
        loadBlockchain(); // Re-creates Genesis
        authService.init(); // Re-inits user db
        navigateTo('dashboard');
        showSuccess("Database cleared and demo reset.");
    };

    const handleVerifyChain = () => {
        const isValid = isChainValid(blockchain); // from blockchain.js
        if (isValid) {
            showSuccess("Verification complete: Blockchain is valid!");
        } else {
            showError("CRITICAL: Blockchain is invalid! Tampering detected.");
        }
    };
    
    const handleRoleChange = (userId, newRole) => {
        // Update the 'usersDb' in memory
        const user = usersDb.find(u => u.id === userId);
        if (user) {
            user.role = newRole;
            // Save back to 'localStorage' (simulating DB write)
            localStorage.setItem(USERS_KEY, JSON.stringify(usersDb));
            showSuccess(`Role for ${user.name} updated to ${newRole}.`);
            
            // If admin changed their own role, re-auth
            if (user.id === currentUser.id) {
                currentUser.role = newRole;
                localStorage.setItem(AUTH_KEY, JSON.stringify(currentUser));
                showApp(); // Re-render UI with new permissions
            }
        }
    };

    // --- VIEW RENDERING FUNCTIONS ---
    
    const renderDashboard = () => {
        // --- Render KPIs ---
        let totalSkus = inventory.size;
        let totalUnits = 0;
        inventory.forEach(product => {
            product.locations.forEach(qty => totalUnits += qty);
        });

        appContent.querySelector('#kpi-total-skus').textContent = totalSkus;
        appContent.querySelector('#kpi-total-units').textContent = totalUnits;
        appContent.querySelector('#kpi-chain-length').textContent = blockchain.length;
        
        // --- Render Permissions for DB/Verify ---
        appContent.querySelector('#clear-db-button').style.display = permissionService.can('CLEAR_DB') ? 'flex' : 'none';
        appContent.querySelector('#verify-chain-button').style.display = permissionService.can('VERIFY_CHAIN') ? 'flex' : 'none';
        
        // --- *** NEW FEATURE LOGIC *** ---
        // --- Render Recent Activity ---
        const activityList = appContent.querySelector('#recent-activity-list');
        const emptyMessage = appContent.querySelector('#recent-activity-empty');
        const viewLedgerLink = appContent.querySelector('#dashboard-view-ledger');
        const activityContainer = appContent.querySelector('#recent-activity-container');

        if (!activityList) return; // Template not ready

        // Show/hide based on permissions
        if (!permissionService.can('VIEW_LEDGER')) {
            activityContainer.style.display = 'none';
            return; // Don't render if user can't see ledger
        }
        viewLedgerLink.style.display = 'block';

        activityList.innerHTML = ''; // Clear list

        // Get last 5 blocks (reverse, filter genesis, take 5)
        const recentBlocks = [...blockchain]
            .reverse()
            .filter(block => block.transaction.txType !== 'GENESIS')
            .slice(0, 5);

        if (recentBlocks.length === 0) {
            emptyMessage.style.display = 'block';
        } else {
            emptyMessage.style.display = 'none';
            recentBlocks.forEach(block => {
                activityList.appendChild(createLedgerBlockElement(block));
            });
        }
        // --- *** END NEW FEATURE LOGIC *** ---
    };

    const renderProductList = () => {
        const productGrid = appContent.querySelector('#product-grid');
        if (!productGrid) return;
        productGrid.innerHTML = ''; 
        
        // Permissions
        appContent.querySelector('#add-item-container').style.display = permissionService.can('CREATE_ITEM') ? 'block' : 'none';

        if (inventory.size === 0) {
            productGrid.innerHTML = `<p class="text-slate-500 lg:col-span-3">No products in inventory. ${permissionService.can('CREATE_ITEM') ? 'Add one above!' : ''}</p>`;
            return;
        }

        inventory.forEach((product, productId) => {
            const productCard = document.createElement('div');
            productCard.className = 'product-card';
            productCard.dataset.productId = productId;

            let totalStock = 0;
            product.locations.forEach(qty => totalStock += qty);

            productCard.innerHTML = `
                <div class="product-card-placeholder"><i class="ph-bold ph-package"></i></div>
                <div class="product-card-content">
                    <h3 class="font-semibold text-lg text-indigo-700 truncate">${product.productName}</h3>
                    <p class="text-xs text-slate-500 mb-2">${productId}</p>
                    <hr class="my-2">
                    <div class="flex justify-between items-center text-sm font-semibold">
                        <span>Total Stock:</span>
                        <span>${totalStock} units</span>
                    </div>
                </div>
            `;
            productGrid.appendChild(productCard);
        });
    };

    const renderProductDetail = (productId) => {
        const product = inventory.get(productId);
        if (!product) {
            showError(`Product ${productId} not found.`);
            return navigateTo('products');
        }

        // Fill product info
        appContent.querySelector('#detail-product-name').textContent = product.productName;
        appContent.querySelector('#detail-product-id').textContent = productId;
        appContent.querySelector('#update-product-id').value = productId;

        // Fill stock levels
        const stockLevelsDiv = appContent.querySelector('#detail-stock-levels');
        stockLevelsDiv.innerHTML = '';
        let totalStock = 0;
        ["Supplier", "Warehouse", "Retailer"].forEach(location => {
            const qty = product.locations.get(location) || 0;
            totalStock += qty;
            stockLevelsDiv.innerHTML += `
                <div class="flex justify-between items-center text-sm">
                    <span class="text-slate-600">${location}:</span>
                    <span class="font-medium text-slate-800">${qty} units</span>
                </div>`;
        });
        appContent.querySelector('#detail-total-stock').textContent = `${totalStock} units`;
        
        // Permissions
        appContent.querySelector('#update-stock-container').style.display = permissionService.can('UPDATE_STOCK') ? 'block' : 'none';

        // Render Item History (The SRS Requirement)
        renderItemHistory(productId);
        
        // Add event listener for the action type dropdown
        const actionTypeSelect = appContent.querySelector('#update-action-type');
        const fromGroup = appContent.querySelector('#from-location-group');
        const toGroup = appContent.querySelector('#to-location-group');
        const fromLabel = fromGroup.querySelector('label');
        const toLabel = toGroup.querySelector('label');

        const handleActionChange = () => {
            switch (actionTypeSelect.value) {
                case 'MOVE':
                    fromGroup.style.display = 'block'; toGroup.style.display = 'block';
                    fromLabel.textContent = 'From Location'; toLabel.textContent = 'To Location';
                    break;
                case 'STOCK_IN':
                    fromGroup.style.display = 'none'; toGroup.style.display = 'block';
                    toLabel.textContent = 'Location';
                    break;
                case 'STOCK_OUT':
                    fromGroup.style.display = 'block'; toGroup.style.display = 'none';
                    fromLabel.textContent = 'Location';
                    break;
            }
        };
        actionTypeSelect.addEventListener('change', handleActionChange);
        handleActionChange();
    };

    const renderItemHistory = (productId) => {
        const historyDisplay = appContent.querySelector('#item-history-display');
        historyDisplay.innerHTML = '';
        
        const itemHistory = blockchain
            .filter(block => block.transaction.itemSku === productId)
            .reverse(); // Newest first

        if (itemHistory.length === 0) {
            historyDisplay.innerHTML = '<p class="text-sm text-slate-500">No history found for this item.</p>';
            return;
        }

        itemHistory.forEach(block => {
            historyDisplay.appendChild(createLedgerBlockElement(block));
        });
    };
    
    const renderFullLedger = () => {
        const ledgerDisplay = appContent.querySelector('#full-ledger-display');
        ledgerDisplay.innerHTML = '';
        
        [...blockchain].reverse().forEach(block => {
            if (block.transaction.txType === 'GENESIS') return;
            ledgerDisplay.appendChild(createLedgerBlockElement(block));
        });
    };
    
    const renderAdminPanel = () => {
        const tableBody = appContent.querySelector('#user-management-table');
        tableBody.innerHTML = '';
        
        // (Re-read from storage in case it was modified)
        usersDb = JSON.parse(localStorage.getItem(USERS_KEY));
        
        usersDb.forEach(user => {
            const row = document.createElement('tr');
            
            // Cannot edit your own role
            const isCurrentUser = user.id === currentUser.id;
            
            row.innerHTML = `
                <td class="table-cell font-medium">${user.name}</td>
                <td class="table-cell text-slate-500">${user.employeeId}</td>
                <td class="table-cell text-slate-500">${user.email}</td>
                <td class="table-cell">
                    <select data-user-id="${user.id}" class="role-select block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500" ${isCurrentUser ? 'disabled' : ''}>
                        <option value="Admin" ${user.role === 'Admin' ? 'selected' : ''}>Admin</option>
                        <option value="Inventory Manager" ${user.role === 'Inventory Manager' ? 'selected' : ''}>Inventory Manager</option>
                        <option value="Auditor" ${user.role === 'Auditor' ? 'selected' : ''}>Auditor</option>
                    </select>
                </td>
            `;
            tableBody.appendChild(row);
        });
    };

    /**
     * Helper: Creates a rich ledger block element for display
     */
    const createLedgerBlockElement = (block) => {
        const blockElement = document.createElement('div');
        blockElement.className = 'border border-slate-200 rounded-lg p-3 bg-white shadow-sm';
        
        const { txType, itemSku, itemName, quantity, fromLocation, toLocation, location, userName, employeeId, beforeQuantity, afterQuantity } = block.transaction;
        let transactionHtml = '';
        let detailsHtml = '';

        switch (txType) {
            case 'CREATE_ITEM':
                transactionHtml = `<span class="font-semibold text-green-700">CREATE</span> <strong>${quantity}</strong> of <strong>${itemName}</strong> (${itemSku}) to <strong>${toLocation}</strong>`;
                detailsHtml = `<li>User: <strong>${userName}</strong> (${employeeId})</li>`;
                break;
            case 'MOVE':
                transactionHtml = `<span class="font-semibold text-blue-600">MOVE</span> <strong>${quantity}</strong> of <strong>${itemSku}</strong>`;
                detailsHtml = `<li>From: <strong>${fromLocation}</strong> (Before: ${beforeQuantity.from}, After: ${afterQuantity.from})</li>
                               <li>To: <strong>${toLocation}</strong> (Before: ${beforeQuantity.to}, After: ${afterQuantity.to})</li>
                               <li>User: <strong>${userName}</strong> (${employeeId})</li>`;
                break;
            case 'STOCK_IN':
                transactionHtml = `<span class="font-semibold text-green-600">STOCK IN</span> <strong>${quantity}</strong> of <strong>${itemSku}</strong> at <strong>${location}</strong>`;
                detailsHtml = `<li>Before: ${beforeQuantity}, After: ${afterQuantity}</li>
                               <li>User: <strong>${userName}</strong> (${employeeId})</li>`;
                break;
            case 'STOCK_OUT':
                transactionHtml = `<span class="font-semibold text-red-600">STOCK OUT</span> <strong>${quantity}</strong> of <strong>${itemSku}</strong> from <strong>${location}</strong>`;
                detailsHtml = `<li>Before: ${beforeQuantity}, After: ${afterQuantity}</li>
                               <li>User: <strong>${userName}</strong> (${employeeId})</li>`;
                break;
        }

        blockElement.innerHTML = `
            <div class="flex justify-between items-center mb-2">
                <h4 class="font-semibold text-sm text-indigo-700">Block #${block.index}</h4>
                <span class="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-full">${new Date(block.timestamp).toLocaleTimeString()}</span>
            </div>
            <p class="text-sm text-slate-700 mb-2">${transactionHtml}</p>
            <ul class="text-xs text-slate-600 space-y-1 mb-3">
                ${detailsHtml}
            </ul>
            <div class="text-xs text-slate-500 bg-slate-50 p-2 rounded-md">
                <p class="truncate"><strong>Hash:</strong> ${block.hash}</p>
                <p class="truncate"><strong>Prev Hash:</strong> ${block.previousHash}</p>
            </div>
        `;
        return blockElement;
    };
    
    // --- TOAST/NOTIFICATION FUNCTIONS ---
    
    let errorTimer;
    const showError = (message, suppress = false) => {
        console.error(message);
        if (suppress) return;
        errorMessage.textContent = message;
        errorToast.classList.add('toast-show');
        clearTimeout(errorTimer);
        errorTimer = setTimeout(() => errorToast.classList.remove('toast-show'), 3000);
    };
    
    let successTimer;
    const showSuccess = (message) => {
        console.log(message);
        successMessage.textContent = message;
        successToast.classList.add('toast-show');
        clearTimeout(successTimer);
        successTimer = setTimeout(() => successToast.classList.remove('toast-show'), 3000);
    };

    // --- INITIALIZATION ---

    const saveBlockchain = () => {
        try {
            localStorage.setItem(DB_KEY, JSON.stringify(blockchain));
        } catch (e) {
            console.error("Failed to save blockchain:", e);
            showError("Could not save data. LocalStorage may be full.");
        }
    };

    const loadBlockchain = () => {
        const savedChain = localStorage.getItem(DB_KEY);
        if (savedChain) {
            try {
                blockchain = JSON.parse(savedChain);
                if (blockchain.length === 0) throw new Error("Empty chain");
            } catch (e) {
                console.error("Failed to parse saved blockchain:", e);
                localStorage.removeItem(DB_KEY);
                blockchain = [createGenesisBlock()];
                saveBlockchain();
            }
        } else {
            blockchain = [createGenesisBlock()];
            saveBlockchain();
        }
    };

    const rebuildInventoryState = () => {
        inventory.clear();
        for (let i = 1; i < blockchain.length; i++) {
            if (blockchain[i] && blockchain[i].transaction) {
                processTransaction(blockchain[i].transaction, true); // Suppress errors on rebuild
            }
        }
    };

    // --- START THE APP ---
    authService.init();
});