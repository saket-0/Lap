// All functions and vars are global
// dom.js, ui.js, navigation.js, core.js

async function handleLogin(e) {
    e.preventDefault();
    const email = loginEmailInput.value; // Use the input field
    const password = document.getElementById('login-password').value;
    await authService.login(email, password, showApp, showError);
}

async function handleQuickLogin() {
    const email = loginEmailSelect.value; // Use the select field
    const password = "password"; // Hardcoded password
    await authService.login(email, password, showApp, showError);
}

function handleLogout() {
    authService.logout(showLogin);
}