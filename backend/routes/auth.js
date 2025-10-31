const express = require('express');
const jwt = require('jsonwebtoken');
const { verifyGoogleToken, isEmailAllowed } = require('../middleware/auth');

const router = express.Router();

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ error: 'No credential provided' });
    }

    // Verify Google token
    const payload = await verifyGoogleToken(credential);

    if (!payload) {
      return res.status(401).json({ error: 'Invalid Google token' });
    }

    // Check if email is allowed
    if (!isEmailAllowed(payload.email)) {
      return res.status(403).json({ error: 'Access denied. Your email is not authorized.' });
    }

    // Create JWT token
    const token = jwt.sign(
      {
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
        sub: payload.sub,
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Set HTTP-only cookie
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      user: {
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout endpoint
router.post('/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.json({ message: 'Logged out successfully' });
});

// Check authentication status
router.get('/check', (req, res) => {
  const token = req.cookies.auth_token;

  if (!token) {
    return res.status(401).json({ authenticated: false });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(401).json({ authenticated: false });
    }

    // Check if email is still allowed
    if (!isEmailAllowed(user.email)) {
      res.clearCookie('auth_token');
      return res.status(403).json({ authenticated: false, error: 'Access revoked' });
    }

    res.json({
      authenticated: true,
      user: {
        email: user.email,
        name: user.name,
        picture: user.picture,
      },
    });
  });
});

module.exports = router;
