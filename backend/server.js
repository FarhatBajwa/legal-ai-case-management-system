// backend/server.js
const express = require('express');
const connectDB = require('./config/db');
const dotenv =require('dotenv');
const path = require('path');
const User = require('./models/User');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const fs = require('fs');

dotenv.config({ path: './.env' });

const app = express();

// Connect Database
connectDB();

// Init Middleware
app.use(express.json({ extended: false }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Set EJS as Templating Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// --- THIS IS THE CRITICAL LINE FOR THE DOCUMENT LINK ---
// It tells Express: "If a URL request starts with '/uploads',
// serve the corresponding file from the physical 'backend/uploads' folder."
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// --------------------------------------------------------

// Serve other static files (CSS, client-side JS) from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Define API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/cases', require('./routes/cases'));
app.use('/api/admin', require('./routes/admin'));

// Import auth middleware for protected EJS routes
const authMiddleware = require('./middleware/auth');

// --- EJS Page Rendering Routes ---
app.get('/register-form', (req, res) => res.render('register', { message: null }));
app.post('/register', async (req, res) => {
    const { name, email, password, role } = req.body;
    try {
        let user = await User.findOne({ email });
        if (user) return res.render('register', { message: 'User already exists', error: true });
        user = new User({ name, email, password, role: role || 'lawyer' });
        await user.save();
        res.render('login', { message: 'Registration successful! Please log in.' });
    } catch (err) {
        res.render('register', { message: 'Server error.', error: true });
    }
});

app.get('/login-form', (req, res) => res.render('login', { message: req.query.message || null }));
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        let user = await User.findOne({ email });
        if (!user || !(await user.matchPassword(password))) {
            return res.render('login', { message: 'Invalid Credentials', error: true });
        }
        const payload = { user: { id: user.id, role: user.role } };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 3600000 });
        res.redirect('/dashboard');
    } catch (err) {
        res.render('login', { message: 'Server error.', error: true });
    }
});

app.get('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/login-form');
});

// Protected EJS routes
app.get('/dashboard', authMiddleware(), async (req, res) => {
    const user = await User.findById(req.user.id).select('-password');
    res.render('dashboard', { user: user });
});
app.get('/upload-form', authMiddleware(), (req, res) => res.render('upload'));
app.get('/my-cases', authMiddleware(), (req, res) => res.render('mycases'));
app.get('/case-details/:id', authMiddleware(), (req, res) => res.render('casedetails'));
app.get('/admin-dashboard', authMiddleware('admin'), (req, res) => res.render('admin_dashboard'));
app.get('/profile', authMiddleware(), (req, res) => res.render('profile'));

app.get('/', (req, res) => res.redirect('/login-form'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));