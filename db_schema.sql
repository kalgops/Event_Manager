-- Enable foreign keys
PRAGMA foreign_keys = ON;

BEGIN TRANSACTION;

-- Single row for site settings
CREATE TABLE IF NOT EXISTS site_settings (
  id          INTEGER PRIMARY KEY CHECK(id = 1),
  name        TEXT    NOT NULL,
  description TEXT    NOT NULL
);
INSERT OR IGNORE INTO site_settings (id, name, description)
VALUES (1, 'Auction Gala Planner', 'Plan and run your events with ease.');

-- Events table
CREATE TABLE IF NOT EXISTS events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  title         TEXT    NOT NULL DEFAULT 'Untitled Event',
  description   TEXT    NOT NULL DEFAULT '',
  event_date    TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  last_modified TEXT    NOT NULL DEFAULT (datetime('now')),
  published_at  TEXT,
  state         TEXT    NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','published'))
);

-- Tickets table (full vs concession)
CREATE TABLE IF NOT EXISTS tickets (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id   INTEGER NOT NULL,
  type       TEXT    NOT NULL CHECK(type IN ('full','concession')),
  price      REAL    NOT NULL DEFAULT 0,
  quantity   INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- Bookings table linking attendees to tickets
CREATE TABLE IF NOT EXISTS bookings (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id    INTEGER NOT NULL,
  ticket_id   INTEGER NOT NULL,
  buyer_name  TEXT    NOT NULL,
  qty         INTEGER NOT NULL,
  booked_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (event_id)  REFERENCES events(id)  ON DELETE CASCADE,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
);

COMMIT;
