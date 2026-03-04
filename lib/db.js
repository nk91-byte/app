import Database from 'better-sqlite3';
import path from 'path';

let db;

export function getDb() {
  if (!db) {
    const dbPath = path.join(process.cwd(), 'sqlite-data', 'noteflow.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

export function setupSchema() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
      title TEXT,
      content TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
      note_id TEXT REFERENCES notes(id) ON DELETE SET NULL,
      parent_todo_id TEXT REFERENCES todos(id) ON DELETE CASCADE,
      text TEXT NOT NULL DEFAULT '',
      content TEXT,
      is_done INTEGER DEFAULT 0,
      done_at TEXT,
      archived_at TEXT,
      due_date TEXT,
      recurrence TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      position INTEGER
    );

    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'project',
      color TEXT,
      archived_at TEXT
    );

    CREATE TABLE IF NOT EXISTS note_tags (
      note_id TEXT REFERENCES notes(id) ON DELETE CASCADE,
      tag_id TEXT REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (note_id, tag_id)
    );

    CREATE TABLE IF NOT EXISTS todo_tags (
      todo_id TEXT REFERENCES todos(id) ON DELETE CASCADE,
      tag_id TEXT REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (todo_id, tag_id)
    );

    CREATE INDEX IF NOT EXISTS idx_notes_owner_id ON notes(owner_id);
    CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at);
    CREATE INDEX IF NOT EXISTS idx_todos_owner_id ON todos(owner_id);
    CREATE INDEX IF NOT EXISTS idx_todos_note_id ON todos(note_id);
    CREATE INDEX IF NOT EXISTS idx_todos_parent_todo_id ON todos(parent_todo_id);
    CREATE INDEX IF NOT EXISTS idx_todos_archived_at ON todos(archived_at);
    CREATE INDEX IF NOT EXISTS idx_todos_created_at ON todos(created_at);
    CREATE INDEX IF NOT EXISTS idx_tags_owner_id ON tags(owner_id);
  `);

  // Migration: Add recurrence column if it doesn't exist
  try {
    db.exec(`ALTER TABLE todos ADD COLUMN recurrence TEXT;`);
  } catch (e) {
    // Column already exists, ignore error
  }
}
