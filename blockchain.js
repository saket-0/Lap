/**
 * Converts an ArrayBuffer to a hexadecimal string.
 * @param {ArrayBuffer} buffer The buffer to convert.
 * @returns {string} The hexadecimal string.
 */
function bufferToHex(buffer) {
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Calculates the SHA-256 hash of a given data object.
 * This is an asynchronous function.
 * @param {object} data The data to hash.
 * @returns {Promise<string>} A promise that resolves to the hexadecimal hash string.
 */
async function calculateHash(data) {
    // Create a canonical, ordered string for consistent hashing
    const str = JSON.stringify(data, Object.keys(data).sort());
    
    // Encode the string as a UTF-8 byte array
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(str);
    
    // Use the browser's built-in crypto API to calculate the hash
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    
    // Convert the resulting ArrayBuffer to a hex string
    return bufferToHex(hashBuffer);
}

/**
 * Creates a new block object.
 * This is now an asynchronous function.
 * @param {number} index - The block's position in the chain.
 * @param {object} transaction - The data for this block (must be the full, rich object).
 * @param {string} previousHash - The hash of the preceding block.
 * @returns {Promise<object>} A promise that resolves to the new block object.
 */
async function createBlock(index, transaction, previousHash) {
    const timestamp = new Date().toISOString();
    
    // Create the block *data* that will be hashed
    const blockData = {
        index,
        timestamp,
        transaction,
        previousHash,
    };
    
    // The hash is calculated asynchronously from the block's data
    const hash = await calculateHash(blockData);
    
    // Return the full block, including its new hash
    return { ...blockData, hash };
}

/**
 * Creates the first (Genesis) block of the chain.
 * This is now an asynchronous function.
 * @returns {Promise<object>} A promise that resolves to the Genesis block.
 */
async function createGenesisBlock() {
    // Await the asynchronous createBlock function
    return await createBlock(0, { txType: "GENESIS" }, "0");
}

/**
 * Verifies the integrity of the entire blockchain.
 * This is now an asynchronous function.
 * @param {Array<object>} blockchainArray - The array of blocks to verify.
 * @returns {Promise<boolean>} A promise that resolves to true if valid, false if tampered.
 */
async function isChainValid(blockchainArray) {
    // Iterate from the first block after Genesis
    for (let i = 1; i < blockchainArray.length; i++) {
        const currentBlock = blockchainArray[i];
        const previousBlock = blockchainArray[i - 1];

        // 1. Check if the stored previousHash matches the actual previous block's hash
        if (currentBlock.previousHash !== previousBlock.hash) {
            console.error(`Chain invalid: previousHash mismatch at block ${i}. Expected ${previousBlock.hash} but got ${currentBlock.previousHash}`);
            return false;
        }

        // 2. Re-calculate the hash of the current block and check if it matches the stored hash
        const blockDataToRecalculate = {
            index: currentBlock.index,
            timestamp: currentBlock.timestamp,
            transaction: currentBlock.transaction,
            previousHash: currentBlock.previousHash,
        };
        // Await the asynchronous hash calculation
        const recalculatedHash = await calculateHash(blockDataToRecalculate);

        if (currentBlock.hash !== recalculatedHash) {
            console.error(`Chain invalid: Hash mismatch at block ${i}. Expected ${currentBlock.hash} but got ${recalculatedHash}`);
            return false;
        }
    }
    // If all blocks pass, the chain is valid
    return true;
}