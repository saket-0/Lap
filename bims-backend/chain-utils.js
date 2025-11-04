// Lap/bims-backend/chain-utils.js
const crypto = require('crypto');

/**
 * Calculates the SHA-256 hash of a given data object (Node.js version).
 * This function is UNCHANGED, but our inputs to it will be fixed.
 * @param {object} data The data to hash.
 * @returns {Promise<string>} A promise that resolves to the hexadecimal hash string.
 */
async function calculateHash(data) {
    // Create a canonical, ordered string for consistent hashing
    // This sorts the top-level keys: index, previousHash, timestamp, transaction
    const str = JSON.stringify(data, Object.keys(data).sort());
    
    // Use Node.js's built-in crypto module
    const hash = crypto.createHash('sha256').update(str).digest('hex');
    return hash;
}

/**
 * Creates a new block object.
 * @param {number} index - The block's position in the chain.
 * @param {object} transaction - The data for this block (must be the full, rich object).
 * @param {string} previousHash - The hash of the preceding block.
 * @returns {Promise<object>} A promise that resolves to the new block object.
 */
async function createBlock(index, transaction, previousHash) {
    const timestamp = new Date().toISOString(); // Timestamp is a string
    
    // --- START: FIX ---
    // Create a new, sorted transaction object to ensure consistent hashing
    const sortedTransaction = Object.keys(transaction)
        .sort()
        .reduce((obj, key) => {
            obj[key] = transaction[key];
            return obj;
        }, {});
    // --- END: FIX ---

    // Create the block *data* that will be hashed
    const blockData = {
        index,
        timestamp,
        transaction: sortedTransaction, // Use the sorted transaction object
        previousHash,
    };
    
    // The hash is calculated asynchronously from the block's data
    const hash = await calculateHash(blockData);
    
    // Return the full block, including its new hash
    return { ...blockData, hash };
}

/**
 * Creates the first (Genesis) block of the chain.
 * (This function is simple enough that it doesn't need the sort fix)
 * @returns {Promise<object>} A promise that resolves to the Genesis block.
 */
async function createGenesisBlock() {
    return await createBlock(0, { txType: "GENESIS" }, "0");
}

/**
 * Verifies the integrity of the entire blockchain.
 * @param {Array<object>} blockchainArray - The array of blocks to verify.
 * @returns {Promise<boolean>} A promise that resolves to true if valid, false if tampered.
 */
async function isChainValid(blockchainArray) {
    for (let i = 1; i < blockchainArray.length; i++) {
        const currentBlock = blockchainArray[i];
        const previousBlock = blockchainArray[i - 1];

        // 1. Check if the stored previousHash matches the actual previous block's hash
        if (currentBlock.previousHash !== previousBlock.hash) {
            console.error(`Chain invalid: previousHash mismatch at block ${i}.`);
            return false;
        }

        // --- START: FIX ---
        // Create a new, sorted transaction object from the DB data
        // to ensure the re-calculated hash matches the original.
        const sortedTransaction = Object.keys(currentBlock.transaction)
            .sort()
            .reduce((obj, key) => {
                obj[key] = currentBlock.transaction[key];
                return obj;
            }, {});
        // --- END: FIX ---

        // 2. Re-calculate the hash of the current block
        const blockDataToRecalculate = {
            index: currentBlock.index,
            timestamp: currentBlock.timestamp, // This is a Date object from PG
            transaction: sortedTransaction, // Use the sorted transaction object
            previousHash: currentBlock.previousHash,
        };
        
        // Await the asynchronous hash calculation
        // JSON.stringify() will correctly convert the Date object to an
        // ISO string, matching the string format used during creation.
        const recalculatedHash = await calculateHash(blockDataToRecalculate);

        if (currentBlock.hash !== recalculatedHash) {
            console.error(`Chain invalid: Hash mismatch at block ${i}. Expected ${currentBlock.hash} but got ${recalculatedHash}`);
            return false;
        }
    }
    // If all blocks pass, the chain is valid
    return true;
}


// --- (The rest of the file is unchanged) ---


/**
 * This is the server-side validator, moved from core.js
 * It rebuilds the state from the chain and validates a new transaction.
 */
function validateTransaction(transaction, currentChain) {
    // 1. Rebuild the "world state" (inventory) from the existing chain
    const inventory = new Map();
    for (let i = 1; i < currentChain.length; i++) { // Skip Genesis
        if (currentChain[i] && currentChain[i].transaction) {
            // Run the processor in a "muted" state (no errors)
            processTransaction(currentChain[i].transaction, inventory, true, null); 
        }
    }

    // 2. Process the new transaction against that state
    const errorCallback = (message) => { throw new Error(message); };
    
    try {
        const success = processTransaction(transaction, inventory, false, errorCallback);
        return { success: success, error: null };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * This is the core logic from core.js, now running on the server.
 * Note: It modifies the inventory map directly.
 */
const processTransaction = (transaction, inventory, suppressErrors = false, showErrorCallback) => {
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


module.exports = {
    calculateHash,
    createBlock,
    createGenesisBlock,
    isChainValid,
    validateTransaction
};