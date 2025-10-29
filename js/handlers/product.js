// All functions and vars are global
// ui.js, views/productList.js, views/productDetail.js, core.js

async function handleAddItem(form) {
    if (!permissionService.can('CREATE_ITEM')) return showError("Access Denied.");
    
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
}

async function handleUpdateStock(form) {
    if (!permissionService.can('UPDATE_STOCK')) return showError("Access Denied.");
    
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
}

async function handleMoveStock(form) {
    if (!permissionService.can('UPDATE_STOCK')) return showError("Access Denied.");
    
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
}