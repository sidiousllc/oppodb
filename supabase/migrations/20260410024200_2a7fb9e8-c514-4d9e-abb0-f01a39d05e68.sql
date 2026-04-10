
CREATE TABLE public.wiki_changelog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  old_content TEXT NOT NULL DEFAULT '',
  new_content TEXT NOT NULL DEFAULT '',
  change_type TEXT NOT NULL DEFAULT 'updated',
  triggered_by UUID,
  trigger_method TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.wiki_changelog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read wiki changelog"
  ON public.wiki_changelog
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage wiki changelog"
  ON public.wiki_changelog
  FOR ALL
  TO public
  USING (auth.role() = 'service_role'::text)
  WITH CHECK (auth.role() = 'service_role'::text);

CREATE INDEX idx_wiki_changelog_slug ON public.wiki_changelog (slug);
CREATE INDEX idx_wiki_changelog_created ON public.wiki_changelog (created_at DESC);
