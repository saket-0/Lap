const renderDashboard = () => {
    // inventory, blockchain, permissionService are global from core.js
    // appContent is global from dom.js
    // createLedgerBlockElement is global from _common.js
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
}