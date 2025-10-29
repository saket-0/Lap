// --- STATE MANAGEMENT ---
let blockchain = [];
let inventory = new Map(); // The "World State"
let currentUser = null;
// let usersDb = []; // *** MODIFIED: This is no longer needed; it's managed by the backend.

// *** MODIFIED: Define the base URL for your backend server ***
const API_BASE_URL = 'http://localhost:3000';

// --- SERVICES (Simulating Backend Logic) ---

/**
 * Authentication Service (Mock)
 * Note: It takes UI functions as parameters (dependency injection)
 * so this core file doesn't need to know about the DOM.
 */
const authService = {
    /**
     * *** MODIFIED: Checks for an existing server-side session. ***
     */
    init: async (showAppCallback, showLoginCallback) => {
        try {
            // Check if we have a valid session cookie with the server
            const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
                credentials: 'include' // This is essential for sending cookies
            });
            
            if (!response.ok) {
                // No valid session
                throw new Error('Not authenticated');
            }
            
            currentUser = await response.json(); // Server sends back the user object
            await showAppCallback(); // User is logged in, show the app
        
        } catch (error) {
            console.warn('No active session:', error.message);
            showLoginCallback(); // No user, show login
        }
    },
    
    /**
     * *** MODIFIED: Logs in by sending credentials to the backend. ***
     */
    login: async (email, password, showAppCallback, showErrorCallback) => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include', // This is essential for session cookies
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Login failed');
            }

            currentUser = data.user; // Backend sends back the user object
            await showAppCallback(); // Show the app

        } catch (error) {
            showErrorCallback(error.message);
        }
    },

    /**
     * *** MODIFIED: Logs out by invalidating the server session. ***
     */
    logout: async (showLoginCallback) => { // *** Made async ***
        try {
            // Tell the server to destroy the session
            await fetch(`${API_BASE_URL}/api/auth/logout`, {
                method: 'POST',
                credentials: 'include' // This is essential for session cookies
            });
        } catch (error) {
            console.error('Error logging out:', error);
        } finally {
            currentUser = null;
            // localStorage.removeItem(AUTH_KEY); // *** MODIFIED: This is no longer needed ***
            showLoginCallback();
        }
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
// (This section remains unchanged as blockchain is still local)

const addTransactionToChain = async (transaction) => {
    const index = blockchain.length;
    const previousHash = blockchain[blockchain.length - 1].hash;
    const newBlock = await createBlock(index, transaction, previousHash);
    blockchain.push(newBlock);
    saveBlockchain();
};

const processTransaction = (transaction, suppressErrors = false, showErrorCallback) => {
    const { txType, itemSku, itemName, quantity, fromLocation, toLocation, location, price, category } = transaction;

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
                    price: price || 0,
                    category: category || 'Uncategorized',
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
            if (fromLocation === toLocation) {
                 if (showErrorCallback) showErrorCallback(`Cannot move item to its current location.`, suppressErrors);
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
// (This section remains unchanged)

const saveBlockchain = () => {
    try {
        localStorage.setItem(DB_KEY, JSON.stringify(blockchain));
    } catch (e) {
        console.error("Failed to save blockchain:", e);
    }
};

const loadBlockchain = async () => {
    const savedChain = localStorage.getItem(DB_KEY);
    if (savedChain) {
        try {
            blockchain = JSON.parse(savedChain);
            if (blockchain.length === 0) throw new Error("Empty chain");
        } catch (e) {
            console.error("Failed to parse saved blockchain:", e);
            localStorage.removeItem(DB_KEY);
            blockchain = [await createGenesisBlock()];
            saveBlockchain();
        }
    } else {
        blockchain = [await createGenesisBlock()];
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

// Expose key globals for module-based frontend (modules can't see top-level const/let)
window.authService = authService;
window.permissionService = permissionService;
window.currentUser = currentUser;
window.loadBlockchain = loadBlockchain;
window.rebuildInventoryState = rebuildInventoryState;
window.API_BASE_URL = API_BASE_URL;