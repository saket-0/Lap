const renderItemHistory = (productId) => {
    // blockchain is global from core.js
    // appContent is global from dom.js
    // createLedgerBlockElement is global from _common.js
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
}

const renderProductDetail = (productId) => {
    // inventory, permissionService are global from core.js
    // appContent is global from dom.js
    // showError is global from ui.js
    // navigateTo is global from navigation.js
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
}