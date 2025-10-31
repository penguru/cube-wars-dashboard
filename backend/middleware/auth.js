const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Configure allowed email addresses here
const ALLOWED_EMAILS = [
  'serhat.aydin@mobsmile.com',
  'asrin.ilday@mobsmile.com',
  'emir.guzel@mobsmile.com',
  'emir.ugur@mobsmile.com',
  'deniz.luleci@mobsmile.com',
  'sibel.bekar@mobsmile.com',
  'sinan.bingol@mobsmile.com',
  
  // Add more authorized emails here
];

// Verify Google ID token
async function verifyGoogleToken(token) {
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    return payload;
  } catch (error) {
    console.error('Error verifying Google token:', error);
    return null;
  }
}

// Check if email is allowed
function isEmailAllowed(email) {
  return ALLOWED_EMAILS.includes(email);
}

// Middleware to authenticate JWT token
function authenticateToken(req, res, next) {
  const token = req.cookies.auth_token;

  if (!token) {
    return res.status(401).json({ error: 'No authentication token provided' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    // Verify email is still allowed
    if (!isEmailAllowed(user.email)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    req.user = user;
    next();
  });
}

module.exports = {
  verifyGoogleToken,
  isEmailAllowed,
  authenticateToken,
};
