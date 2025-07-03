// routes/organiser.js - Organiser-side routes for event management
// Handles all organiser functionality: events, settings, publishing

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

// GET /organiser - Organiser home page
// Input: None  
// Output: Renders organiser home with published and draft events
router.get('/', (req, res, next) => {
  loadSettings((err1, settings) => {
    if (err1) return next(err1);
    
    // Get published events with ticket information
    db.all(`
      SELECT e.*, 
             COUNT(CASE WHEN t.type = 'full' THEN 1 END) as full_tickets,
             COUNT(CASE WHEN t.type = 'concession' THEN 1 END) as conc_tickets
      FROM events e
      LEFT JOIN tickets t ON e.id = t.event_id
      WHERE e.state = 'published'
      GROUP BY e.id
      ORDER BY e.event_date ASC
    `, (err2, published) => {
      if (err2) return next(err2);
      
      // Get draft events with ticket information
      db.all(`
        SELECT e.*,
               COUNT(CASE WHEN t.type = 'full' THEN 1 END) as full_tickets,
               COUNT(CASE WHEN t.type = 'concession' THEN 1 END) as conc_tickets
        FROM events e
        LEFT JOIN tickets t ON e.id = t.event_id
        WHERE e.state = 'draft'
        GROUP BY e.id
        ORDER BY e.created_at DESC
      `, (err3, drafts) => {
        if (err3) return next(err3);
        
        res.render('organiser-home', { 
          settings, 
          published: published || [], 
          drafts: drafts || []
        });
      });
    });
  });
});

// GET /organiser/settings - Site settings page
// Input: None
// Output: Renders settings form with current values
router.get('/settings', (req, res, next) => {
  loadSettings((err, settings) => {
    if (err) return next(err);
    res.render('site-settings', { settings, errors: [] });
  });
});

// POST /organiser/settings - Update site settings
// Input: Form data {name, description}
// Output: Updates database and redirects to organiser home
router.post('/settings', 
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('description').notEmpty().withMessage('Description is required')
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    const { name, description } = req.body;
    
    if (!errors.isEmpty()) {
      return res.render('site-settings', { 
        settings: { name, description }, 
        errors: errors.array() 
      });
    }
    
    // Update site settings in database
    db.run(
      'UPDATE site_settings SET name = ?, description = ? WHERE id = 1',
      [name, description],
      err => {
        if (err) return next(err);
        res.redirect('/organiser');
      }
    );
  }
);

// POST /organiser/create-event - Create new draft event
// Input: None (creates empty draft)
// Output: Creates event in database and redirects to edit page
router.post('/create-event', (req, res, next) => {
  db.run(
    'INSERT INTO events (state) VALUES (?)',
    ['draft'],
    function(err) {
      if (err) return next(err);
      res.redirect(`/organiser/events/${this.lastID}/edit`);
    }
  );
});

// GET /organiser/events/:id/edit - Edit event page
// Input: Event ID in URL parameters
// Output: Renders edit form with event and ticket data
router.get('/events/:id/edit', (req, res, next) => {
  const eventId = req.params.id;
  
  // Get event details
  db.get('SELECT * FROM events WHERE id = ?', [eventId], (err1, event) => {
    if (err1) return next(err1);
    if (!event) return res.status(404).render('404');
    
    // Get ticket information for this event
    db.all('SELECT * FROM tickets WHERE event_id = ?', [eventId], (err2, tickets) => {
      if (err2) return next(err2);
      
      // Separate full and concession tickets
      const fullTicket = tickets.find(t => t.type === 'full') || { quantity: 0, price: 0 };
      const concTicket = tickets.find(t => t.type === 'concession') || { quantity: 0, price: 0 };
      
      res.render('edit-event', {
        event,
        fullTicket,
        concTicket,
        errors: []
      });
    });
  });
});

