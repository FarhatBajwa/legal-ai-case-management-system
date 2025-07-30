// backend/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    googleId: { // New field to store the user's unique Google ID
        type: String,
        unique: true,
        sparse: true // Allows multiple documents to have a null value for this field
    },
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: { // Password is no longer strictly required for Google users
        type: String,
        required: false
    },
    role: {
        type: String,
        enum: ['admin', 'lawyer'],
        default: 'lawyer'
    },
    date: {
        type: Date,
        default: Date.now
    }
});

// Encrypt password using bcrypt before saving (only if password is provided)
UserSchema.pre('save', async function(next) {
    if (!this.isModified('password') || !this.password) {
        return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function(enteredPassword) {
    if (!this.password) return false; // If user has no password (Google user)
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);