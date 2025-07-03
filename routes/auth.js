// routes/auth.js
const express = require('express');
const router  = express.Router();
const db      = global.db;
const { body, validationResult } = require('express-validator');

// Show login form
router.get('/login', (req, res) => {
  res.render('login', { errors: [], lastUsername: '' });
});

// Handle login
router.post(
  '/login',
  [
    body('username').trim().notEmpty().withMessage('Username required'),
    body('password').notEmpty().withMessage('Password required')
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    const { username, password } = req.body;
    if (!errors.isEmpty()) {
      return res.render('login', { errors: errors.array(), lastUsername: username });
    }

    db.get(
      'SELECT id, username, password_hash FROM users WHERE username = ?',
      [username],
      (err, user) => {
        if (err) return next(err);
        if (!user) {
          return res.render('login', {
            errors: [{ msg: 'Invalid credentials' }],
            lastUsername: username
          });
        }
        // For illustration assume passwords are stored in plain text (NOT for production!)
        if (password !== user.password_hash) {
          return res.render('login', {
            errors: [{ msg: 'Invalid credentials' }],
            lastUsername: username
          });
        }
        // Authenticated
        req.session.isLoggedIn = true;
        req.session.user = { id: user.id, username: user.username };
        req.session.save(err2 => {
          if (err2) return next(err2);
          res.redirect('/organiser');
        });
      }
    );
  }
);

// Handle logout
router.post('/logout', (req, res, next) => {
  req.session.destroy(err => {
    if (err) return next(err);
    res.redirect('/');
  });
});

module.exports = router;
// This file handles user authentication routes
// It includes login and logout functionality, using session management