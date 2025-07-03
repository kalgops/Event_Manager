// index.js
const express  = require('express');
const session  = require('express-session');
const sqlite3  = require('sqlite3').verbose();
const path     = require('path');

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

// session
app.use(
  session({
    secret: 'event-manager-secret',
    resave: false,
    saveUninitialized: false
  })
);

// flash current user into locals for all views
app.use((req, res, next) => {
  res.locals.isAuthenticated = req.session.isLoggedIn || false;
  res.locals.currentUser    = req.session.user || null;
  next();
});

// auth routes
app.use('/auth', require('./routes/auth'));

// organiser (now protected by isAuth)
app.use('/organiser', require('./routes/organiser'));

// attendee
app.use('/attendee', require('./routes/attendee'));

// home
app.get('/', (req, res) => res.render('index'));

// 404
app.use((req, res) => res.status(404).render('404'));

// error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Internal Server Error');
});

app.listen(PORT, () => console.log(`🚀 Listening on http://localhost:${PORT}`));
