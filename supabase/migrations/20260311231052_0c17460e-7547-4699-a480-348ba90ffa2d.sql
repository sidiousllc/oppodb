CREATE TABLE public.candidate_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  name text NOT NULL,
  content text NOT NULL DEFAULT '',
  github_path text NOT NULL,
  is_subpage boolean NOT NULL DEFAULT false,
  parent_slug text,
  subpage_title text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(github_path)
);

CREATE TABLE public.sync_metadata (
  id int PRIMARY KEY DEFAULT 1,
  last_commit_sha text,
  last_synced_at timestamptz DEFAULT now()
);

-- Allow public read access (no auth needed for browsing)
ALTER TABLE public.candidate_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read candidate profiles" ON public.candidate_profiles FOR SELECT USING (true);

ALTER TABLE public.sync_metadata ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read sync metadata" ON public.sync_metadata FOR SELECT USING (true);

-- Insert initial sync metadata row
INSERT INTO public.sync_metadata (id, last_commit_sha, last_synced_at) VALUES (1, null, null);

-- Create indexes
CREATE INDEX idx_candidate_profiles_slug ON public.candidate_profiles(slug);
CREATE INDEX idx_candidate_profiles_parent ON public.candidate_profiles(parent_slug);
CREATE INDEX idx_candidate_profiles_is_subpage ON public.candidate_profiles(is_subpage);