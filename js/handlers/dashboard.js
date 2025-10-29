// All functions and vars are global
// ui.js, navigation.js, core.js, config.js, blockchain.js

async function handleClearDb() {
    if (!permissionService.can('CLEAR_DB')) return showError("Access Denied.");
    
    localStorage.removeItem(DB_KEY);
    inventory.clear();
    await loadBlockchain();
    // Re-init auth, which will call showApp or showLogin
    await authService.init(
        () => { // Custom showApp
            navigateTo('dashboard');
            showSuccess("Local blockchain cleared.");
        },
        () => { // Custom showLogin
            showSuccess("Local blockchain cleared. Please log in.");
        }
    );
    
    if (!currentUser) {
        await populateLoginDropdown();
    }
}

async function handleVerifyChain() {
    if (!permissionService.can('VERIFY_CHAIN')) return showError("Access Denied.");
    
    // isChainValid is global from blockchain.js
    const isValid = await isChainValid(blockchain);
    if (isValid) {
        showSuccess("Verification complete: Blockchain is valid!");
    } else {
        showError("CRITICAL: Blockchain is invalid! Tampering detected.");
    }
}