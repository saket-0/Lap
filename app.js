document.addEventListener('DOMContentLoaded', async () => {
    
    // --- DOM ELEMENTS ---
    const loginOverlay = document.getElementById('login-overlay');
    const loginForm = document.getElementById('login-form');
    
    // *** MODIFIED: Get new login elements ***
    const loginEmailInput = document.getElementById('login-email-input'); // The text input
    const loginEmailSelect = document.getElementById('login-email-select'); // The dropdown
    const quickLoginButton = document.getElementById('quick-login-button'); // The new button
    
    const appWrapper = document.getElementById('app-wrapper');
    const appContent = document.getElementById('app-content');
    const logoutButton = document.getElementById('logout-button');
    
    // (Rest of the DOM elements are the same)
    const navLinks = {
        dashboard: document.getElementById('nav-dashboard'),
        products: document.getElementById('nav-products'),
        admin: document.getElementById('nav-admin'),
        ledger: document.getElementById('nav-ledger'),
    };
    const errorToast = document.getElementById('error-toast');
    const errorMessage = document.getElementById('error-message');
    const successToast = document.getElementById('success-toast');
    const successMessage = document.getElementById('success-message');
    const templates = {
        dashboard: document.getElementById('dashboard-view-template'),
        productList: document.getElementById('product-list-view-template'),
        productDetail: document.getElementById('product-detail-view-template'),
        admin: document.getElementById('admin-view-template'),
        ledger: document.getElementById('ledger-view-template'),
    };
    
    const API_BASE_URL = 'http://localhost:3000';

    // --- NAVIGATION & UI CONTROL ---
    // (This section is unchanged)
    const showLogin = () => {
        loginOverlay.style.display = 'flex';
        appWrapper.classList.add('hidden');
    };

    const showApp = async () => {
        loginOverlay.style.display = 'none';
        appWrapper.classList.remove('hidden');
        
        const user = currentUser;
        document.getElementById('user-name').textContent = user.name;
        document.getElementById('user-role').textContent = user.role;
        document.getElementById('user-employee-id').textContent = user.employeeId;

        navLinks.admin.style.display = permissionService.can('VIEW_ADMIN_PANEL') ? 'flex' : 'none';
        navLinks.ledger.style.display = permissionService.can('VIEW_LEDGER') ? 'flex' : 'none';

        await loadBlockchain();
        rebuildInventoryState();
        navigateTo('dashboard');
    };

    const navigateTo = (view, context = {}) => {
        appContent.innerHTML = '';
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
                navLinks.products.classList.add('active');
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

    // *** MODIFIED: Main login form uses the text input ***
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = loginEmailInput.value; // Use the input field
        const password = document.getElementById('login-password').value;
        await authService.login(email, password, showApp, showError);
    });

    // *** NEW: Quick login button uses the dropdown ***
    quickLoginButton.addEventListener('click', async () => {
        const email = loginEmailSelect.value; // Use the select field
        const password = "password"; // Hardcoded password
        await authService.login(email, password, showApp, showError);
    });

    // *** NEW: Sync select and input fields for convenience ***
    loginEmailSelect.addEventListener('change', () => {
        loginEmailInput.value = loginEmailSelect.value;
    });


    logoutButton.addEventListener('click', () => authService.logout(showLogin));
    navLinks.dashboard.addEventListener('click', (e) => { e.preventDefault(); navigateTo('dashboard'); });
    navLinks.products.addEventListener('click', (e) => { e.preventDefault(); navigateTo('products'); });
    navLinks.admin.addEventListener('click', (e) => { e.preventDefault(); navigateTo('admin'); });
    navLinks.ledger.addEventListener('click', (e) => { e.preventDefault(); navigateTo('ledger'); });

    // (All other event listeners are unchanged)
    appContent.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (e.target.id === 'add-item-form') {
            if (!permissionService.can('CREATE_ITEM')) return showError("Access Denied.");
            await handleAddItem(e.target);
        }
        
        if (e.target.id === 'update-stock-form') {
            if (!permissionService.can('UPDATE_STOCK')) return showError("Access Denied.");
            await handleUpdateStock(e.target);
        }

        if (e.target.id === 'move-stock-form') {
            if (!permissionService.can('UPDATE_STOCK')) return showError("Access Denied.");
            await handleMoveStock(e.target);
        }
    });

    appContent.addEventListener('input', (e) => {
        if (e.target.id === 'product-search-input') {
            renderProductList();
        }
    });

    appContent.addEventListener('click', async (e) => {
        if (e.target.closest('#back-to-list-button')) {
            navigateTo('products');
            return;
        }
        
        if (e.target.closest('#dashboard-view-ledger')) {
            e.preventDefault();
            navigateTo('ledger');
            return;
        }

        const productCard = e.target.closest('.product-card');
        if (productCard && productCard.dataset.productId) {
            navigateTo('detail', { productId: productCard.dataset.productId });
            return;
        }

        const lowStockItem = e.target.closest('.low-stock-item');
        if (lowStockItem && lowStockItem.dataset.productId) {
            navigateTo('detail', { productId: lowStockItem.dataset.productId });
            return;
        }

        if (e.target.closest('#clear-db-button')) {
            if (!permissionService.can('CLEAR_DB')) return showError("Access Denied.");
            await handleClearDb();
        }
        if (e.target.closest('#verify-chain-button')) {
            if (!permissionService.can('VERIFY_CHAIN')) return showError("Access Denied.");
            await handleVerifyChain();
        }
        
        if (e.target.classList.contains('role-select')) {
            if (!permissionService.can('MANAGE_USERS')) return showError("Access Denied.");
            await handleRoleChange(e.target.dataset.userId, e.target.value);
        }
    });

    // --- FORM HANDLERS (UI LOGIC) ---
    // (handleAddItem, handleUpdateStock, handleMoveStock, handleClearDb, handleVerifyChain, handleRoleChange are all unchanged)

    const handleAddItem = async (form) => {
        const itemSku = form.querySelector('#add-product-id').value;
        const itemName = form.querySelector('#add-product-name').value;
        const quantity = parseInt(form.querySelector('#add-quantity').value, 10);
        const toLocation = form.querySelector('#add-to').value;
        const price = parseFloat(form.querySelector('#add-price').value);
        const category = form.querySelector('#add-product-category').value;

        if (!itemSku || !itemName || !category || !quantity || quantity <= 0 || !price || price < 0) {
            return showError("Please fill out all fields with valid data (Price/Qty > 0).");
        }

        const beforeQuantity = 0;
        const afterQuantity = quantity;
        const user = currentUser;

        const transaction = {
            txType: "CREATE_ITEM", itemSku, itemName, quantity,
            price,
            category,
            beforeQuantity, afterQuantity, toLocation,
            userId: user.id, employeeId: user.employeeId, userName: user.name,
            timestamp: new Date().toISOString()
        };

        if (processTransaction(transaction, false, showError)) {
            await addTransactionToChain(transaction);
            renderProductList();
            showSuccess(`Product ${itemName} added!`);
            form.reset();
            form.querySelector('#add-product-id').value = `SKU-${Math.floor(100 + Math.random() * 900)}`;
            form.querySelector('#add-product-name').value = "New Product";
            form.querySelector('#add-product-category').value = "Electronics";
        }
    };

    const handleUpdateStock = async (form) => {
        const itemSku = document.getElementById('update-product-id').value;
        const quantity = parseInt(form.querySelector('#update-quantity').value, 10);
        const clickedButton = document.activeElement;
        const actionType = clickedButton.id === 'stock-in-button' ? 'STOCK_IN' : 'STOCK_OUT';

        if (!itemSku || !quantity || quantity <= 0) return showError("Please enter a valid quantity.");
        
        const product = inventory.get(itemSku);
        let transaction = {};
        let success = false;
        let beforeQuantity, afterQuantity;
        const user = currentUser;

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
            success = processTransaction(transaction, false, showError);
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
            success = processTransaction(transaction, false, showError);
        }

        if (success) {
            await addTransactionToChain(transaction);
            renderProductDetail(itemSku);
            showSuccess(`Stock for ${itemSku} updated!`);
        }
    };

    const handleMoveStock = async (form) => {
        const itemSku = document.getElementById('update-product-id').value;
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

        if (processTransaction(transaction, false, showError)) {
            await addTransactionToChain(transaction);
            renderProductDetail(itemSku);
            showSuccess(`Moved ${quantity} units of ${itemSku} from ${fromLocation} to ${toLocation}.`);
        }
    };

    const handleClearDb = async () => {
        localStorage.removeItem(DB_KEY);
        inventory.clear();
        await loadBlockchain();
        await authService.init(showApp, showLogin); 
        navigateTo('dashboard');
        showSuccess("Local blockchain cleared.");
        
        if (!currentUser) {
            await populateLoginDropdown();
        }
    };

    const handleVerifyChain = async () => {
        const isValid = await isChainValid(blockchain);
        if (isValid) {
            showSuccess("Verification complete: Blockchain is valid!");
        } else {
            showError("CRITICAL: Blockchain is invalid! Tampering detected.");
        }
    };
    
    const handleRoleChange = async (userId, newRole) => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/users/${userId}/role`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ role: newRole })
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Failed to update role');
            }
            showSuccess(`Role for ${data.user.name} updated to ${newRole}.`);
            if (data.user.id === currentUser.id) {
                currentUser = data.user;
                await showApp();
            }
        } catch (error) {
            showError(error.message);
            renderAdminPanel();
        }
    };

    // --- VIEW RENDERING FUNCTIONS (UI LOGIC) ---
    // (renderDashboard, renderProductList, renderProductDetail, renderItemHistory, renderFullLedger, createLedgerBlockElement are unchanged)
    
    const renderDashboard = () => {
        let totalUnits = 0;
        let totalValue = 0;
        inventory.forEach(product => {
            let totalStock = 0;
            product.locations.forEach(qty => totalStock += qty);
            totalUnits += totalStock;
            totalValue += (product.price || 0) * totalStock;
        });

        appContent.querySelector('#kpi-total-value').textContent = `₹${totalValue.toFixed(2)}`;
        appContent.querySelector('#kpi-total-units').textContent = totalUnits;
        appContent.querySelector('#kpi-transactions').textContent = blockchain.length;
        
        appContent.querySelector('#clear-db-button').style.display = permissionService.can('CLEAR_DB') ? 'flex' : 'none';
        appContent.querySelector('#verify-chain-button').style.display = permissionService.can('VERIFY_CHAIN') ? 'flex' : 'none';
        
        const activityContainer = appContent.querySelector('#recent-activity-container');
        if (activityContainer && permissionService.can('VIEW_LEDGER')) {
            const activityList = appContent.querySelector('#recent-activity-list');
            const emptyMessage = appContent.querySelector('#recent-activity-empty');
            const viewLedgerLink = appContent.querySelector('#dashboard-view-ledger');

            viewLedgerLink.style.display = 'block';
            activityList.innerHTML = '';

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
        } else if (activityContainer) {
            activityContainer.style.display = 'none';
        }

        const lowStockContainer = appContent.querySelector('#low-stock-container');
        if (lowStockContainer && permissionService.can('VIEW_PRODUCTS')) {
            const lowStockList = appContent.querySelector('#low-stock-list');
            const emptyMessage = appContent.querySelector('#low-stock-empty');
            const thresholdLabel = appContent.querySelector('#low-stock-threshold-label');
            
            lowStockList.innerHTML = '';
            const LOW_STOCK_THRESHOLD = 20;
            thresholdLabel.textContent = `(Threshold: ${LOW_STOCK_THRESHOLD} units)`;
            
            const lowStockProducts = [];
            inventory.forEach((product, productId) => {
                let totalStock = 0;
                product.locations.forEach(qty => totalStock += qty);
                
                if (totalStock > 0 && totalStock <= LOW_STOCK_THRESHOLD) {
                    lowStockProducts.push({
                        id: productId,
                        name: product.productName,
                        stock: totalStock
                    });
                }
            });

            if (lowStockProducts.length === 0) {
                emptyMessage.style.display = 'block';
            } else {
                emptyMessage.style.display = 'none';
                lowStockProducts
                    .sort((a, b) => a.stock - b.stock)
                    .forEach(product => {
                        const itemElement = document.createElement('div');
                        itemElement.className = 'low-stock-item p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer';
                        itemElement.dataset.productId = product.id;
                        itemElement.innerHTML = `
                            <div class="flex justify-between items-center">
                                <div>
                                    <p class="font-semibold text-indigo-700">${product.name}</p>
                                    <p class="text-xs text-slate-500">${product.id}</p>
                                </div>
                                <span class="text-lg font-bold text-red-600">${product.stock} units</span>
                            </div>
                        `;
                        lowStockList.appendChild(itemElement);
                    });
            }
        } else if (lowStockContainer) {
            lowStockContainer.style.display = 'none';
        }
    };

    const renderProductList = () => {
        const productGrid = appContent.querySelector('#product-grid');
        if (!productGrid) return;
        
        const searchInput = appContent.querySelector('#product-search-input');
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';

        productGrid.innerHTML = ''; 
        
        appContent.querySelector('#add-item-container').style.display = permissionService.can('CREATE_ITEM') ? 'block' : 'none';

        let productsFound = 0;

        inventory.forEach((product, productId) => {
            const productName = product.productName.toLowerCase();
            const sku = productId.toLowerCase();

            if (searchTerm && !productName.includes(searchTerm) && !sku.includes(searchTerm)) {
                return;
            }
            productsFound++;

            const productCard = document.createElement('div');
            productCard.className = 'product-card';
            productCard.dataset.productId = productId;

            let totalStock = 0;
            product.locations.forEach(qty => totalStock += qty);

            productCard.innerHTML = `
                <div class="product-card-placeholder"><i class="ph-bold ph-package"></i></div>
                <div class="product-card-content">
                    <h3 class="font-semibold text-lg text-indigo-700 truncate">${product.productName}</h3>
                    <p class="text-xs text-slate-500 mb-1">${productId}</p>
                    <p class="text-xs font-medium text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full inline-block mb-2">${product.category || 'Uncategorized'}</p>
                    <hr class="my-2">
                    <div class="flex justify-between items-center text-sm font-semibold">
                        <span>Total Stock:</span>
                        <span>${totalStock} units</span>
                    </div>
                </div>
            `;
            productGrid.appendChild(productCard);
        });

        if (productsFound === 0) {
            if (inventory.size === 0) {
                productGrid.innerHTML = `<p class="text-slate-500 lg:col-span-3">No products in inventory. ${permissionService.can('CREATE_ITEM') ? 'Add one above!' : ''}</p>`;
            } else {
                productGrid.innerHTML = `<p class="text-slate-500 lg:col-span-3">No products found matching "${searchTerm}".</p>`;
            }
        }
    };

    const renderProductDetail = (productId) => {
        const product = inventory.get(productId);
        if (!product) {
            showError(`Product ${productId} not found.`);
            return navigateTo('products');
        }

        appContent.querySelector('#detail-product-name').textContent = product.productName;
        appContent.querySelector('#detail-product-id').textContent = productId;
        appContent.querySelector('#update-product-id').value = productId;

        const price = product.price || 0;
        appContent.querySelector('#detail-product-price').textContent = `₹${price.toFixed(2)}`;
        appContent.querySelector('#detail-product-category').textContent = product.category || 'Uncategorized';


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
    };

    const renderItemHistory = (productId) => {
        const historyDisplay = appContent.querySelector('#item-history-display');
        historyDisplay.innerHTML = '';
        
        const itemHistory = blockchain
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
        
        [...blockchain].reverse().forEach(block => {
            if (block.transaction.txType === 'GENESIS') return;
            ledgerDisplay.appendChild(createLedgerBlockElement(block));
        });
    };
    
    const renderAdminPanel = async () => {
        const tableBody = appContent.querySelector('#user-management-table');
        tableBody.innerHTML = '<tr><td colspan="4" class="table-cell text-center">Loading users...</td></tr>';
        let usersDb = [];
        try {
            const response = await fetch(`${API_BASE_URL}/api/users`, {
                credentials: 'include'
            });
            if (!response.ok) {
                throw new Error('Failed to fetch users');
            }
            // Map DB fields to frontend expected fields
            const dbUsers = await response.json();
            usersDb = dbUsers.map(user => ({
                id: user.id,
                employeeId: user.employee_id, // map DB field to frontend
                name: user.name,
                email: user.email,
                role: user.role
            }));
        } catch (error) {
            showError('Error loading users and no fallback available.');
            tableBody.innerHTML = `<tr><td colspan="4" class="table-cell text-center text-red-600">Error loading users.</td></tr>`;
            return;
        }
        tableBody.innerHTML = '';
        usersDb.forEach(user => {
            const row = document.createElement('tr');
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

    const createLedgerBlockElement = (block) => {
        const blockElement = document.createElement('div');
        blockElement.className = 'border border-slate-200 rounded-lg p-3 bg-white shadow-sm';
        
        const { txType, itemSku, itemName, quantity, fromLocation, toLocation, location, userName, employeeId, beforeQuantity, afterQuantity, price, category } = block.transaction;
        let transactionHtml = '';
        let detailsHtml = '';

        switch (txType) {
            case 'CREATE_ITEM':
                transactionHtml = `<span class="font-semibold text-green-700">CREATE</span> <strong>${quantity}</strong> of <strong>${itemName}</strong> (${itemSku}) to <strong>${toLocation}</strong>`;
                detailsHtml = `<li>User: <strong>${userName}</strong> (${employeeId})</li>
                               <li>Price: <strong>₹${(price || 0).toFixed(2)}</strong></li>
                               <li>Category: <strong>${category || 'N/A'}</strong></li>`;
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
                               <li>User: S<strong>${userName}</strong> (${employeeId})</li>`;
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
    // (This section is unchanged)
    
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

    /**
     * *** MODIFIED: This function now populates BOTH the select and the input field. ***
     */
    const populateLoginDropdown = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/users`);
            if (!response.ok) {
                const err = await response.json();
                if (err.message === 'Not authenticated') {
                    throw new Error('Failed to fetch users. (Hint: Make GET /api/users public on server.js)');
                }
                throw new Error(err.message || 'Failed to fetch users');
            }
            const users = await response.json();
            loginEmailSelect.innerHTML = '';
            users.forEach((user, index) => {
                const option = document.createElement('option');
                option.value = user.email;
                option.textContent = `${user.name} (${user.role})`;
                loginEmailSelect.appendChild(option);
                if (index === 0) {
                    loginEmailInput.value = user.email;
                }
            });
        } catch (error) {
            console.error(error.message);
            showError('Could not load users from database.');
            loginEmailSelect.innerHTML = '<option value="">Could not load users</option>';
            loginEmailInput.value = '';
            loginEmailInput.placeholder = 'Error loading users';
        }
    };


    // --- INITIALIZATION ---
    // Always try to populate dropdown from database (API)
    await populateLoginDropdown();
    await authService.init(showApp, showLogin);
});