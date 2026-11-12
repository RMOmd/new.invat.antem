-- Supabase Database Schema for romanian_test_platform

-- 1. Table: user_progress
CREATE TABLE IF NOT EXISTS public.user_progress (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  activity_id TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  score INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  total_gaps INTEGER NOT NULL DEFAULT 0,
  user_answers JSONB DEFAULT '{}'::jsonb,
  last_attempt_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT user_activity_unique UNIQUE (user_id, activity_id)
);

-- 2. Table: submissions (written assignments for teacher review)
CREATE TABLE IF NOT EXISTS public.submissions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  user_name TEXT NOT NULL,
  activity_id TEXT NOT NULL,
  activity_title TEXT NOT NULL,
  submission_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'reviewed'
  grade INTEGER,
  teacher_feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated/anon operations for testing (or configure specific auth policies)
CREATE POLICY "Allow public read/write to user_progress" 
  ON public.user_progress FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read/write to submissions" 
  ON public.submissions FOR ALL USING (true) WITH CHECK (true);

