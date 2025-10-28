document.addEventListener('DOMContentLoaded', () => {
    // --- DATA STRUCTURES ---

    // The 'blockchain' is an array of block objects
    let blockchain = [];
    
    // The 'inventory' is the current state, derived from the blockchain.
    // Format: Map<productId, { productName, locations: Map<location, quantity> }>
    let inventory = new Map();
    
    // Available locations
    const locations = ["Supplier", "Warehouse", "Retailer"];
    const DB_KEY = 'inventoryChain'; // Key for localStorage

    // --- DOM ELEMENTS ---
    const addItemForm = document.getElementById('add-item-form');
    const moveItemForm = document.getElementById('move-item-form');
    const clearDbButton = document.getElementById('clear-db-button');
    const verifyChainButton = document.getElementById('verify-chain-button');
    const inventoryDisplay = document.getElementById('inventory-display');
    const ledgerDisplay = document.getElementById('ledger-display');
    const moveProductIdSelect = document.getElementById('move-product-id');
    
    // Toast Elements
    const errorToast = document.getElementById('error-toast');
    const errorMessage = document.getElementById('error-message');
    const successToast = document.getElementById('success-toast');
    const successMessage = document.getElementById('success-message');

    // --- CORE LOGIC ---

    /**
     * Creates a new block, adds it to the chain, and saves the chain.
     * This function uses helpers from blockchain.js
     * @param {object} transaction - The transaction data.
     */
    const addTransactionToChain = (transaction) => {
        const index = blockchain.length;
        const previousHash = blockchain[blockchain.length - 1].hash;
        
        // createBlock is from blockchain.js
        const newBlock = createBlock(index, transaction, previousHash); 
        
        blockchain.push(newBlock);
        saveBlockchain(); // Save to localStorage on every new block
    };

    /**
     * Processes a transaction, validates it, and updates the inventory state.
     * Returns true on success, false on failure.
     * @param {object} transaction - The transaction object.
     * @param {boolean} [suppressErrors=false] - If true, do not show UI error toasts.
     */
    const processTransaction = (transaction, suppressErrors = false) => {
        const { type, productId, productName, quantity, from, to } = transaction;

        if (type === 'ADD') {
            // Get or create the product entry
            if (!inventory.has(productId)) {
                inventory.set(productId, {
                    productName: productName,
                    locations: new Map()
                });
            }
            const product = inventory.get(productId);
            
            // Update the quantity at the 'to' location
            const currentQty = product.locations.get(to) || 0;
            product.locations.set(to, currentQty + quantity);
            return true;
        
        } else if (type === 'MOVE') {
            // Check if product exists
            if (!inventory.has(productId)) {
                showError(`Product ${productId} not found in inventory.`, suppressErrors);
                return false;
            }
            const product = inventory.get(productId);
            
            // Check if 'from' location has enough quantity
            const fromQty = product.locations.get(from) || 0;
            if (fromQty < quantity) {
                showError(`Insufficient stock at ${from}. Only ${fromQty} available.`, suppressErrors);
                return false;
            }

            // Perform the move
            const toQty = product.locations.get(to) || 0;
            product.locations.set(from, fromQty - quantity);
            product.locations.set(to, toQty + quantity);
            return true;
        }
        return false;
    };
    
    // --- EVENT HANDLERS ---

    /**
     * Handles the "Add Item" form submission.
     */
    const handleAddItem = (e) => {
        e.preventDefault();
        const productId = document.getElementById('add-product-id').value;
        const productName = document.getElementById('add-product-name').value;
        const quantity = parseInt(document.getElementById('add-quantity').value, 10);
        const to = document.getElementById('add-to').value;

        if (!productId || !productName || !quantity || quantity <= 0) {
            showError("Please fill out all fields with valid data.");
            return;
        }

        const transaction = {
            type: "ADD",
            productId,
            productName,
            quantity,
            to
        };

        // Process and create block
        if (processTransaction(transaction)) {
            addTransactionToChain(transaction);
            // Re-render the UI
            render();
        }
    };

    /**
     * Handles the "Move Item" form submission.
     */
    const handleMoveItem = (e) => {
        e.preventDefault();
        const productId = document.getElementById('move-product-id').value;
        const quantity = parseInt(document.getElementById('move-quantity').value, 10);
        const from = document.getElementById('move-from').value;
        const to = document.getElementById('move-to').value;

        if (from === to) {
            showError("'From' and 'To' locations cannot be the same.");
            return;
        }
        
        if (!productId || !quantity || quantity <= 0) {
            showError("Please select a product and enter a valid quantity.");
            return;
        }

        const transaction = {
            type: "MOVE",
            productId,
            quantity,
            from,
            to
        };

        // Process and create block
        if (processTransaction(transaction)) {
            addTransactionToChain(transaction);
            // Re-render the UI
            render();
        }
    };

    /**
     * Handles clearing the database.
     */
    const handleClearDb = () => {
        localStorage.removeItem(DB_KEY);
        // Re-initialize the app state
        inventory.clear();
        loadBlockchain(); // This will create a new Genesis block
        render();
        showSuccess("Database cleared and demo reset.");
    };

    /**
     * Handles verifying the chain.
     */
    const handleVerifyChain = () => {
        // isChainValid is from blockchain.js
        const isValid = isChainValid(blockchain);
        
        if (isValid) {
            showSuccess("Verification complete: Blockchain is valid!");
        } else {
            showError("CRITICAL: Blockchain is invalid! Tampering detected.");
        }
    };

    // --- RENDERING FUNCTIONS ---
    
    /**
     * Main render function: updates all UI components.
     */
    const render = () => {
        renderInventory();
        renderBlockchain();
        updateMoveProductSelect();
    };

    /**
     * Updates the "Current Inventory" display.
     */
    const renderInventory = () => {
        inventoryDisplay.innerHTML = ''; // Clear current display
        
        if (inventory.size === 0) {
            inventoryDisplay.innerHTML = '<p class="text-slate-500">No items in inventory. Add some!</p>';
            return;
        }

        inventory.forEach((product, productId) => {
            const productCard = document.createElement('div');
            productCard.className = 'border border-slate-200 rounded-lg p-4 bg-slate-50';
            
            let locationsHtml = '';
            let totalStock = 0;

            product.locations.forEach((quantity, location) => {
                if (quantity > 0) {
                    locationsHtml += `
                        <li class="flex justify-between items-center text-sm">
                            <span class="text-slate-600">${location}:</span>
                            <span class="font-medium text-slate-800">${quantity} units</span>
                        </li>`;
                    totalStock += quantity;
                }
            });

            if (totalStock === 0) {
                locationsHtml = '<li class="text-sm text-slate-500">No stock available.</li>';
            }

            productCard.innerHTML = `
                <h3 class="font-semibold text-lg text-indigo-700">${product.productName}</h3>
                <p class="text-xs text-slate-500 mb-2">${productId}</p>
                <ul class="space-y-1">
                    ${locationsHtml}
                </ul>
                <hr class="my-2">
                <div class="flex justify-between items-center text-sm font-semibold">
                    <span>Total Stock:</span>
                    <span>${totalStock} units</span>
                </div>
            `;
            inventoryDisplay.appendChild(productCard);
        });
    };

    /**
     * Updates the "Blockchain Ledger" display.
     */
    const renderBlockchain = () => {
        ledgerDisplay.innerHTML = ''; // Clear current display

        // Display in reverse chronological order (newest first)
        [...blockchain].reverse().forEach(block => {
            const blockElement = document.createElement('div');
            blockElement.className = 'border border-slate-200 rounded-lg p-4 bg-white shadow-sm';
            
            let transactionHtml = '';
            const { type, productId, productName, quantity, from, to } = block.transaction;

            if (type === 'ADD') {
                transactionHtml = `
                    <span class="font-semibold text-green-600">ADD</span>
                    <strong>${quantity}</strong> of
                    <strong>${productName}</strong> (${productId})
                    to <strong>${to}</strong>
                `;
            } else if (type === 'MOVE') {
                transactionHtml = `
                    <span class="font-semibold text-blue-600">MOVE</span>
                    <strong>${quantity}</strong> of
                    <strong>${productId}</strong>
                    from <strong>${from}</strong>
                    to <strong>${to}</strong>
                `;
            } else if (type === 'GENESIS') {
                transactionHtml = `<span class="font-semibold text-slate-500">GENESIS BLOCK</span>`;
            }

            blockElement.innerHTML = `
                <div class="flex justify-between items-center mb-2">
                    <h4 class="font-semibold text-lg text-indigo-700">Block #${block.index}</h4>
                    <span class="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-full">${new Date(block.timestamp).toLocaleTimeString()}</span>
                </div>
                <p class="text-sm text-slate-700 mb-3">${transactionHtml}</p>
                <div class="text-xs text-slate-500 bg-slate-50 p-2 rounded-md">
                    <p class="truncate"><strong>Hash:</strong> ${block.hash}</p>
                    <p class="truncate"><strong>Prev Hash:</strong> ${block.previousHash}</p>
                </div>
            `;
            ledgerDisplay.appendChild(blockElement);
        });
    };

    /**
     * Updates the dropdown in the "Move Item" form.
     */
    const updateMoveProductSelect = () => {
        const currentVal = moveProductIdSelect.value;
        moveProductIdSelect.innerHTML = '<option value="">-- Select Product --</option>'; // Clear
        
        inventory.forEach((product, productId) => {
            // Only add products that have stock to move
            let totalStock = 0;
            product.locations.forEach(qty => totalStock += qty);

            if (totalStock > 0) {
                const option = document.createElement('option');
                option.value = productId;
                option.textContent = `${product.productName} (${productId})`;
                if (productId === currentVal) {
                    option.selected = true;
                }
                moveProductIdSelect.appendChild(option);
            }
        });
    };
    
    // --- TOAST/NOTIFICATION FUNCTIONS ---
    
    let errorTimer;
    /**
     * Shows an error message toast.
     * @param {string} message - The error message to display.
     * @param {boolean} [suppress=false] - If true, log to console but don't show toast.
     */
    const showError = (message, suppress = false) => {
        console.error(message);
        if (suppress) {
            return;
        }
        
        errorMessage.textContent = message;
        errorToast.classList.add('toast-show');

        clearTimeout(errorTimer);
        errorTimer = setTimeout(() => {
            errorToast.classList.remove('toast-show');
        }, 3000);
    };
    
    let successTimer;
    /**
     * Shows a success message toast.
     * @param {string} message - The success message to display.
     */
    const showSuccess = (message) => {
        console.log(message);
        
        successMessage.textContent = message;
        successToast.classList.add('toast-show');

        clearTimeout(successTimer);
        successTimer = setTimeout(() => {
            successToast.classList.remove('toast-show');
        }, 3000);
    };

    // --- INITIALIZATION ---

    /**
     * Saves the entire blockchain to localStorage.
     */
    const saveBlockchain = () => {
        try {
            localStorage.setItem(DB_KEY, JSON.stringify(blockchain));
        } catch (e) {
            console.error("Failed to save blockchain:", e);
            showError("Could not save data. LocalStorage may be full.");
        }
    };

    /**
     * Loads the blockchain from localStorage.
     * If no chain exists, it creates the Genesis block.
     */
    const loadBlockchain = () => {
        const savedChain = localStorage.getItem(DB_KEY);
        if (savedChain) {
            try {
                blockchain = JSON.parse(savedChain);
            } catch (e) {
                console.error("Failed to parse saved blockchain:", e);
                localStorage.removeItem(DB_KEY); // Clear corrupted data
                blockchain = [];
                // createGenesisBlock is from blockchain.js
                blockchain.push(createGenesisBlock()); 
                saveBlockchain();
            }
        } else {
            blockchain = [];
            // createGenesisBlock is from blockchain.js
            blockchain.push(createGenesisBlock());
            saveBlockchain();
        }
    };

    /**
     * Re-calculates the current inventory state by processing the entire blockchain.
     */
    const rebuildInventoryState = () => {
        inventory.clear(); // Reset the in-memory state
        // Re-process every transaction *except* the Genesis block
        for (let i = 1; i < blockchain.length; i++) {
            if (blockchain[i] && blockchain[i].transaction) {
                // Pass 'true' to suppress errors during this rebuild phase
                processTransaction(blockchain[i].transaction, true); 
            }
        }
    };

    // Initialize the app
    loadBlockchain();
    rebuildInventoryState();
    render();

    // Bind event listeners
    addItemForm.addEventListener('submit', handleAddItem);
    moveItemForm.addEventListener('submit', handleMoveItem);
    clearDbButton.addEventListener('click', handleClearDb);
    verifyChainButton.addEventListener('click', handleVerifyChain);
});
