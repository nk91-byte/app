-- NoteFlow: PostgreSQL schema for Supabase
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===== TABLES =====

CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  content JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS todos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_id UUID REFERENCES notes(id) ON DELETE SET NULL,
  parent_todo_id UUID REFERENCES todos(id) ON DELETE CASCADE,
  text TEXT NOT NULL DEFAULT '',
  content JSONB,
  is_done BOOLEAN DEFAULT false,
  done_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  due_date DATE,
  recurrence JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  position INTEGER
);

CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'project',
  color TEXT,
  position INTEGER,
  archived_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS note_tags (
  note_id UUID REFERENCES notes(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, tag_id)
);

CREATE TABLE IF NOT EXISTS todo_tags (
  todo_id UUID REFERENCES todos(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (todo_id, tag_id)
);

-- ===== INDEXES =====

CREATE INDEX IF NOT EXISTS idx_notes_owner_id ON notes(owner_id);
CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at);
CREATE INDEX IF NOT EXISTS idx_todos_owner_id ON todos(owner_id);
CREATE INDEX IF NOT EXISTS idx_todos_note_id ON todos(note_id);
CREATE INDEX IF NOT EXISTS idx_todos_parent_todo_id ON todos(parent_todo_id);
CREATE INDEX IF NOT EXISTS idx_todos_archived_at ON todos(archived_at);
CREATE INDEX IF NOT EXISTS idx_todos_created_at ON todos(created_at);
CREATE INDEX IF NOT EXISTS idx_tags_owner_id ON tags(owner_id);

-- ===== ROW LEVEL SECURITY =====

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_tags ENABLE ROW LEVEL SECURITY;

-- Notes: users can only access their own notes
CREATE POLICY "Users can view own notes" ON notes FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can insert own notes" ON notes FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can update own notes" ON notes FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Users can delete own notes" ON notes FOR DELETE USING (auth.uid() = owner_id);

-- Todos: users can only access their own todos
CREATE POLICY "Users can view own todos" ON todos FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can insert own todos" ON todos FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can update own todos" ON todos FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Users can delete own todos" ON todos FOR DELETE USING (auth.uid() = owner_id);

-- Tags: users can only access their own tags
CREATE POLICY "Users can view own tags" ON tags FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can insert own tags" ON tags FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can update own tags" ON tags FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Users can delete own tags" ON tags FOR DELETE USING (auth.uid() = owner_id);

-- Note tags: users can access tags for their own notes
CREATE POLICY "Users can view own note_tags" ON note_tags FOR SELECT
  USING (EXISTS (SELECT 1 FROM notes WHERE notes.id = note_tags.note_id AND notes.owner_id = auth.uid()));
CREATE POLICY "Users can insert own note_tags" ON note_tags FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM notes WHERE notes.id = note_tags.note_id AND notes.owner_id = auth.uid()));
CREATE POLICY "Users can delete own note_tags" ON note_tags FOR DELETE
  USING (EXISTS (SELECT 1 FROM notes WHERE notes.id = note_tags.note_id AND notes.owner_id = auth.uid()));

-- User preferences (saved views, settings)
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(owner_id, key)
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_owner_id ON user_preferences(owner_id);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences" ON user_preferences FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can insert own preferences" ON user_preferences FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can update own preferences" ON user_preferences FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Users can delete own preferences" ON user_preferences FOR DELETE USING (auth.uid() = owner_id);

-- Todo tags: users can access tags for their own todos
CREATE POLICY "Users can view own todo_tags" ON todo_tags FOR SELECT
  USING (EXISTS (SELECT 1 FROM todos WHERE todos.id = todo_tags.todo_id AND todos.owner_id = auth.uid()));
CREATE POLICY "Users can insert own todo_tags" ON todo_tags FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM todos WHERE todos.id = todo_tags.todo_id AND todos.owner_id = auth.uid()));
CREATE POLICY "Users can delete own todo_tags" ON todo_tags FOR DELETE
  USING (EXISTS (SELECT 1 FROM todos WHERE todos.id = todo_tags.todo_id AND todos.owner_id = auth.uid()));
