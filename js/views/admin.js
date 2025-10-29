const renderAdminPanel = async () => {
    // API_BASE_URL, currentUser are global from core.js
    // appContent is global from dom.js
    // showError is global from ui.js
    const tableBody = appContent.querySelector('#user-management-table');
    if (!tableBody) return; // In case view is changed quickly
    
    tableBody.innerHTML = '<tr><td colspan="4" class="table-cell text-center">Loading users...</td></tr>';
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/users`, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || 'Failed to fetch users');
        }
        
        const usersDb = await response.json();
        tableBody.innerHTML = '';

        usersDb.forEach(user => {
            const row = document.createElement('tr');
            const isCurrentUser = user.id === currentUser.id;
            
            row.innerHTML = `
                <td class="table-cell font-medium">${user.name}</td>
                <td class="table-cell text-slate-500">${user.employeeId}</td>
                <td class="table-cell text-slate-500">${user.email}</td>
                <td class="table-cell">
                    <select data-user-id="${user.id}" class="role-select block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500" ${isCurrentUser ? 'disabled' : ''}>
                        <option value="Admin" ${user.role === 'Admin' ? 'selected' : ''}>Admin</option>
                        <option value="Inventory Manager" ${user.role === 'Inventory Manager' ? 'selected' : ''}>Inventory Manager</option>
                        <option value="Auditor" ${user.role === 'Auditor' ? 'selected' : ''}>Auditor</option>
                    </select>
                </td>
            `;
            tableBody.appendChild(row);
        });

    } catch (error) {
        showError(error.message);
        tableBody.innerHTML = `<tr><td colspan="4" class="table-cell text-center text-red-600">Error loading users.</td></tr>`;
    }
}