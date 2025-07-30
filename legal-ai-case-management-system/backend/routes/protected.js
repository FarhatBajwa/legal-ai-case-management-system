// backend/routes/protected.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// @route   GET api/protected/user-info
// @desc    Get authenticated user info (example protected route)
// @access  Private (for any authenticated user)
router.get('/user-info', auth, (req, res) => {
    try {
        res.json({
            msg: 'Access granted to any authenticated user!',
            userId: req.user.id,
            userRole: req.user.role
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET api/protected/admin-dashboard
// @desc    Access for Admins only
// @access  Private (Admin only)
router.get('/admin-dashboard', auth, (req, res) => {
    // Check if the authenticated user has the 'admin' role
    if (req.user.role !== 'admin') {
        return res.status(403).json({ msg: 'Access denied: Admins only' }); // 403 Forbidden
    }
    try {
        res.json({
            msg: 'Welcome to the Admin Dashboard!',
            userId: req.user.id,
            userRole: req.user.role,
            data: 'Sensitive admin data here.'
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;