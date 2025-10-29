const renderProductList = () => {
    // inventory, permissionService are global from core.js
    // appContent is global from dom.js
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
}