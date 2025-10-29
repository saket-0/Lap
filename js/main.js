// --- INITIALIZATION ---
// All functions and vars are global from other files
document.addEventListener('DOMContentLoaded', async () => {
    
    // --- DOM ELEMENT ASSIGNMENT ---
    // Now we assign the variables AFTER the DOM is loaded.
    loginOverlay = document.getElementById('login-overlay');
    loginForm = document.getElementById('login-form');
    loginEmailInput = document.getElementById('login-email-input');
    loginEmailSelect = document.getElementById('login-email-select');
    quickLoginButton = document.getElementById('quick-login-button');
    appWrapper = document.getElementById('app-wrapper');
    appContent = document.getElementById('app-content');
    logoutButton = document.getElementById('logout-button');
    userNameEl = document.getElementById('user-name');
    userRoleEl = document.getElementById('user-role');
    userEmployeeIdEl = document.getElementById('user-employee-id');

    navLinks = {
        dashboard: document.getElementById('nav-dashboard'),
        products: document.getElementById('nav-products'),
        admin: document.getElementById('nav-admin'),
        ledger: document.getElementById('nav-ledger'),
    };

    errorToast = document.getElementById('error-toast');
    errorMessage = document.getElementById('error-message');
    successToast = document.getElementById('success-toast');
    successMessage = document.getElementById('success-message');

    templates = {
        dashboard: document.getElementById('dashboard-view-template'),
        productList: document.getElementById('product-list-view-template'),
        productDetail: document.getElementById('product-detail-view-template'),
        admin: document.getElementById('admin-view-template'),
        ledger: document.getElementById('ledger-view-template'),
    };

    // --- STATIC EVENT HANDLERS ---
    // (This section is now guaranteed to work)
    
    // Login
    loginForm.addEventListener('submit', handleLogin);
    quickLoginButton.addEventListener('click', handleQuickLogin);
    loginEmailSelect.addEventListener('change', () => {
        loginEmailInput.value = loginEmailSelect.value;
    });

    // App shell
    logoutButton.addEventListener('click', handleLogout);
    navLinks.dashboard.addEventListener('click', (e) => { e.preventDefault(); navigateTo('dashboard'); });
    navLinks.products.addEventListener('click', (e) => { e.preventDefault(); navigateTo('products'); });
    navLinks.admin.addEventListener('click', (e) => { e.preventDefault(); navigateTo('admin'); });
    navLinks.ledger.addEventListener('click', (e) => { e.preventDefault(); navigateTo('ledger'); });

    // --- DELEGATED EVENT HANDLERS (for content inside #app-content) ---

    // Delegated 'submit' listener
    appContent.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (e.target.id === 'add-item-form') {
            await handleAddItem(e.target);
        }
        
        if (e.target.id === 'update-stock-form') {
            await handleUpdateStock(e.target);
        }

        if (e.target.id === 'move-stock-form') {
            await handleMoveStock(e.target);
        }

        if (e.target.id === 'add-user-form') {
            await handleAddUser(e.target);
        }
    });

    // Delegated 'input' listener
    appContent.addEventListener('input', (e) => {
        if (e.target.id === 'product-search-input') {
            renderProductList();
        }
    });
    
    // Delegated 'click' listener
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
            await handleClearDb();
        }
        if (e.target.closest('#verify-chain-button')) {
            await handleVerifyChain();
        }
    });

    // Delegated 'change' listener
    appContent.addEventListener('change', async (e) => {
        if (e.target.classList.contains('role-select')) {
            await handleRoleChange(e.target.dataset.userId, e.target.value);
        }
    });


    // --- START THE APP ---
    
    await populateLoginDropdown();
    // authService, showApp, and showLogin are all global
    await authService.init(showApp, showLogin);
});