-- Supabase Database Schema for Romanian Learning Platform (ANTEM)

-- 1. Table: profiles (User profiles with roles)
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student', -- 'student' | 'teacher'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Table: user_progress (Tracks completed activities, scores and answers)
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

-- 3. Table: submissions (Written assignments for teacher review)
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

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- 5. Policies: Allow read & write operations
DROP POLICY IF EXISTS "Allow public read/write to profiles" ON public.profiles;
CREATE POLICY "Allow public read/write to profiles" 
  ON public.profiles FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write to user_progress" ON public.user_progress;
CREATE POLICY "Allow public read/write to user_progress" 
  ON public.user_progress FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write to submissions" ON public.submissions;
CREATE POLICY "Allow public read/write to submissions" 
  ON public.submissions FOR ALL USING (true) WITH CHECK (true);

-- 6. Trigger to automatically sync Supabase Auth users to public.profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'role', 'student')
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    role = EXCLUDED.role;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
