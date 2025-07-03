// ========================================
// app.js - Main Application File
// ========================================

const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const methodOverride = require('method-override');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

// Database setup
const db = new sqlite3.Database('./auction_gala.db');
global.db = db;

// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(methodOverride('_method'));

// Database initialization
db.serialize(() => {
  // Site settings table
  db.run(`CREATE TABLE IF NOT EXISTS site_settings (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL
  )`);

  // Events table
  db.run(`CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    description TEXT,
    event_date TEXT,
    state TEXT DEFAULT 'draft',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_modified DATETIME DEFAULT CURRENT_TIMESTAMP,
    published_at DATETIME
  )`);

  // Tickets table
  db.run(`CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER,
    type TEXT,
    quantity INTEGER,
    price REAL,
    FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE
  )`);

  // Bookings table
  db.run(`CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER,
    ticket_id INTEGER,
    buyer_name TEXT,
    qty INTEGER,
    booked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE,
    FOREIGN KEY (ticket_id) REFERENCES tickets (id) ON DELETE CASCADE
  )`);

  // Insert default site settings if not exists
  db.get('SELECT * FROM site_settings WHERE id = 1', (err, row) => {
    if (!row) {
      db.run(`INSERT INTO site_settings (id, name, description) 
              VALUES (1, 'Auction Gala Planner', 'Professional event management and ticket booking system')`);
    }
  });
});

// Routes
app.use('/', require('./routes/index'));
app.use('/organiser', require('./routes/organiser'));
app.use('/attendee', require('./routes/attendee'));

// 404 handler
app.use((req, res) => {
  res.status(404).render('404');
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', { error: err });
});

app.listen(PORT, () => {
  console.log(`🚀 Auction Gala Planner running on http://localhost:${PORT}`);
});

module.exports = app;