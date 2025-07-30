// backend/models/Case.js
const mongoose = require('mongoose');

const CaseSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    caseTitle: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    caseType: {
        type: String,
        enum: ['Criminal', 'Civil', 'Family', 'Corporate', 'Property', 'Other'],
        default: 'Other'
    },
    status: {
        type: String,
        enum: ['Open', 'Closed', 'Pending', 'Archived'],
        default: 'Open'
    },
    documentName: {
        type: String,
        required: true
    },
    documentPath: {
        type: String,
        required: true
    },
    fileMimeType: {
        type: String,
        required: true
    },
    summary: {
        type: String,
        default: 'No summary available.'
    },
    predictedOutcome: {
        type: String,
        // *** THIS IS THE CRITICAL FIX ***
        // Added 'Disposed (Infructuous)' to the list of allowed values.
        enum: ['Favorable', 'Unfavorable', 'Settlement', 'Acquitted', 'Upheld/Convicted', 'Pending', 'Failed', 'Disposed (Infructuous)'],
        default: 'Pending'
    },
    parties: {
        party1: { type: String, default: 'N/A' },
        party2: { type: String, default: 'N/A' }
    },
    sections: {
        type: [String],
        default: []
    },
    winningPartyPrediction: {
        type: String,
        default: 'N/A'
    },
    keywords: {
        type: [String],
        default: []
    },
    notes: {
        type: String,
        default: ''
    },
    deadline: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Case', CaseSchema);