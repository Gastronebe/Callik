-- ===== Callík - SQL Migrace =====
-- Web: www.callik.fun
-- Provozovatel: Pavlína Šteiglová (info@callik.fun)
-- Verze: 2.0.0
-- Datum: 2026-01-17

-- ===== Tabulka profiles =====
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  avatar_number int NOT NULL CHECK (avatar_number >= 1 AND avatar_number <= 30),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- ===== Tabulka days =====
CREATE TABLE public.days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  goal_minutes int DEFAULT 0,
  goal_pay int DEFAULT 0,
  goal_calls int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE public.days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own days"
  ON public.days FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own days"
  ON public.days FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own days"
  ON public.days FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own days"
  ON public.days FOR DELETE
  USING (auth.uid() = user_id);

-- ===== Tabulka blocks =====
CREATE TABLE public.blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_id uuid NOT NULL REFERENCES public.days(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('work', 'break')),
  start time NOT NULL,
  "end" time NOT NULL,
  talk_minutes int,
  pay int,
  calls int,
  leads int,
  current_kpi text,
  reason text,
  project_id text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own blocks"
  ON public.blocks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own blocks"
  ON public.blocks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own blocks"
  ON public.blocks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own blocks"
  ON public.blocks FOR DELETE
  USING (auth.uid() = user_id);

-- ===== Tabulka projects =====
CREATE TABLE public.projects (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  target_kpi numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own projects"
  ON public.projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own projects"
  ON public.projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects"
  ON public.projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects"
  ON public.projects FOR DELETE
  USING (auth.uid() = user_id);

-- ===== Tabulka settings =====
CREATE TABLE public.settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  cumulative_mode boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings"
  ON public.settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON public.settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON public.settings FOR UPDATE
  USING (auth.uid() = user_id);

-- ===== Tabulka templates =====
CREATE TABLE public.templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  pattern jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own templates"
  ON public.templates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own templates"
  ON public.templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own templates"
  ON public.templates FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own templates"
  ON public.templates FOR DELETE
  USING (auth.uid() = user_id);

-- ===== Trigger pro přiřazení avataru a přezdívky =====
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  random_avatar_num int;
  random_prefix text;
  next_number int;
  new_display_name text;
  prefix_list text[] := ARRAY['lo', 'me', 'fr', 'wo', 'po', 'bo', 'be', 'to', 'le', 'ar', 'zu', 'ki', 'da', 'va', 'na', 'ra', 'si', 'ti', 'mo', 'ko'];
BEGIN
  random_avatar_num := floor(random() * 30 + 1)::int;
  random_prefix := prefix_list[floor(random() * array_length(prefix_list, 1) + 1)::int];

  SELECT COALESCE(MAX(
    NULLIF(regexp_replace(display_name, '[^0-9]', '', 'g'), '')::int
  ), 0) + 1 INTO next_number
  FROM public.profiles;

  new_display_name := random_prefix || 'callik' || LPAD(next_number::text, 2, '0');

  INSERT INTO public.profiles (id, display_name, avatar_number)
  VALUES (NEW.id, new_display_name, random_avatar_num);

  INSERT INTO public.settings (user_id, cumulative_mode)
  VALUES (NEW.id, false);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
