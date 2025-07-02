// routes/users.js
const express = require('express');
const router = express.Router();
const db = global.db;

// List all users
router.get('/', (req, res, next) => {
  db.all('SELECT * FROM users', [], (err, users) => {
    if (err) return next(err);
    res.render('users', { users });
  });
});

module.exports = router;