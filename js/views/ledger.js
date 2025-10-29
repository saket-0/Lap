const renderFullLedger = () => {
    // blockchain is global from core.js
    // appContent is global from dom.js
    // createLedgerBlockElement is global from _common.js
    const ledgerDisplay = appContent.querySelector('#full-ledger-display');
    ledgerDisplay.innerHTML = '';
    
    [...blockchain].reverse().forEach(block => {
        if (block.transaction.txType === 'GENESIS') return;
        ledgerDisplay.appendChild(createLedgerBlockElement(block));
    });
}