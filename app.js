document.addEventListener('DOMContentLoaded', () => {
    
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

    // --- NAVIGATION & UI CONTROL ---

    const showLogin = () => {
        loginOverlay.style.display = 'flex';
        appWrapper.classList.add('hidden');
    };

    const showApp = () => {
        loginOverlay.style.display = 'none';
        appWrapper.classList.remove('hidden');
        
        // Update user info in sidebar
        const user = currentUser; // 'currentUser' is from core.js
        document.getElementById('user-name').textContent = user.name;
        document.getElementById('user-role').textContent = user.role;
        document.getElementById('user-employee-id').textContent = user.employeeId;

        // Show/hide nav links based on role
        navLinks.admin.style.display = permissionService.can('VIEW_ADMIN_PANEL') ? 'flex' : 'none';
        navLinks.ledger.style.display = permissionService.can('VIEW_LEDGER') ? 'flex' : 'none';

        loadBlockchain(); // from core.js
        rebuildInventoryState(); // from core.js
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
    
    // --- EVENT HANDLERS (Delegated & Static) ---

    // Login/Logout
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = loginEmailSelect.value;
        const password = document.getElementById('login-password').value;
        authService.login(email, password, showApp, showError); // Pass UI functions
    });
    logoutButton.addEventListener('click', () => authService.logout(showLogin)); // Pass UI function

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

        // *** NEW: Handle Move Stock Form ***
        if (e.target.id === 'move-stock-form') {
            if (!permissionService.can('UPDATE_STOCK')) return showError("Access Denied.");
            handleMoveStock(e.target);
        }
    });

    appContent.addEventListener('click', (e) => {
        // Back to list
        if (e.target.closest('#back-to-list-button')) {
            navigateTo('products');
            return;
        }
        
        // Dashboard View All Activity
        if (e.target.closest('#dashboard-view-ledger')) {
            e.preventDefault();
            navigateTo('ledger');
            return;
        }

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

    // --- FORM HANDLERS (UI LOGIC) ---

    const handleAddItem = (form) => {
        const itemSku = form.querySelector('#add-product-id').value;
        const itemName = form.querySelector('#add-product-name').value;
        const quantity = parseInt(form.querySelector('#add-quantity').value, 10);
        const toLocation = form.querySelector('#add-to').value;
        // *** MODIFIED: Read price from new field ***
        const price = parseFloat(form.querySelector('#add-price').value);

        if (!itemSku || !itemName || !quantity || quantity <= 0 || !price || price < 0) {
            return showError("Please fill out all fields with valid data (Price/Qty > 0).");
        }

        const beforeQuantity = 0;
        const afterQuantity = quantity;
        const user = currentUser; // from core.js

        const transaction = {
            txType: "CREATE_ITEM", itemSku, itemName, quantity,
            price, // *** MODIFIED: Add price to transaction ***
            beforeQuantity, afterQuantity, toLocation,
            userId: user.id, employeeId: user.employeeId, userName: user.name,
            timestamp: new Date().toISOString()
        };

        if (processTransaction(transaction, false, showError)) { // from core.js
            addTransactionToChain(transaction); // from core.js
            renderProductList();
            showSuccess(`Product ${itemName} added!`);
            form.reset();
            form.querySelector('#add-product-id').value = `SKU-${Math.floor(100 + Math.random() * 900)}`;
            form.querySelector('#add-product-name').value = "New Product";
        }
    };

    const handleUpdateStock = (form) => {
        // *** MODIFIED: Find product ID from the *other* form (since it's shared) ***
        const itemSku = document.getElementById('update-product-id').value;
        const quantity = parseInt(form.querySelector('#update-quantity').value, 10);
        // Get which button was clicked using the event target
        const clickedButton = document.activeElement;
        const actionType = clickedButton.id === 'stock-in-button' ? 'STOCK_IN' : 'STOCK_OUT';

        if (!itemSku || !quantity || quantity <= 0) return showError("Please enter a valid quantity.");
        
        const product = inventory.get(itemSku); // 'inventory' from core.js
        let transaction = {};
        let success = false;
        let beforeQuantity, afterQuantity;
        const user = currentUser; // from core.js

        if (actionType === 'STOCK_IN') {
            const locationIn = form.querySelector('#update-location').value;
            beforeQuantity = product.locations.get(locationIn) || 0;
            afterQuantity = beforeQuantity + quantity;

            transaction = { 
                txType: "STOCK_IN", 
                itemSku, 
                quantity, 
                location: locationIn, 
                beforeQuantity, 
                afterQuantity,
                userId: user.id, 
                employeeId: user.employeeId, 
                userName: user.name, 
                timestamp: new Date().toISOString() 
            };
            success = processTransaction(transaction, false, showError); // from core.js
        } else if (actionType === 'STOCK_OUT') {
            const locationOut = form.querySelector('#update-location').value;
            beforeQuantity = product.locations.get(locationOut) || 0;
            afterQuantity = beforeQuantity - quantity;
            
            transaction = { 
                txType: "STOCK_OUT", 
                itemSku, 
                quantity, 
                location: locationOut, 
                beforeQuantity, 
                afterQuantity,
                userId: user.id, 
                employeeId: user.employeeId, 
                userName: user.name, 
                timestamp: new Date().toISOString() 
            };
            success = processTransaction(transaction, false, showError); // from core.js
        }

        if (success) {
            addTransactionToChain(transaction); // from core.js
            renderProductDetail(itemSku); // Re-render this view
            showSuccess(`Stock for ${itemSku} updated!`);
        }
    };

    // *** NEW FUNCTION: handleMoveStock ***
    const handleMoveStock = (form) => {
        const itemSku = document.getElementById('update-product-id').value; // Get SKU from hidden field
        const quantity = parseInt(form.querySelector('#move-quantity').value, 10);
        const fromLocation = form.querySelector('#move-from-location').value;
        const toLocation = form.querySelector('#move-to-location').value;

        if (fromLocation === toLocation) {
            return showError("Cannot move stock to the same location.");
        }
        if (!itemSku || !quantity || quantity <= 0) {
            return showError("Please enter a valid quantity.");
        }

        const product = inventory.get(itemSku);
        const user = currentUser;

        // Calculate before/after quantities for the ledger
        const beforeFromQty = product.locations.get(fromLocation) || 0;
        const beforeToQty = product.locations.get(toLocation) || 0;
        const afterFromQty = beforeFromQty - quantity;
        const afterToQty = beforeToQty + quantity;

        const transaction = {
            txType: "MOVE",
            itemSku,
            quantity,
            fromLocation,
            toLocation,
            beforeQuantity: { from: beforeFromQty, to: beforeToQty },
            afterQuantity: { from: afterFromQty, to: afterToQty },
            userId: user.id, 
            employeeId: user.employeeId, 
            userName: user.name, 
            timestamp: new Date().toISOString() 
        };

        if (processTransaction(transaction, false, showError)) { // core.js handles the logic
            addTransactionToChain(transaction);
            renderProductDetail(itemSku); // Re-render this view
            showSuccess(`Moved ${quantity} units of ${itemSku} from ${fromLocation} to ${toLocation}.`);
        }
    };

    const handleClearDb = () => {
        localStorage.removeItem(DB_KEY);
        localStorage.removeItem(USERS_KEY);
        inventory.clear(); // from core.js
        loadBlockchain(); // from core.js
        
        // Re-init auth service (which lives in core.js)
        // This is a bit of a workaround for the UI functions
        // We are effectively logging out and back in
        authService.init(showApp, showLogin);
        
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
        const user = usersDb.find(u => u.id === userId); // 'usersDb' from core.js
        if (user) {
            user.role = newRole;
            localStorage.setItem(USERS_KEY, JSON.stringify(usersDb));
            showSuccess(`Role for ${user.name} updated to ${newRole}.`);
            
            if (user.id === currentUser.id) { // 'currentUser' from core.js
                currentUser.role = newRole;
                localStorage.setItem(AUTH_KEY, JSON.stringify(currentUser));
                showApp(); // Re-render UI with new permissions
            }
        }
    };

    // --- VIEW RENDERING FUNCTIONS (UI LOGIC) ---
    
    const renderDashboard = () => {
        let totalSkus = inventory.size; // 'inventory' from core.js
        let totalUnits = 0;
        inventory.forEach(product => {
            product.locations.forEach(qty => totalUnits += qty);
        });

        appContent.querySelector('#kpi-total-skus').textContent = totalSkus;
        appContent.querySelector('#kpi-total-units').textContent = totalUnits;
        appContent.querySelector('#kpi-chain-length').textContent = blockchain.length; // 'blockchain' from core.js
        
        appContent.querySelector('#clear-db-button').style.display = permissionService.can('CLEAR_DB') ? 'flex' : 'none';
        appContent.querySelector('#verify-chain-button').style.display = permissionService.can('VERIFY_CHAIN') ? 'flex' : 'none';
        
        // Render Recent Activity (Check if elements exist, they might not in this template)
        const activityContainer = appContent.querySelector('#recent-activity-container');
        if (activityContainer) {
            const activityList = appContent.querySelector('#recent-activity-list');
            const emptyMessage = appContent.querySelector('#recent-activity-empty');
            const viewLedgerLink = appContent.querySelector('#dashboard-view-ledger');

            if (!permissionService.can('VIEW_LEDGER')) {
                activityContainer.style.display = 'none';
                return;
            }
            viewLedgerLink.style.display = 'block';
            activityList.innerHTML = '';

            const recentBlocks = [...blockchain] // 'blockchain' from core.js
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
        }
    };

    const renderProductList = () => {
        const productGrid = appContent.querySelector('#product-grid');
        if (!productGrid) return;
        productGrid.innerHTML = ''; 
        
        appContent.querySelector('#add-item-container').style.display = permissionService.can('CREATE_ITEM') ? 'block' : 'none';

        if (inventory.size === 0) { // 'inventory' from core.js
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
        const product = inventory.get(productId); // 'inventory' from core.js
        if (!product) {
            showError(`Product ${productId} not found.`);
            return navigateTo('products');
        }

        appContent.querySelector('#detail-product-name').textContent = product.productName;
        appContent.querySelector('#detail-product-id').textContent = productId;
        appContent.querySelector('#update-product-id').value = productId; // Set hidden SKU field

        // *** MODIFIED: Display price ***
        const price = product.price || 0;
        appContent.querySelector('#detail-product-price').textContent = `$${price.toFixed(2)}`;


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
        
        appContent.querySelector('#update-stock-container').style.display = permissionService.can('UPDATE_STOCK') ? 'block' : 'none';

        renderItemHistory(productId);
        
        // *** MODIFIED: Removed dead code that was here ***
    };

    const renderItemHistory = (productId) => {
        const historyDisplay = appContent.querySelector('#item-history-display');
        historyDisplay.innerHTML = '';
        
        const itemHistory = blockchain // 'blockchain' from core.js
            .filter(block => block.transaction.itemSku === productId)
            .reverse();

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
        
        [...blockchain].reverse().forEach(block => { // 'blockchain' from core.js
            if (block.transaction.txType === 'GENESIS') return;
            ledgerDisplay.appendChild(createLedgerBlockElement(block));
        });
    };
    
    const renderAdminPanel = () => {
        const tableBody = appContent.querySelector('#user-management-table');
        tableBody.innerHTML = '';
        
        usersDb = JSON.parse(localStorage.getItem(USERS_KEY));
        
        usersDb.forEach(user => {
            const row = document.createElement('tr');
            const isCurrentUser = user.id === currentUser.id; // 'currentUser' from core.js
            
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
        
        // *** MODIFIED: Destructure 'price' ***
        const { txType, itemSku, itemName, quantity, fromLocation, toLocation, location, userName, employeeId, beforeQuantity, afterQuantity, price } = block.transaction;
        let transactionHtml = '';
        let detailsHtml = '';

        switch (txType) {
            case 'CREATE_ITEM':
                transactionHtml = `<span class="font-semibold text-green-700">CREATE</span> <strong>${quantity}</strong> of <strong>${itemName}</strong> (${itemSku}) to <strong>${toLocation}</strong>`;
                // *** MODIFIED: Add price to details ***
                detailsHtml = `<li>User: <strong>${userName}</strong> (${employeeId})</li>
                               <li>Price: <strong>$${(price || 0).toFixed(2)}</strong></li>`;
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
    
    // --- TOAST/NOTIFICATION FUNCTIONS (UI LOGIC) ---
    
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
    
    // Populate login dropdown (UI logic)
    MOCK_USERS.forEach(user => { // 'MOCK_USERS' from config.js
        const option = document.createElement('option');
        option.value = user.email;
        option.textContent = `${user.name} (${user.role})`;
        loginEmailSelect.appendChild(option);
    });

    // Start the app by calling the auth service
    authService.init(showApp, showLogin); // from core.js
});