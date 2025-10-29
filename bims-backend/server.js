// server.js
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);

const app = express();
const port = 3000; // Your backend will run on http://localhost:3000

// --- 1. Database Connection ---
const pool = new Pool({
    user: 'deep',
    host: 'localhost',
    database: 'bims',
    password: 'password',
    port: 5432,
});

//=========================================================================================
//=========================================================================================
// // --- 2. Middleware Setup ---
// app.use(cors({
//     origin: 'http://127.0.0.1:5500', // Allow your index.html origin
//     credentials: true // Allow cookies
// }));
// app.use(express.json()); // To parse JSON request bodies

// --- 2. Middleware Setup ---
app.use(cors({
    origin: ['http://127.0.0.1:5500', 'http://localhost:5500'], // Allow both origins
    credentials: true // Allow cookies
}));
app.use(express.json()); // To parse JSON request bodies

//=========================================================================================
//=========================================================================================

// --- 3. Session Setup ---
app.use(session({
    store: new PgSession({
        pool: pool, // Use our existing pool
        tableName: 'user_sessions' // A table to store session data
    }),
    secret: 'your_very_strong_secret_key_here', // Change this!
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        secure: false // Set to true if using HTTPS
    }
}));

// A quick middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        next(); // User is logged in, continue
    } else {
        res.status(401).json({ message: 'Not authenticated' });
    }
};

// --- 4. API Endpoints ---

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid password' });
        }
        
        // Don't store hash in session
        const userForSession = { ...user };
        delete userForSession.password_hash;
        
        // Save user to session
        req.session.user = userForSession; 
        
        res.status(200).json({ message: 'Login successful', user: userForSession });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

// GET /api/auth/me (Check session)
app.get('/api/auth/me', isAuthenticated, (req, res) => {
    // If isAuthenticated passes, we have a user
    res.status(200).json(req.session.user);
});

// POST /api/auth/logout
app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ message: 'Could not log out' });
        }
        res.clearCookie('connect.sid'); // Clear the session cookie
        res.status(200).json({ message: 'Logout successful' });
    });
});

// GET /api/users (For Admin Panel & Login Dropdown)
app.get('/api/users', async (req, res) => {
    // This endpoint is intentionally public to populate the login dropdown.
    try {
        // Select all users but exclude the password hash
        const result = await pool.query('SELECT id, employee_id, name, email, role FROM users');
        res.status(200).json(result.rows);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

// PUT /api/users/:id/role (For Admin Panel)
app.put('/api/users/:id/role', isAuthenticated, async (req, res) => {
    if (req.session.user.role !== 'Admin') {
        return res.status(403).json({ message: 'Forbidden' });
    }
    
    const { id } = req.params;
    const { role } = req.body;

    // *** FIX 1: Correctly compare string param 'id' with number session 'id' ***
    if (String(id) === String(req.session.user.id)) {
        return res.status(400).json({ message: 'Cannot change your own role' });
    }

    try {
        const result = await pool.query(
            'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, employee_id, name, email, role',
            [role, id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json({ message: 'Role updated', user: result.rows[0] });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

// *** FEATURE: POST /api/users (For Admin Panel - Add User) ***
app.post('/api/users', isAuthenticated, async (req, res) => {
    if (req.session.user.role !== 'Admin') {
        return res.status(403).json({ message: 'Forbidden' });
    }

    const { name, email, employeeId, role, password } = req.body;

    if (!name || !email || !employeeId || !role || !password) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    try {
        // Hash the password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const result = await pool.query(
            `INSERT INTO users (employee_id, name, email, role, password_hash)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, employee_id, name, email, role`,
            [employeeId, name, email, role, passwordHash]
        );
        
        res.status(201).json({ message: 'User created', user: result.rows[0] });
    
    } catch (e) {
        if (e.code === '23505') { // unique_violation (e.g., email already exists)
            return res.status(409).json({ message: 'Email or Employee ID already exists' });
        }
        res.status(500).json({ message: e.message });
    }
});


// --- 5. Start Server ---
app.listen(port, () => {
    console.log(`BIMS backend server running on http://localhost:${port}`);
});