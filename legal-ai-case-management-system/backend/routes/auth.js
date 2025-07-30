// backend/routes/auth.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const auth = require('../middleware/auth'); // For protecting profile routes

// --- GOOGLE AUTHENTICATION ROUTES ---

// @route    GET api/auth/google/signup
// @desc     Starts the signup process by redirecting to Google
// @access   Public
router.get('/google/signup', passport.authenticate('google', {
    scope: ['profile', 'email'],
    state: 'signup' // Pass the 'signup' action to the callback
}));

// @route    GET api/auth/google/login
// @desc     Starts the login process by redirecting to Google
// @access   Public
router.get('/google/login', passport.authenticate('google', {
    scope: ['profile', 'email'],
    state: 'login' // Pass the 'login' action to the callback
}));

// @route    GET api/auth/google/callback
// @desc     The callback URL that Google redirects to after user consent.
//           This single route handles both login and signup callbacks.
// @access   Public
router.get('/google/callback', (req, res, next) => {
    // Use a custom callback to handle success/failure and redirect with messages
    passport.authenticate('google', {
        session: false, // We are using JWT, not cookie-based sessions
        failureRedirect: '/login-form' // A generic fallback, but our custom handler is better
    }, (err, user, info) => {
        // This is the custom handler function that runs after the Passport strategy is complete

        if (err) {
            // Handle any internal errors during authentication
            console.error('Passport authentication error:', err);
            return res.redirect('/login-form?message=An unexpected error occurred. Please try again.');
        }

        if (!user) {
            // If authentication fails, Passport provides a message in the 'info' object.
            // This happens if a user tries to log in without signing up first,
            // or tries to sign up with an existing account.
            const message = info.message || 'Google authentication failed. Please try again.';
            return res.redirect(`/login-form?message=${encodeURIComponent(message)}`);
        }

        // If authentication is successful, the 'user' object is available.
        // We now generate a JWT and send it as a cookie.
        const payload = {
            user: {
                id: user.id,
                role: user.role
            }
        };

        const token = jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 3600000 // 1 hour
        });

        // Redirect to the main dashboard after successful login or signup
        res.redirect('/dashboard');

    })(req, res, next);
});


// --- USER PROFILE MANAGEMENT API ROUTES (Protected) ---
// These routes are used by the profile page to fetch/update data with client-side JavaScript

// @route    GET api/auth/profile
// @desc     Get current authenticated user's profile data
// @access   Private
router.get('/profile', auth(), async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }
        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route    PUT api/auth/profile
// @desc     Update current authenticated user's profile data
// @access   Private
router.put('/profile', auth(), async (req, res) => {
    const { name, email } = req.body;
    const userFields = {};
    if (name) userFields.name = name;
    if (email) userFields.email = email;

    try {
        let user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        // Prevent email collisions
        if (email && email !== user.email) {
            const existingUser = await User.findOne({ email });
            if (existingUser && existingUser._id.toString() !== req.user.id) {
                return res.status(400).json({ msg: 'This email is already in use.' });
            }
        }

        // Prevent email change for Google-linked accounts
        if (user.googleId && email && email !== user.email) {
            return res.status(400).json({ msg: 'Cannot change the email of a Google-linked account.' });
        }

        user = await User.findByIdAndUpdate(
            req.user.id,
            { $set: userFields },
            { new: true }
        ).select('-password');

        res.json({ msg: 'Profile updated successfully', user });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;