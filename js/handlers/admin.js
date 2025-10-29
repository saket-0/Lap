// All functions and vars are global
// ui.js, views/admin.js, navigation.js, core.js

async function handleRoleChange(userId, newRole) {
    if (!permissionService.can('MANAGE_USERS')) return showError("Access Denied.");
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/users/${userId}/role`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ role: newRole })
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Failed to update role');
        }
        showSuccess(`Role for ${data.user.name} updated to ${newRole}.`);
        
        if (data.user.id === currentUser.id) { 
            currentUser = data.user; // Update global
            await showApp(); // Re-render app to hide/show nav links
        }
    } catch (error) {
        showError(error.message);
        renderAdminPanel(); // On error, re-render to reset the dropdown
    }
}

async function handleAddUser(form) {
    if (!permissionService.can('MANAGE_USERS')) return showError("Access Denied.");
    
    const name = form.querySelector('#add-user-name').value;
    const email = form.querySelector('#add-user-email').value;
    const employeeId = form.querySelector('#add-user-employee-id').value;
    const role = form.querySelector('#add-user-role').value;
    const password = form.querySelector('#add-user-password').value;

    try {
        const response = await fetch(`${API_BASE_URL}/api/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ name, email, employeeId, role, password })
        });
        
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Failed to create user');
        }
        
        showSuccess(`User ${data.user.name} created successfully!`);
        form.reset();
        renderAdminPanel(); // Refresh the user list
        await populateLoginDropdown(); // Refresh login dropdown
        
    } catch (error) {
        showError(error.message);
    }
}