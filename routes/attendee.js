// routes/attendee.js - Attendee-side routes for viewing and booking events
// Handles event listing, event details, and ticket booking

const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const db = global.db;

// Helper function to load site settings
// Input: Callback function
// Output: Site settings object {name, description}
function loadSettings(callback) {
  db.get('SELECT name, description FROM site_settings WHERE id = 1', callback);
}

// GET /attendee - Attendee home page with list of published events
// Input: None
// Output: Renders attendee home with published events ordered by date
router.get('/', (req, res, next) => {
  loadSettings((err1, settings) => {
    if (err1) return next(err1);
    
    // Get all published events ordered by event date
    db.all(`
      SELECT e.id, e.title, e.description, e.event_date
      FROM events e
      WHERE e.state = 'published'
      ORDER BY date(e.event_date) ASC
    `, (err2, events) => {
      if (err2) return next(err2);
      
      res.render('attendee-home', { 
        settings, 
        events: events || [],
        success: req.query.success
      });
    });
  });
});

// GET /attendee/events/:id - Individual event page for booking
// Input: Event ID in URL parameters
// Output: Renders event details with booking form
router.get('/events/:id', (req, res, next) => {
  const eventId = req.params.id;
  
  // Get event details
  db.get(`
    SELECT * FROM events 
    WHERE id = ? AND state = 'published'
  `, [eventId], (err1, event) => {
    if (err1) return next(err1);
    if (!event) return res.status(404).render('404');
    
    // Get tickets for this event with remaining quantities
    db.all(`
      SELECT t.id, t.type, t.price, t.quantity,
             COALESCE(SUM(b.qty), 0) as booked,
             (t.quantity - COALESCE(SUM(b.qty), 0)) as remaining
      FROM tickets t
      LEFT JOIN bookings b ON t.id = b.ticket_id
      WHERE t.event_id = ?
      GROUP BY t.id, t.type, t.price, t.quantity
    `, [eventId], (err2, tickets) => {
      if (err2) return next(err2);
      
      res.render('attendee-event', {
        event,
        tickets: tickets || [],
        errors: []
      });
    });
  });
});

// POST /attendee/events/:id/book - Book tickets for an event
// Input: Event ID and booking form data {buyer_name, ticket quantities}
// Output: Creates booking records and redirects to success page
router.post('/events/:id/book',
  [
    body('buyer_name').notEmpty().withMessage('Your name is required'),
    body('full_quantity').optional().isInt({ min: 0 }).withMessage('Full ticket quantity must be 0 or more'),
    body('conc_quantity').optional().isInt({ min: 0 }).withMessage('Concession ticket quantity must be 0 or more')
  ],
  (req, res, next) => {
    const eventId = req.params.id;
    const errors = validationResult(req);
    const { buyer_name, full_quantity = 0, conc_quantity = 0 } = req.body;
    
    // Check if at least one ticket is being booked
    if (parseInt(full_quantity) === 0 && parseInt(conc_quantity) === 0) {
      errors.errors.push({ msg: 'Please select at least one ticket' });
    }
    
    if (!errors.isEmpty()) {
      // Reload page with errors - need to get event and tickets again
      db.get('SELECT * FROM events WHERE id = ? AND state = "published"', [eventId], (err1, event) => {
        if (err1) return next(err1);
        
        db.all(`
          SELECT t.id, t.type, t.price, t.quantity,
                 COALESCE(SUM(b.qty), 0) as booked,
                 (t.quantity - COALESCE(SUM(b.qty), 0)) as remaining
          FROM tickets t
          LEFT JOIN bookings b ON t.id = b.ticket_id
          WHERE t.event_id = ?
          GROUP BY t.id, t.type, t.price, t.quantity
        `, [eventId], (err2, tickets) => {
          if (err2) return next(err2);
          
          res.render('attendee-event', {
            event,
            tickets,
            errors: errors.array(),
            formData: req.body
          });
        });
      });
      return;
    }
    
    // Process bookings
    let bookingsToProcess = [];
    
    if (parseInt(full_quantity) > 0) {
      bookingsToProcess.push({ type: 'full', quantity: parseInt(full_quantity) });
    }
    
    if (parseInt(conc_quantity) > 0) {
      bookingsToProcess.push({ type: 'concession', quantity: parseInt(conc_quantity) });
    }
    
    // Check availability and create bookings
    let processedBookings = 0;
    const totalBookings = bookingsToProcess.length;
    
    if (totalBookings === 0) {
      return res.redirect(`/attendee/events/${eventId}`);
    }
    
    bookingsToProcess.forEach(booking => {
      // Get ticket ID and check availability
      db.get(`
        SELECT t.id, t.quantity,
               COALESCE(SUM(b.qty), 0) as booked,
               (t.quantity - COALESCE(SUM(b.qty), 0)) as remaining
        FROM tickets t
        LEFT JOIN bookings b ON t.id = b.ticket_id
        WHERE t.event_id = ? AND t.type = ?
        GROUP BY t.id, t.quantity
      `, [eventId, booking.type], (err, ticket) => {
        if (err) return next(err);
        
        if (!ticket || ticket.remaining < booking.quantity) {
          // Not enough tickets available
          db.get('SELECT * FROM events WHERE id = ?', [eventId], (err1, event) => {
            if (err1) return next(err1);
            
            db.all(`
              SELECT t.id, t.type, t.price, t.quantity,
                     COALESCE(SUM(b.qty), 0) as booked,
                     (t.quantity - COALESCE(SUM(b.qty), 0)) as remaining
              FROM tickets t
              LEFT JOIN bookings b ON t.id = b.ticket_id
              WHERE t.event_id = ?
              GROUP BY t.id, t.type, t.price, t.quantity
            `, [eventId], (err2, tickets) => {
              if (err2) return next(err2);
              
              res.render('attendee-event', {
                event,
                tickets,
                errors: [{ msg: `Not enough ${booking.type} tickets available` }],
                formData: req.body
              });
            });
          });
          return;
        }
        
        // Create booking
        db.run(`
          INSERT INTO bookings (event_id, ticket_id, buyer_name, qty)
          VALUES (?, ?, ?, ?)
        `, [eventId, ticket.id, buyer_name, booking.quantity], err => {
          if (err) return next(err);
          
          processedBookings++;
          if (processedBookings === totalBookings) {
            // All bookings processed successfully
            res.redirect(`/attendee?success=Booking successful for ${buyer_name}!`);
          }
        });
      });
    });
  }
);

module.exports = router;