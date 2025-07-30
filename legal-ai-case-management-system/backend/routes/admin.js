// backend/routes/admin.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth'); // Our authentication middleware
const Case = require('../models/Case'); // To query case data
const User = require('../models/User'); // To query user data

// @route   GET /api/admin/dashboard-data
// @desc    Get aggregated data for admin dashboard (Case counts, Outcome predictions, etc.)
// @access  Private (Admin only)
router.get('/dashboard-data', auth('admin'), async (req, res) => {
    try {
        const totalCases = await Case.countDocuments();
        const totalUsers = await User.countDocuments();
        const totalLawyers = await User.countDocuments({ role: 'lawyer' });
        const totalAdmins = await User.countDocuments({ role: 'admin' });

        // Aggregate case types
        const caseTypeDistribution = await Case.aggregate([
            { $group: { _id: '$caseType', count: { $sum: 1 } } },
            { $project: { _id: 0, caseType: '$_id', count: 1 } }
        ]);

        // Aggregate outcome predictions
        const outcomeDistribution = await Case.aggregate([
            { $group: { _id: '$outcomePrediction', count: { $sum: 1 } } },
            { $project: { _id: 0, outcome: '$_id', count: 1 } }
        ]);

        res.json({
            totalCases,
            totalUsers,
            totalLawyers,
            totalAdmins,
            caseTypeDistribution,
            outcomeDistribution
        });

    } catch (err) {
        console.error('Error fetching admin dashboard data:', err.message);
        res.status(500).json({ msg: 'Server error fetching admin data.' });
    }
});

// You can add more admin-specific routes here later, e.g., to manage users.

module.exports = router;