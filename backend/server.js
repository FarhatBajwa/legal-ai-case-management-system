// backend/server.js
const express = require('express');
const connectDB = require('./config/db');
const dotenv = require('dotenv');
const path = require('path');
const User = require('./models/User');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const fs = require('fs');

// Import Passport and our custom setup file
const passport = require('passport');
const passportSetup = require('./config/passport-setup'); // We must import this file to execute it

// Load environment variables from .env file
dotenv.config({ path: './.env' });

const app = express();

// Connect to the MongoDB Database
connectDB();

// Initialize Core Middleware
app.use(express.json({ extended: false }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// --- Initialize Passport Middleware ---
// This line must be included for Passport to work.
app.use(passport.initialize());
// ------------------------------------

// Configure EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Configure Static File Serving
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// --- Define API Routes ---
// Any URL starting with '/api/...' will be handled by the corresponding router file.
app.use('/api/auth', require('./routes/auth'));
app.use('/api/cases', require('./routes/cases'));
app.use('/api/admin', require('./routes/admin'));

// --- EJS Page Rendering and Form Submission Routes ---

// Import the authentication middleware for protecting pages
const authMiddleware = require('./middleware/auth');

// Routes for rendering form pages
app.get('/register-form', (req, res) => res.render('register', { message: req.query.message || null }));
app.get('/login-form', (req, res) => res.render('login', { message: req.query.message || null }));

// Routes for handling traditional local (email/password) form submissions
app.post('/register', async (req, res) => {
    const { name, email, password, role } = req.body;
    try {
        let user = await User.findOne({ email });
        if (user) {
            return res.redirect('/register-form?message=User already exists');
        }
        user = new User({ name, email, password, role: role || 'lawyer' });
        await user.save();
        res.redirect('/login-form?message=Registration successful! Please log in.');
    } catch (err) {
        res.redirect('/register-form?message=Server error during registration.');
    }
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        let user = await User.findOne({ email });
        if (!user || !(await user.matchPassword(password))) {
            return res.redirect('/login-form?message=Invalid Credentials');
        }
        const payload = { user: { id: user.id, role: user.role } };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 3600000 });
        res.redirect('/dashboard');
    } catch (err) {
        res.redirect('/login-form?message=Server error during login.');
    }
});

app.get('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/login-form?message=You have been logged out.');
});

// Protected EJS Page Routes (require a valid JWT)
app.get('/dashboard', authMiddleware(), async (req, res) => {
    const user = await User.findById(req.user.id).select('-password');
    res.render('dashboard', { user: user });
});

app.get('/upload-form', authMiddleware(), (req, res) => res.render('upload'));
app.get('/my-cases', authMiddleware(), (req, res) => res.render('mycases'));
app.get('/case-details/:id', authMiddleware(), (req, res) => res.render('casedetails'));
app.get('/admin-dashboard', authMiddleware('admin'), (req, res) => res.render('admin_dashboard'));
app.get('/profile', authMiddleware(), (req, res) => res.render('profile'));

// Root route redirects to the login form
app.get('/', (req, res) => res.redirect('/login-form'));

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));