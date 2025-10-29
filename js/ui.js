// --- TOAST/NOTIFICATION FUNCTIONS (UI LOGIC) ---
let errorTimer;
const showError = (message, suppress = false) => {
    console.error(message);
    if (suppress) return;
    // dom elements are global from dom.js
    errorMessage.textContent = message;
    errorToast.classList.add('toast-show');
    clearTimeout(errorTimer);
    errorTimer = setTimeout(() => errorToast.classList.remove('toast-show'), 3000);
};

let successTimer;
const showSuccess = (message) => {
    console.log(message);
    successMessage.textContent = message;
    successToast.classList.add('toast-show');
    clearTimeout(successTimer);
    successTimer = setTimeout(() => successToast.classList.remove('toast-show'), 3000);
};

const populateLoginDropdown = async () => {
    try {
        // API_BASE_URL is global from config.js (or core.js)
        // dom elements are global from dom.js
        const response = await fetch(`${API_BASE_URL}/api/users`);
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || 'Failed to fetch users');
        }
        
        const users = await response.json();
        
        loginEmailSelect.innerHTML = ''; // Clear select
        
        users.forEach((user, index) => {
            const option = document.createElement('option');
            option.value = user.email;
            option.textContent = `${user.name} (${user.role})`;
            loginEmailSelect.appendChild(option);

            if (index === 0) {
                loginEmailInput.value = user.email;
            }
        });
    
    } catch (error) {
        console.error(error.message);
        showError(error.message, true); // Suppress toast on initial load
        loginEmailSelect.innerHTML = '<option value="">Could not load users</option>';
        loginEmailInput.value = '';
        loginEmailInput.placeholder = 'Error loading users';
    }
};