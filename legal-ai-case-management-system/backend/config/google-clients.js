// backend/config/google-clients.js
const dotenv = require('dotenv');
dotenv.config({ path: './.env' });

/*
This file securely manages multiple Google OAuth clients.
The active client is determined by the GOOGLE_CLIENT_KEY in your .env file.
*/

const clients = {
    // Client for your first Gmail account
    client_one: {
        clientID: process.env.GOOGLE_CLIENT_ID_CLIENT_ONE,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET_CLIENT_ONE
    },
    // Client for your second Gmail account
    client_two: {
        clientID: process.env.GOOGLE_CLIENT_ID_CLIENT_TWO,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET_CLIENT_TWO
    },
    // Client for your third Gmail account
    client_three: {
        clientID: process.env.GOOGLE_CLIENT_ID_CLIENT_THREE,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET_CLIENT_THREE
    }
};

// Determine which client to use based on the .env file
const activeClientKey = process.env.GOOGLE_CLIENT_KEY || 'client_one'; // Default to 'client_one'

// Export the currently active client's credentials
module.exports = clients[activeClientKey];