// POST /organiser/events/:id/edit - Update event
// Input: Event ID and form data {title, description, event_date, etc.}
// Output: Updates event and tickets in database
router.post('/events/:id/edit',
  [
    body('title').notEmpty().withMessage('Title is required'),
    body('description').notEmpty().withMessage('Description is required'),
    body('event_date').notEmpty().withMessage('Event date is required'),
    body('full_quantity').isInt({ min: 0 }).withMessage('Full ticket quantity must be 0 or more'),
    body('full_price').isFloat({ min: 0 }).withMessage('Full ticket price must be 0 or more'),
    body('conc_quantity').isInt({ min: 0 }).withMessage('Concession ticket quantity must be 0 or more'),
    body('conc_price').isFloat({ min: 0 }).withMessage('Concession ticket price must be 0 or more')
  ],
  (req, res, next) => {
    const eventId = req.params.id;
    const errors = validationResult(req);
    const { title, description, event_date, full_quantity, full_price, conc_quantity, conc_price } = req.body;
    
    if (!errors.isEmpty()) {
      // Reload page with errors
      const event = { id: eventId, title, description, event_date };
      const fullTicket = { quantity: full_quantity, price: full_price };
      const concTicket = { quantity: conc_quantity, price: conc_price };
      
      return res.render('edit-event', {
        event,
        fullTicket,
        concTicket,
        errors: errors.array()
      });
    }
    
    // Update event details
    db.run(
      'UPDATE events SET title = ?, description = ?, event_date = ? WHERE id = ?',
      [title, description, event_date, eventId],
      err1 => {
        if (err1) return next(err1);
        
        // Update or insert full ticket
        db.run(
          `INSERT OR REPLACE INTO tickets (id, event_id, type, quantity, price)
           VALUES ((SELECT id FROM tickets WHERE event_id = ? AND type = 'full'), ?, 'full', ?, ?)`,
          [eventId, eventId, full_quantity, full_price],
          err2 => {
            if (err2) return next(err2);
            
            // Update or insert concession ticket
            db.run(
              `INSERT OR REPLACE INTO tickets (id, event_id, type, quantity, price)
               VALUES ((SELECT id FROM tickets WHERE event_id = ? AND type = 'concession'), ?, 'concession', ?, ?)`,
              [eventId, eventId, conc_quantity, conc_price],
              err3 => {
                if (err3) return next(err3);
                res.redirect('/organiser');
              }
            );
          }
        );
      }
    );
  }
);

// POST /organiser/events/:id/publish - Publish event
// Input: Event ID in URL parameters
// Output: Updates event state to published and sets published_at timestamp
router.post('/events/:id/publish', (req, res, next) => {
  const eventId = req.params.id;
  
  db.run(
    `UPDATE events 
     SET state = 'published', published_at = datetime('now') 
     WHERE id = ?`,
    [eventId],
    err => {
      if (err) return next(err);
      res.redirect('/organiser');
    }
  );
});

// POST /organiser/events/:id/delete - Delete event
// Input: Event ID in URL parameters  
// Output: Removes event and associated tickets/bookings from database
router.post('/events/:id/delete', (req, res, next) => {
  const eventId = req.params.id;
  
  // Delete event (CASCADE will handle tickets and bookings)
  db.run('DELETE FROM events WHERE id = ?', [eventId], err => {
    if (err) return next(err);
    res.redirect('/organiser');
  });
});

// GET /organiser/bookings - View all bookings (additional functionality)
// Input: None
// Output: Renders page with all bookings across all events
router.get('/bookings', (req, res, next) => {
  db.all(`
    SELECT b.id, b.buyer_name, b.qty, b.booked_at,
           e.title AS event_title,
           t.type AS ticket_type,
           t.price,
           (b.qty * t.price) AS total_cost
    FROM bookings b
    JOIN events e ON b.event_id = e.id
    JOIN tickets t ON b.ticket_id = t.id
    ORDER BY datetime(b.booked_at) DESC
  `, (err, bookings) => {
    if (err) return next(err);
    res.render('organiser-bookings', { bookings: bookings || [] });
  });
});

module.exports = router;