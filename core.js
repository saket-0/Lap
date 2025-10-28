// --- STATE MANAGEMENT ---
let blockchain = [];
let inventory = new Map(); // The "World State"
let currentUser = null;
let usersDb = [];

// --- SERVICES (Simulating Backend Logic) ---

/**
 * Authentication Service (Mock)
 * Note: It takes UI functions as parameters (dependency injection)
 * so this core file doesn't need to know about the DOM.
 */
const authService = {
    init: (showAppCallback, showLoginCallback) => {
        // Populate users DB (simulates user table)
        if (!localStorage.getItem(USERS_KEY)) {
            localStorage.setItem(USERS_KEY, JSON.stringify(MOCK_USERS));
        }
        usersDb = JSON.parse(localStorage.getItem(USERS_KEY));

        // Check for logged-in user
        const savedUser = localStorage.getItem(AUTH_KEY);
        if (savedUser) {
            currentUser = JSON.parse(savedUser);
            showAppCallback();
        } else {
            showLoginCallback();
        }
    },
    login: (email, password, showAppCallback, showErrorCallback) => {
        if (password !== 'password') {
            showErrorCallback("Invalid password. (Hint: use 'password')");
            return;
        }
        const user = usersDb.find(u => u.email === email);
        if (user) {
            currentUser = user;
            localStorage.setItem(AUTH_KEY, JSON.stringify(currentUser));
            showAppCallback();
        } else {
            showErrorCallback("User not found.");
        }
    },
    logout: (showLoginCallback) => {
        currentUser = null;
        localStorage.removeItem(AUTH_KEY);
        showLoginCallback();
    }
};

/**
 * Permission Service (Mock)
 */
const permissionService = {
    can: (action) => {
        if (!currentUser) return false;
        const role = currentUser.role;

        switch (action) {
            case 'VIEW_DASHBOARD':
                return true;
            case 'VIEW_PRODUCTS':
                return true;
            case 'CREATE_ITEM':
                return role === 'Admin';
            case 'UPDATE_STOCK': // Add, Remove, Move
                return role === 'Admin' || role === 'Inventory Manager';
            case 'VIEW_ITEM_HISTORY':
                return true;
            case 'VIEW_ADMIN_PANEL':
                return role === 'Admin';
            case 'MANAGE_USERS':
                return role === 'Admin';
            case 'VIEW_LEDGER':
                return role === 'Admin' || role === 'Auditor';
            case 'VERIFY_CHAIN':
                return role === 'Admin' || role === 'Auditor';
            case 'CLEAR_DB':
                return role === 'Admin';
            default:
                return false;
        }
    }
};

// --- CORE LOGIC (Blockchain & Inventory) ---

const addTransactionToChain = (transaction) => {
    const index = blockchain.length;
    const previousHash = blockchain[blockchain.length - 1].hash;
    const newBlock = createBlock(index, transaction, previousHash); // from blockchain.js
    blockchain.push(newBlock);
    saveBlockchain();
};

const processTransaction = (transaction, suppressErrors = false, showErrorCallback) => {
    const { txType, itemSku, itemName, quantity, fromLocation, toLocation, location } = transaction;

    let product;
    if (txType !== 'CREATE_ITEM' && !inventory.has(itemSku)) {
        if (showErrorCallback) showErrorCallback(`Product ${itemSku} not found.`, suppressErrors);
        return false;
    }
    
    if (txType !== 'CREATE_ITEM') {
        product = inventory.get(itemSku);
    }

    switch (txType) {
        case 'CREATE_ITEM':
            if (inventory.has(itemSku) && !suppressErrors) {
                if (showErrorCallback) showErrorCallback(`Product SKU ${itemSku} already exists.`);
                return false;
            }
            if (!inventory.has(itemSku)) {
                 inventory.set(itemSku, {
                    productName: itemName,
                    locations: new Map()
                });
            }
            product = inventory.get(itemSku);
            const currentAddQty = product.locations.get(toLocation) || 0;
            product.locations.set(toLocation, currentAddQty + quantity);
            return true;
    
        case 'MOVE':
            const fromQty = product.locations.get(fromLocation) || 0;
            if (fromQty < quantity) {
                if (showErrorCallback) showErrorCallback(`Insufficient stock at ${fromLocation}. Only ${fromQty} available.`, suppressErrors);
                return false;
            }
            const toQty = product.locations.get(toLocation) || 0;
            product.locations.set(fromLocation, fromQty - quantity);
            product.locations.set(toLocation, toQty + quantity);
            return true;
        
        case 'STOCK_IN':
            const currentStockInQty = product.locations.get(location) || 0;
            product.locations.set(location, currentStockInQty + quantity);
            return true;
        
        case 'STOCK_OUT':
            const currentStockOutQty = product.locations.get(location) || 0;
            if (currentStockOutQty < quantity) {
                if (showErrorCallback) showErrorCallback(`Insufficient stock at ${location}. Only ${currentStockOutQty} available.`, suppressErrors);
                return false;
            }
            product.locations.set(location, currentStockOutQty - quantity);
            return true;
    }
    return false;
};

// --- INITIALIZATION & DB HELPERS ---

const saveBlockchain = () => {
    try {
        localStorage.setItem(DB_KEY, JSON.stringify(blockchain));
    } catch (e) {
        console.error("Failed to save blockchain:", e);
        // We need a way to show errors. We'll pass the UI callback.
        // This is getting complex. For now, we'll just console.error.
        // A better long-term solution is a proper event bus.
    }
};

const loadBlockchain = () => {
    const savedChain = localStorage.getItem(DB_KEY);
    if (savedChain) {
        try {
            blockchain = JSON.parse(savedChain);
            if (blockchain.length === 0) throw new Error("Empty chain");
        } catch (e) {
            console.error("Failed to parse saved blockchain:", e);
            localStorage.removeItem(DB_KEY);
            blockchain = [createGenesisBlock()];
            saveBlockchain();
        }
    } else {
        blockchain = [createGenesisBlock()];
        saveBlockchain();
    }
};

const rebuildInventoryState = () => {
    inventory.clear();
    for (let i = 1; i < blockchain.length; i++) {
        if (blockchain[i] && blockchain[i].transaction) {
            processTransaction(blockchain[i].transaction, true, null); // Suppress errors on rebuild
        }
    }
};