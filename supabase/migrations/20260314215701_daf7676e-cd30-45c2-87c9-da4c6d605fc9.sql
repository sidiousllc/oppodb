-- Create maga_files table
CREATE TABLE IF NOT EXISTS public.maga_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.maga_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read maga_files" ON public.maga_files
  FOR SELECT TO public USING (true);

CREATE POLICY "Admins and mods can insert maga_files" ON public.maga_files
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE POLICY "Admins and mods can update maga_files" ON public.maga_files
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE POLICY "Admins can delete maga_files" ON public.maga_files
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Create local_impacts table
CREATE TABLE IF NOT EXISTS public.local_impacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state text NOT NULL,
  slug text NOT NULL UNIQUE,
  summary text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.local_impacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read local_impacts" ON public.local_impacts
  FOR SELECT TO public USING (true);

CREATE POLICY "Admins and mods can insert local_impacts" ON public.local_impacts
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE POLICY "Admins and mods can update local_impacts" ON public.local_impacts
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE POLICY "Admins can delete local_impacts" ON public.local_impacts
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Create narrative_reports table
CREATE TABLE IF NOT EXISTS public.narrative_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.narrative_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read narrative_reports" ON public.narrative_reports
  FOR SELECT TO public USING (true);

CREATE POLICY "Admins and mods can insert narrative_reports" ON public.narrative_reports
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE POLICY "Admins and mods can update narrative_reports" ON public.narrative_reports
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE POLICY "Admins can delete narrative_reports" ON public.narrative_reports
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));