/**
 * A simple (and insecure) hash function for demonstration.
 * In a real blockchain, this would be a cryptographic hash like SHA-256.
 * This function is internal to this module and not exported.
 */
const simpleHash = (data) => {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return '0x' + Math.abs(hash).toString(16);
};

/**
 * Creates a new block object.
 * @param {number} index - The block's position in the chain.
 * @param {object} transaction - The data for this block.
 * @param {string} previousHash - The hash of the preceding block.
 * @returns {object} A new block object with its hash calculated.
 */
function createBlock(index, transaction, previousHash) {
    const timestamp = new Date().toISOString();
    const blockData = {
        index,
        timestamp,
        transaction,
        previousHash,
    };
    // The hash is calculated from the block's data
    const hash = simpleHash(blockData);
    return { ...blockData, hash };
}

/**
 * Creates the first (Genesis) block of the chain.
 * @returns {object} The Genesis block.
 */
function createGenesisBlock() {
    // A Genesis block has index 0, a 'GENESIS' transaction, and a '0' previous hash
    return createBlock(0, { type: "GENESIS" }, "0");
}

/**
 * Verifies the integrity of the entire blockchain.
 * @param {Array<object>} blockchainArray - The array of blocks to verify.
 * @returns {boolean} True if the chain is valid, false if tampered.
 */
function isChainValid(blockchainArray) {
    // Iterate from the first block after Genesis
    for (let i = 1; i < blockchainArray.length; i++) {
        const currentBlock = blockchainArray[i];
        const previousBlock = blockchainArray[i - 1];

        // 1. Check if the stored previousHash matches the actual previous block's hash
        if (currentBlock.previousHash !== previousBlock.hash) {
            console.error("Chain invalid: previousHash mismatch at block " + i);
            return false;
        }

        // 2. Re-calculate the hash of the current block and check if it matches the stored hash
        // This detects if the block's *data* (like the transaction) was changed.
        const blockDataToRecalculate = {
            index: currentBlock.index,
            timestamp: currentBlock.timestamp,
            transaction: currentBlock.transaction,
            previousHash: currentBlock.previousHash,
        };
        const recalculatedHash = simpleHash(blockDataToRecalculate);

        if (currentBlock.hash !== recalculatedHash) {
            console.error("Chain invalid: Hash mismatch at block " + i);
            return false;
        }
    }
    // If all blocks pass, the chain is valid
    return true;
}
