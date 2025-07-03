// routes/index.js
const express = require('express');
const router = express.Router();
const db = global.db;

// Helper to load site settings
function loadSettings(cb) {
  db.get('SELECT name, description FROM site_settings WHERE id=1', cb);
}

// GET / — Home page
router.get('/', (req, res, next) => {
  loadSettings((err, settings) => {
    if (err) return next(err);
    
    // Get some basic stats for the home page
    const queries = {
      totalEvents: 'SELECT COUNT(*) as count FROM events WHERE state = "published"',
      totalBookings: 'SELECT COUNT(*) as count FROM bookings',
      upcomingEvents: `
        SELECT title, event_date, description 
        FROM events 
        WHERE state = "published" AND datetime(event_date) > datetime("now") 
        ORDER BY event_date ASC 
        LIMIT 3
      `
    };

    let completed = 0;
    const stats = {};
    
    Object.entries(queries).forEach(([key, query]) => {
      db.all(query, (err, rows) => {
        if (err) return next(err);
        stats[key] = key === 'upcomingEvents' ? rows : rows[0].count;
        completed++;
        
        if (completed === Object.keys(queries).length) {
          res.render('index', { 
            settings, 
            stats,
            success: req.query.success,
            error: req.query.error
          });
        }
      });
    });
  });
});

module.exports = router;