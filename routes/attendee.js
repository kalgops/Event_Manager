// routes/attendee.js
const express = require('express');
const router  = express.Router();
const db      = global.db;

// Helper to load site settings
function loadSettings(cb) {
  db.get('SELECT name, description FROM site_settings WHERE id=1', cb);
}

// GET /attendee — main attendee page showing all published events
router.get('/', (req, res, next) => {
  loadSettings((e1, settings) => {
    if (e1) return next(e1);
    
    db.all(`
      SELECT e.*, 
             t1.quantity as full_quantity, t1.price as full_price,
             t2.quantity as conc_quantity, t2.price as conc_price,
             COALESCE(b1.sold_full, 0) as sold_full,
             COALESCE(b2.sold_conc, 0) as sold_conc
      FROM events e
      LEFT JOIN tickets t1 ON e.id = t1.event_id AND t1.type = 'full'
      LEFT JOIN tickets t2 ON e.id = t2.event_id AND t2.type = 'concession'
      LEFT JOIN (
        SELECT t.event_id, SUM(b.qty) as sold_full
        FROM bookings b
        JOIN tickets t ON b.ticket_id = t.id
        WHERE t.type = 'full'
        GROUP BY t.event_id
      ) b1 ON e.id = b1.event_id
      LEFT JOIN (
        SELECT t.event_id, SUM(b.qty) as sold_conc
        FROM bookings b
        JOIN tickets t ON b.ticket_id = t.id
        WHERE t.type = 'concession'
        GROUP BY t.event_id
      ) b2 ON e.id = b2.event_id
      WHERE e.state = 'published'
      ORDER BY e.event_date ASC
    `, (e2, events) => {
      if (e2) return next(e2);
      
      res.render('attendee-home', { 
        settings, 
        events: events || [],
        errors: [],
        success: req.query.success,
        error: req.query.error
      });
    });
  });
});

// GET /attendee/events/:id — show individual event details
router.get('/events/:id', (req, res, next) => {
  const eventId = req.params.id;
  
  db.get(`
    SELECT e.*, 
           t1.id as full_ticket_id, t1.quantity as full_quantity, t1.price as full_price,
           t2.id as conc_ticket_id, t2.quantity as conc_quantity, t2.price as conc_price,
           COALESCE(b1.sold_full, 0) as sold_full,
           COALESCE(b2.sold_conc, 0) as sold_conc
    FROM events e
    LEFT JOIN tickets t1 ON e.id = t1.event_id AND t1.type = 'full'
    LEFT JOIN tickets t2 ON e.id = t2.event_id AND t2.type = 'concession'
    LEFT JOIN (
      SELECT t.event_id, SUM(b.qty) as sold_full
      FROM bookings b
      JOIN tickets t ON b.ticket_id = t.id
      WHERE t.type = 'full'
      GROUP BY t.event_id
    ) b1 ON e.id = b1.event_id
    LEFT JOIN (
      SELECT t.event_id, SUM(b.qty) as sold_conc
      FROM bookings b
      JOIN tickets t ON b.ticket_id = t.id
      WHERE t.type = 'concession'
      GROUP BY t.event_id
    ) b2 ON e.id = b2.event_id
    WHERE e.id = ? AND e.state = 'published'
  `, [eventId], (err, event) => {
    if (err) return next(err);
    if (!event) return res.status(404).render('404');
    
    res.render('event-details', { 
      event,
      errors: [],
      success: req.query.success,
      error: req.query.error
    });
  });
});

// POST /attendee/book — handle ticket booking
router.post('/book', (req, res, next) => {
  const { event_id, ticket_type, quantity, buyer_name } = req.body;
  const errors = [];
  
  if (!buyer_name || !buyer_name.trim()) {
    errors.push('Buyer name is required');
  }
  if (!event_id) {
    errors.push('Event ID is required');
  }
  if (!ticket_type || !['full', 'concession'].includes(ticket_type)) {
    errors.push('Valid ticket type is required');
  }
  if (!quantity || quantity < 1) {
    errors.push('Quantity must be at least 1');
  }

  if (errors.length > 0) {
    return res.redirect(`/attendee/events/${event_id}?error=${encodeURIComponent(errors.join(', '))}`);
  }

  db.get(`
    SELECT t.*, e.title as event_title,
           COALESCE(SUM(b.qty), 0) as sold_tickets
    FROM tickets t
    JOIN events e ON t.event_id = e.id
    LEFT JOIN bookings b ON t.id = b.ticket_id
    WHERE t.event_id = ? AND t.type = ?
    GROUP BY t.id
  `, [event_id, ticket_type], (err, ticket) => {
    if (err) return next(err);
    if (!ticket) {
      return res.redirect(`/attendee/events/${event_id}?error=${encodeURIComponent('Ticket type not found')}`);
    }

    const availableTickets = ticket.quantity - ticket.sold_tickets;
    if (quantity > availableTickets) {
      return res.redirect(`/attendee/events/${event_id}?error=${encodeURIComponent('Not enough tickets available')}`);
    }

    db.run(`
      INSERT INTO bookings (event_id, ticket_id, buyer_name, qty, booked_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `, [event_id, ticket.id, buyer_name.trim(), quantity], function(err) {
      if (err) return next(err);
      
      res.redirect(`/attendee?success=${encodeURIComponent('Booking successful! Your tickets have been reserved.')}`);
    });
  });
});

