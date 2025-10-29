// --- NAVIGATION & UI CONTROL ---
// All functions and vars are global from other files
// dom.js, ui.js, core.js, all view files

const showLogin = () => {
    loginOverlay.style.display = 'flex';
    appWrapper.classList.add('hidden');
};

const showApp = async () => {
    loginOverlay.style.display = 'none';
    appWrapper.classList.remove('hidden');
    
    const user = currentUser;
    userNameEl.textContent = user.name;
    userRoleEl.textContent = user.role;
    userEmployeeIdEl.textContent = user.employeeId;

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