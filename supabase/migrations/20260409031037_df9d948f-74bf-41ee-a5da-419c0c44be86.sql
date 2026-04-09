
ALTER TABLE public.candidate_profiles ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.maga_files ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.local_impacts ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.narrative_reports ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_candidate_profiles_tags ON public.candidate_profiles USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_maga_files_tags ON public.maga_files USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_local_impacts_tags ON public.local_impacts USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_narrative_reports_tags ON public.narrative_reports USING GIN(tags);
