// index.js
const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const path    = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// connect to SQLite
global.db = new sqlite3.Database('database.db', err => {
  if (err) console.error(err);
  else console.log('🗄️ Connected to SQLite');
});

// view engine + static
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// body parsers
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// session stub
app.use(session({ secret: 'auction-secret', resave: false, saveUninitialized: true }));

// routes
app.use('/organiser', require('./routes/organiser'));
app.use('/attendee',  require('./routes/attendee'));

// main home
app.get('/', (req, res) => res.render('index'));

// 404
app.use((req, res) => res.status(404).render('404'));

// error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Internal Server Error');
});

app.listen(PORT, () => console.log(`🚀 Listening on http://localhost:${PORT}`));
