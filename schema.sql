CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS memory_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (provider, provider_user_id)
);

CREATE TABLE IF NOT EXISTS google_connections (
  user_id UUID PRIMARY KEY REFERENCES memory_users(id) ON DELETE CASCADE,
  google_sub TEXT,
  email TEXT,
  encrypted_refresh_token TEXT NOT NULL,
  drive_root_folder_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS experience_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES memory_users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  user_note TEXT NOT NULL,
  activity TEXT,
  location TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  mood TEXT[] NOT NULL DEFAULT '{}',
  drive_file_id TEXT,
  drive_note_file_id TEXT,
  drive_url TEXT NOT NULL,
  markdown_url TEXT,
  raw_analysis JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE experience_memories
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES memory_users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS experience_memories_tags_idx
ON experience_memories
USING GIN (tags);

CREATE INDEX IF NOT EXISTS experience_memories_user_id_idx
ON experience_memories (user_id);

CREATE INDEX IF NOT EXISTS experience_memories_mood_idx
ON experience_memories
USING GIN (mood);

CREATE INDEX IF NOT EXISTS experience_memories_occurred_at_idx
ON experience_memories (occurred_at DESC);

CREATE INDEX IF NOT EXISTS experience_memories_text_idx
ON experience_memories
USING GIN (to_tsvector('simple', title || ' ' || summary || ' ' || user_note));
