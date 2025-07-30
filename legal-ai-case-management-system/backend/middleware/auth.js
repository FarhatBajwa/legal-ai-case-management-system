// backend/middleware/auth.js
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
dotenv.config({ path: '../.env' }); // Ensure dotenv loads from the correct path

// This middleware now accepts an array of roles.
// If no roles are passed, it just ensures the user is authenticated.
// If roles are passed, it authenticates AND checks if the user's role is included in the allowed roles.
module.exports = (roles = []) => {
    // roles param can be a single role string (e.g., 'admin') or an array (e.g., ['admin', 'lawyer'])
    // Ensure roles is an array
    if (typeof roles === 'string') {
        roles = [roles];
    }

    return (req, res, next) => {
        // Get token from cookie
        const token = req.cookies.token;

        // Check if no token
        if (!token) {
            // If it's an API request, send 401 JSON.
            // If it's an EJS page request, redirect to login form.
            if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                return res.status(401).json({ msg: 'No token, authorization denied.' });
            } else {
                return res.status(401).redirect('/login-form?message=No token, authorization denied. Please log in.');
            }
        }

        try {
            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            req.user = decoded.user; // Attach user payload to request object

            // Check if roles are specified and if user's role is allowed
            if (roles.length && !roles.includes(req.user.role)) {
                if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                    return res.status(403).json({ msg: `Access Denied: You do not have the required role (${roles.join(', ')}) to access this resource.` });
                } else {
                    return res.status(403).render('error', {
                        statusCode: 403,
                        message: `Access Denied: You do not have the required role (${roles.join(', ')}) to access this page.`,
                        redirectUrl: '/dashboard', // Or /login-form
                        redirectText: 'Back to Dashboard'
                    });
                }
            }

            next(); // Proceed to the next middleware/route handler

        } catch (err) {
            // Redirect to login form if token is not valid
            console.error('Auth middleware error:', err.message);
            res.clearCookie('token'); // Clear invalid token
            if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                return res.status(401).json({ msg: 'Token is not valid or expired.' });
            } else {
                return res.status(401).redirect('/login-form?message=Token is not valid or expired. Please log in again.');
            }
        }
    };
};