// GET /attendee/dashboard — Attendee Analytics Dashboard
router.get('/dashboard', (req, res, next) => {
  const queries = {
    myBookingsByEvent: `
      SELECT e.title AS event_name, 
             t.type AS ticket_type,
             SUM(b.qty) AS tickets_booked,
             SUM(b.qty * t.price) AS amount_spent,
             e.event_date
      FROM bookings b
      JOIN tickets t ON t.id = b.ticket_id
      JOIN events e ON e.id = t.event_id
      GROUP BY e.id, e.title, t.type, e.event_date
      ORDER BY e.event_date ASC
    `,
    
    myBookingsByType: `
      SELECT t.type AS label,
             COUNT(b.id) AS booking_count,
             SUM(b.qty) AS total_tickets,
             SUM(b.qty * t.price) AS total_spent
      FROM bookings b
      JOIN tickets t ON t.id = b.ticket_id
      GROUP BY t.type
    `,
    
    bookingTimeline: `
      SELECT DATE(b.booked_at) AS booking_date,
             COUNT(b.id) AS bookings_made,
             SUM(b.qty) AS tickets_purchased,
             SUM(b.qty * t.price) AS daily_spending
      FROM bookings b
      JOIN tickets t ON t.id = b.ticket_id
      GROUP BY DATE(b.booked_at)
      ORDER BY booking_date ASC
    `,
    
    upcomingEvents: `
      SELECT DISTINCT e.title, e.event_date, e.description,
             SUM(b.qty) AS my_tickets
      FROM bookings b
      JOIN tickets t ON t.id = b.ticket_id
      JOIN events e ON e.id = t.event_id
      WHERE datetime(e.event_date) > datetime('now')
      GROUP BY e.id, e.title, e.event_date, e.description
      ORDER BY e.event_date ASC
    `,
    
    spendingSummary: `
      SELECT 
        COUNT(DISTINCT b.id) AS total_bookings,
        SUM(b.qty) AS total_tickets,
        SUM(b.qty * t.price) AS total_spent,
        COUNT(DISTINCT e.id) AS events_attended,
        AVG(b.qty * t.price) AS avg_booking_value
      FROM bookings b
      JOIN tickets t ON t.id = b.ticket_id
      JOIN events e ON e.id = t.event_id
    `
  };

  let completedQueries = 0;
  const results = {};
  const totalQueries = Object.keys(queries).length;

  Object.entries(queries).forEach(([key, query]) => {
    db.all(query, (err, rows) => {
      if (err) return next(err);
      
      results[key] = rows || [];
      completedQueries++;
      
      if (completedQueries === totalQueries) {
        const summary = results.spendingSummary[0] || {
          total_bookings: 0,
          total_tickets: 0,
          total_spent: 0,
          events_attended: 0,
          avg_booking_value: 0
        };

        res.render('attendee-dashboard', {
          ...results,
          summary
        });
      }
    });
  });
});

// GET /attendee/my-bookings — View personal booking history
router.get('/my-bookings', (req, res, next) => {
  db.all(`
    SELECT b.id, b.buyer_name, b.qty, b.booked_at,
           e.title AS event_title, e.event_date,
           t.type AS ticket_type, t.price,
           (b.qty * t.price) AS total_cost
    FROM bookings b
    JOIN events e ON b.event_id = e.id
    JOIN tickets t ON b.ticket_id = t.id
    ORDER BY datetime(b.booked_at) DESC
  `, (err, bookings) => {
    if (err) return next(err);
    res.render('my-bookings', { bookings });
  });
});

module.exports = router;