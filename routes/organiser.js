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
    
    // Always return JSON for async handling
    res.json({ id: newId, success: true });
  });
});

// GET /organiser/events/:id/edit
router.get('/events/:id/edit', (req, res, next) => {
  const eventId = req.params.id;
  
  // Load the event
  db.get('SELECT * FROM events WHERE id = ?', [eventId], (err, event) => {
    if (err) return next(err);
    if (!event) return res.status(404).render('404');
    
    // Load ticket data
    db.all('SELECT * FROM tickets WHERE event_id = ?', [eventId], (err2, tickets) => {
      if (err2) return next(err2);
      
      // Organize tickets by type
      const full = tickets.find(t => t.type === 'full') || { quantity: 0, price: 0 };
      const conc = tickets.find(t => t.type === 'concession') || { quantity: 0, price: 0 };
      
      res.render('edit-event', {
        event,
        full,
        conc,
        errors: []
      });
    });
  });
});

// POST /organiser/events/:id/edit
router.post('/events/:id/edit', (req, res, next) => {
  const eid = req.params.id;
  const { title, description, event_date, fullQty, fullPrice, concQty, concPrice } = req.body;
  const errors = [];
  if (!title || !title.trim())       errors.push('Title required');
  if (!description || !description.trim()) errors.push('Description required');
  if (!event_date)         errors.push('Date required');

  if (errors.length) {
    return res.render('edit-event', {
      event: { id: eid, title, description, event_date, created_at: '', last_modified: '' },
      full: { quantity: fullQty || 0, price: fullPrice || 0 },
      conc: { quantity: concQty || 0, price: concPrice || 0 },
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

      const upsert = (type, qty, price, callback) => {
        db.get("SELECT id FROM tickets WHERE event_id=? AND type=?", [eid, type], (e, r) => {
          if (e) return callback(e);
          if (r) {
            db.run("UPDATE tickets SET quantity=?,price=? WHERE id=?", [qty, price, r.id], callback);
          } else {
            db.run("INSERT INTO tickets(event_id,type,quantity,price) VALUES(?,?,?,?)",
                   [eid, type, qty, price], callback);
          }
        });
      };

      // Use async operations to handle both ticket types
      let completed = 0;
      const total = 2;
      
      const checkComplete = (err) => {
        if (err) return next(err);
        completed++;
        if (completed === total) {
          res.redirect('/organiser');
        }
      };

      upsert('full', fullQty || 0, fullPrice || 0, checkComplete);
      upsert('concession', concQty || 0, concPrice || 0, checkComplete);
    }
  );
});

// POST /organiser/events/:id/publish
router.post('/events/:id/publish', (req, res, next) => {
  const eid = req.params.id;
  db.run(
    "UPDATE events SET state='published', published_at=datetime('now') WHERE id=?",
    [eid],
    err => err ? next(err) : res.json({ success: true })
  );
});

// DELETE /organiser/events/:id
router.delete('/events/:id', (req, res, next) => {
  const eid = req.params.id;
  db.run("DELETE FROM events WHERE id=?", [eid], err => err ? next(err) : res.json({ success: true }));
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

// GET /organiser/dashboard — Enhanced Analytics Dashboard
router.get('/dashboard', (req, res, next) => {
  // Get multiple analytics data sets
  const queries = {
    // Ticket sales by type
    ticketSales: `
      SELECT t.type AS label, 
             SUM(b.qty) AS total,
             SUM(b.qty * t.price) AS revenue
      FROM bookings b
      JOIN tickets t ON t.id = b.ticket_id
      GROUP BY t.type
    `,
    
    // Event popularity (bookings per event)
    eventPopularity: `
      SELECT e.title AS label, 
             COUNT(b.id) AS bookings,
             SUM(b.qty) AS total_tickets
      FROM events e
      LEFT JOIN bookings b ON e.id = b.event_id
      WHERE e.state = 'published'
      GROUP BY e.id, e.title
      ORDER BY total_tickets DESC
    `,
    
    // Booking trends over time (last 30 days)
    bookingTrends: `
      SELECT DATE(b.booked_at) AS booking_date,
             COUNT(b.id) AS bookings,
             SUM(b.qty) AS tickets_sold
      FROM bookings b
      WHERE datetime(b.booked_at) >= datetime('now', '-30 days')
      GROUP BY DATE(b.booked_at)
      ORDER BY booking_date ASC
    `,
    
    // Capacity utilization
    capacityUtilization: `
      SELECT 
        e.title,
        SUM(t.quantity) as total_capacity,
        COALESCE(SUM(b.qty), 0) as tickets_sold,
        CASE 
          WHEN SUM(t.quantity) > 0 
          THEN ROUND((COALESCE(SUM(b.qty), 0) * 100.0 / SUM(t.quantity)), 2)
          ELSE 0 
        END as utilization_percent
      FROM events e
      JOIN tickets t ON e.id = t.event_id
      LEFT JOIN bookings b ON t.id = b.ticket_id
      WHERE e.state = 'published'
      GROUP BY e.id, e.title
    `,
    
    // Revenue breakdown
    revenueBreakdown: `
      SELECT 
        e.title AS event_name,
        t.type AS ticket_type,
        SUM(b.qty) AS tickets_sold,
        t.price,
        SUM(b.qty * t.price) AS revenue
      FROM events e
      JOIN tickets t ON e.id = t.event_id
      LEFT JOIN bookings b ON t.id = b.ticket_id
      WHERE e.state = 'published'
      GROUP BY e.id, e.title, t.type, t.price
      HAVING tickets_sold > 0
      ORDER BY revenue DESC
    `
  };

  let completedQueries = 0;
  const results = {};
  const totalQueries = Object.keys(queries).length;

  // Execute all queries
  Object.entries(queries).forEach(([key, query]) => {
    db.all(query, (err, rows) => {
      if (err) return next(err);
      
      results[key] = rows || [];
      completedQueries++;
      
      if (completedQueries === totalQueries) {
        // Calculate summary statistics
        const totalBookings = results.ticketSales.reduce((sum, item) => sum + item.total, 0);
        const totalRevenue = results.ticketSales.reduce((sum, item) => sum + item.revenue, 0);
        const avgUtilization = results.capacityUtilization.length > 0 
          ? results.capacityUtilization.reduce((sum, item) => sum + item.utilization_percent, 0) / results.capacityUtilization.length
          : 0;

        res.render('organiser-dashboard', {
          ...results,
          summary: {
            totalBookings,
            totalRevenue,
            avgUtilization: Math.round(avgUtilization * 100) / 100,
            totalEvents: results.eventPopularity.length
          }
        });
      }
    });
  });
});

module.exports = router;