// backend/config/passport-setup.js
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');
const googleClient = require('./google-clients'); // Import our flexible client config

// This is the core strategy used for both signup and login.
// It will be named 'google' by default.
const strategy = new GoogleStrategy({
    // Get the active client's credentials from our config file
    clientID: googleClient.clientID,
    clientSecret: googleClient.clientSecret,
    // The URL must exactly match the one in your Google Cloud Platform credentials
    callbackURL: '/api/auth/google/callback',
    // This option is crucial to pass the request object to the callback function,
    // which allows us to check the 'state' query parameter (login vs. signup).
    passReqToCallback: true 
}, async (req, accessToken, refreshToken, profile, done) => {
    
    // The 'state' parameter tells us if the user clicked "Login" or "Sign up".
    const action = req.query.state;

    try {
        // Find if a user already exists with this specific Google ID
        const existingUser = await User.findOne({ googleId: profile.id });

        // --- SIGNUP LOGIC ---
        if (action === 'signup') {
            if (existingUser) {
                // The user is trying to sign up, but their Google account is already registered.
                // We should stop them and tell them to log in instead.
                return done(null, false, { message: 'This Google account is already registered. Please log in.' });
            }
            
            // Before creating a new user, check if their email address is already in use
            // by a different account (e.g., a local account with a password).
            const userWithEmail = await User.findOne({ email: profile.emails[0].value });
            if (userWithEmail) {
                return done(null, false, { message: 'This email is already in use. Please log in with your original method.' });
            }

            // If the user doesn't exist and the email is free, create them.
            const newUser = new User({
                googleId: profile.id,
                name: profile.displayName,
                email: profile.emails[0].value,
                // No password is set for Google users
            });
            await newUser.save();
            // Pass the newly created user to the next step
            return done(null, newUser);

        // --- LOGIN LOGIC ---
        } else if (action === 'login') {
            if (existingUser) {
                // The user is trying to log in and they exist in our database. Success!
                // Pass the existing user to the next step.
                return done(null, existingUser);
            }
            // The user is trying to log in, but we don't have their Google account on record.
            // We should stop them and tell them to sign up first.
            return done(null, false, { message: 'This Google account is not registered. Please sign up first.' });
        } else {
            // This case should not be reached if the buttons are set up correctly.
            // It's a safety net for an invalid action.
            return done(null, false, { message: 'Invalid authentication action specified.' });
        }
    } catch (err) {
        // Handle any unexpected database errors.
        console.error("Error in Google Strategy:", err);
        return done(err, null);
    }
});

// Tell passport to use the strategy we just defined.
// When we call `passport.authenticate('google')`, this is the strategy it will use.
passport.use('google', strategy);