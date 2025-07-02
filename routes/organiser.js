// routes/organiser.js
const express = require('express');
const router  = express.Router();
const db      = global.db;

// Helper to load site settings
function loadSettings(cb) {
  db.get('SELECT name, description FROM site_settings WHERE id=1', cb);
}

// GET /organiser — dashboard
router.get('/', (req, res, next) => {
  loadSettings((e1, settings) => {
    if (e1) return next(e1);
    db.all("SELECT * FROM events WHERE state='published' ORDER BY event_date", (e2, published) => {
      if (e2) return next(e2);
      db.all("SELECT * FROM events WHERE state='draft' ORDER BY created_at DESC", (e3, drafts) => {
        if (e3) return next(e3);
        res.render('organiser-home', { settings, published, drafts });
      });
    });
  });
});

// GET /organiser/settings
router.get('/settings', (req, res, next) => {
  loadSettings((err, settings) => {
    if (err) return next(err);
    res.render('site-settings', { settings, errors: [] });
  });
});

// POST /organiser/settings
router.post('/settings', (req, res, next) => {
  const { name, description } = req.body;
  const errors = [];
  if (!name)        errors.push('Name required');
  if (!description) errors.push('Description required');
  if (errors.length) {
    return res.render('site-settings', { settings:{ name, description }, errors });
  }
  db.run(
    "UPDATE site_settings SET name=?, description=? WHERE id=1",
    [name, description],
    err => err ? next(err) : res.redirect('/organiser')
  );
});

// POST /organiser/events/new
router.post('/events/new', (req, res, next) => {
  db.run("INSERT INTO events(state) VALUES('draft')", function(err) {
    if (err) return next(err);
    const newId = this.lastID;
    if (req.xhr) return res.json({ id: newId });
    res.redirect(`/organiser/events/${newId}/edit`);
  });
});

// GET /organiser/bookings — View all bookings
router.get('/bookings', (req, res, next) => {
  db.all(`
    SELECT b.id, b.buyer_name, b.qty, b.booked_at,
           e.title AS event_title,
           t.type  AS ticket_type
    FROM bookings b
    JOIN events  e ON b.event_id  = e.id
    JOIN tickets t ON b.ticket_id = t.id
    ORDER BY datetime(b.booked_at) DESC
  `, (err, bookings) => {
    if (err) return next(err);
    res.render('all-bookings', { bookings });
  });
});


// POST /organiser/events/:id/edit
router.post('/events/:id/edit', (req, res, next) => {
  const eid = req.params.id;
  const { title, description, event_date, fullQty, fullPrice, concQty, concPrice } = req.body;
  const errors = [];
  if (!title.trim())       errors.push('Title required');
  if (!description.trim()) errors.push('Description required');
  if (!event_date)         errors.push('Date required');

  if (errors.length) {
    return res.render('edit-event', {
      event: { id: eid, title, description, event_date, created_at: '', last_modified: '' },
      full: { quantity: fullQty, price: fullPrice },
      conc: { quantity: concQty, price: concPrice },
      errors
    });
  }

  db.run(
    `UPDATE events
     SET title=?, description=?, event_date=?, last_modified=datetime('now')
     WHERE id=?`,
    [title, description, event_date, eid],
    err => {
      if (err) return next(err);

      const upsert = (type, qty, price) => {
        db.get("SELECT id FROM tickets WHERE event_id=? AND type=?", [eid,type], (e,r) => {
          if (e) return next(e);
          if (r) {
            db.run("UPDATE tickets SET quantity=?,price=? WHERE id=?", [qty,price,r.id]);
          } else {
            db.run("INSERT INTO tickets(event_id,type,quantity,price) VALUES(?,?,?,?)",
                   [eid,type,qty,price]);
          }
        });
      };

      upsert('full',       fullQty,  fullPrice);
      upsert('concession', concQty,  concPrice);

      res.redirect('/organiser');
    }
  );
});

// POST /organiser/events/:id/publish
router.post('/events/:id/publish', (req, res, next) => {
  const eid = req.params.id;
  db.run(
    "UPDATE events SET state='published', published_at=datetime('now') WHERE id=?",
    [eid],
    err => err ? next(err) : res.json({ success:true })
  );
});

// DELETE /organiser/events/:id
router.delete('/events/:id', (req, res, next) => {
  const eid = req.params.id;
  db.run("DELETE FROM events WHERE id=?", [eid], err => err ? next(err) : res.json({ success:true }));
});

router.get('/dashboard', (req, res, next) => {
  db.all(
    `SELECT t.type AS label, SUM(b.qty) AS total
     FROM bookings b
     JOIN tickets t ON t.id = b.ticket_id
     GROUP BY t.type`,
    (err, rows) => {
      if (err) return next(err);
      const labels = rows.map(r => r.label);
      const dataPoints = rows.map(r => r.total);
      res.render('organiser-dashboard', { labels, dataPoints });
    }
  );
});
module.exports = router;
