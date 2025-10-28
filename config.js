// --- MOCK DATABASE & AUTH ---
// (Simulating PostgreSQL tables from the SRS)

const MOCK_USERS = [
    { id: 'uuid-admin-001', employeeId: 'EMP-20251029-0001', name: 'Dr. Evelyn Reed', email: 'admin@bims.com', role: 'Admin' },
    { id: 'uuid-manager-002', employeeId: 'EMP-20251029-0002', name: 'Marcus Cole', email: 'manager@bims.com', role: 'Inventory Manager' },
    { id: 'uuid-auditor-003', employeeId: 'EMP-20251029-0003', name: 'Anya Sharma', email: 'auditor@bims.com', role: 'Auditor' }
];

const DB_KEY = 'bimsChain'; // For the blockchain
const AUTH_KEY = 'bimsUser'; // For the current user
const USERS_KEY = 'bimsUsers'; // For the list of users (for Admin panel)