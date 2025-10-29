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
}