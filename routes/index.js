// index.js - Main server file for Event Manager
// Sets up Express server with SQLite database and EJS templating

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to SQLite database
// Input: database.db file
// Output: Global database connection
global.db = new sqlite3.Database('database.db', err => {
  if (err) console.error('Database connection error:', err);
  else console.log('🗄️ Connected to SQLite');
});

// View engine setup - EJS for server-side rendering
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files middleware - serves CSS, JS, images from public folder
app.use(express.static(path.join(__dirname, 'public')));

// Body parsing middleware - handles form submissions
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Middleware to pass common variables to all templates
// Input: request, response, next function
// Output: Sets local variables for EJS templates
app.use((req, res, next) => {
  res.locals.isAuthenticated = false; // No authentication for base requirements
  next();
});

// Mount route modules
app.use('/organiser', require('./routes/organiser'));
app.use('/attendee', require('./routes/attendee'));

// GET / - Main home page with links to organiser and attendee sections
// Input: None
// Output: Renders main home page with navigation links
app.get('/', (req, res) => {
  res.render('index');
});

// 404 handler - catches all unmatched routes
// Input: Any unmatched route
// Output: 404 error page
app.use((req, res) => {
  res.status(404).render('404');
});

// Error handling middleware
// Input: Error object, request, response, next function
// Output: 500 error response
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).send('Internal Server Error');
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Listening on http://localhost:${PORT}`);
});