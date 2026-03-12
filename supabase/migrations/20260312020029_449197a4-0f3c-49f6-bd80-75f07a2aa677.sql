CREATE TABLE public.candidate_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  github_path text NOT NULL,
  commit_sha text NOT NULL,
  commit_date timestamp with time zone NOT NULL,
  commit_message text NOT NULL DEFAULT '',
  author text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(github_path, commit_sha)
);

ALTER TABLE public.candidate_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read candidate_versions"
  ON public.candidate_versions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE INDEX idx_candidate_versions_path ON public.candidate_versions(github_path);
CREATE INDEX idx_candidate_versions_date ON public.candidate_versions(commit_date DESC);