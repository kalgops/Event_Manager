const express = require('express');
const router  = express.Router();
const db      = global.db;
const { body, validationResult } = require('express-validator');

/**
 * GET /attendee
 * — Attendee Home Page
 */
router.get('/', (req, res, next) => {
  // load site settings
  db.get(
    'SELECT name, description FROM site_settings WHERE id = 1',
    (err, settings) => {
      if (err) return next(err);

      // load all published events, soonest first
      db.all(
        `SELECT id, title, event_date
         FROM events
         WHERE state = 'published'
         ORDER BY datetime(event_date) ASC`,
        (err2, events) => {
          if (err2) return next(err2);

          res.render('attendee-home', { settings, events });
        }
      );
    }
  );
});

/**
 * GET /attendee/events/:id
 * — Attendee Event Page (view & book)
 */
router.get('/events/:id', (req, res, next) => {
  const eventId = req.params.id;
  db.get(
    'SELECT name, description FROM site_settings WHERE id = 1',
    (err, settings) => {
      if (err) return next(err);
      db.get(
        'SELECT * FROM events WHERE id = ? AND state = "published"',
        [eventId],
        (err2, event) => {
          if (err2) return next(err2);
          if (!event) return res.status(404).render('404');

          db.all(
            'SELECT id, type, price, quantity FROM tickets WHERE event_id = ?',
            [eventId],
            (err3, tickets) => {
              if (err3) return next(err3);
              res.render('attendee-event', {
                settings,
                event,
                tickets,
                errors: [],
                formData: {}
              });
            }
          );
        }
      );
    }
  );
});

/**
 * POST /attendee/events/:id/book
 * — Handle booking submission
 */
router.post(
  '/events/:id/book',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('tickets.*.quantity').isInt({ min: 0 }).withMessage('Quantity must be a non-negative integer')
  ],
  (req, res, next) => {
    const eventId = req.params.id;
    const errors  = validationResult(req);

    // reload event + tickets
    db.get('SELECT * FROM events WHERE id = ?', [eventId], (err, event) => {
      if (err) return next(err);
      if (!event) return res.status(404).render('404');

      db.all(
        'SELECT id, type, price, quantity FROM tickets WHERE event_id = ?',
        [eventId],
        (err2, tickets) => {
          if (err2) return next(err2);

          // validation errors?
          if (!errors.isEmpty()) {
            return res.render('attendee-event', {
              settings: req.body.settings,
              event,
              tickets,
              errors: errors.array(),
              formData: req.body
            });
          }

          // build desired array
          const desired = tickets.map(t => ({
            id:        t.id,
            want:      parseInt(req.body[`tickets[${t.id}][quantity]`], 10) || 0,
            available: t.quantity
          }));

          // any overbook?
          const over = desired.find(d => d.want > d.available);
          if (over) {
            return res.render('attendee-event', {
              settings: req.body.settings,
              event,
              tickets,
              errors: [{ msg: `Only ${over.available} tickets left for that category.` }],
              formData: req.body
            });
          }

          // commit transaction
          db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            desired.forEach(d => {
              if (d.want > 0) {
                db.run(
                  'UPDATE tickets SET quantity = quantity - ? WHERE id = ?',
                  [d.want, d.id]
                );
              }
            });
            db.run('COMMIT', err3 => {
              if (err3) return next(err3);
              res.redirect('/attendee?booked=1');
            });
          });
        }
      );
    });
  }
);

module.exports = router;
