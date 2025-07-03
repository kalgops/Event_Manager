// routes/organiser.js
const express = require('express');
const isAuth  = require('../middleware/is-auth');
const router  = express.Router();
const db      = global.db;

// Apply to every /organiser route
router.use(isAuth);

// Helper to load site settings
function loadSettings(cb) {
  db.get('SELECT name, description FROM site_settings WHERE id=1', cb);
}

/**
 * GET /organiser
 * — Organiser Dashboard (events)
 */
router.get('/', (req, res, next) => {
  loadSettings((err, settings) => {
    if (err) return next(err);

    // Fetch published & draft events
    db.all("SELECT * FROM events WHERE state='published' ORDER BY event_date", (errP, published) => {
      if (errP) return next(errP);
      db.all("SELECT * FROM events WHERE state='draft' ORDER BY created_at DESC", (errD, drafts) => {
        if (errD) return next(errD);
        res.render('organiser-home', { settings, published, drafts });
      });
    });
  });
});

/**
 * GET /organiser/bookings
 * — Organiser Bookings Dashboard
 */
router.get('/bookings', (req, res, next) => {
  loadSettings((err, settings) => {
    if (err) return next(err);

    const sql = `
      SELECT
        b.id,
        b.buyer_name,
        b.qty,
        b.booked_at,
        e.title   AS event_title,
        t.type    AS ticket_type
      FROM bookings b
      JOIN events  e ON e.id = b.event_id
      JOIN tickets t ON t.id = b.ticket_id
      ORDER BY datetime(b.booked_at) DESC
    `;

    db.all(sql, (errB, bookings) => {
      if (errB) return next(errB);
      res.render('organiser-bookings', { settings, bookings });
    });
  });
});

/**
 * GET /organiser/bookings/data
 * — Return JSON: total qty per ticket_type
 */
router.get('/bookings/data', (req, res, next) => {
  const sql = `
    SELECT t.type      AS ticket_type,
           SUM(b.qty)  AS total_booked
      FROM bookings b
      JOIN tickets  t ON t.id = b.ticket_id
     GROUP BY t.type
  `;
  db.all(sql, (err, rows) => {
    if (err) return next(err);
    // send as { labels: [...], data: [...] }
    const labels = rows.map(r => r.ticket_type);
    const data   = rows.map(r => r.total_booked);
    res.json({ labels, data });
  });
});

module.exports = router;