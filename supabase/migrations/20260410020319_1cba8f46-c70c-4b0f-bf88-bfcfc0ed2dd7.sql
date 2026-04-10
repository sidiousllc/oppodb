
-- Create wiki_pages table for editable documentation
CREATE TABLE public.wiki_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.wiki_pages ENABLE ROW LEVEL SECURITY;

-- Anyone can read published wiki pages
CREATE POLICY "Anyone can read published wiki_pages"
ON public.wiki_pages
FOR SELECT
USING (published = true);

-- Admins and mods can read all (including unpublished)
CREATE POLICY "Admins and mods can read all wiki_pages"
ON public.wiki_pages
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

-- Admins and mods can insert
CREATE POLICY "Admins and mods can insert wiki_pages"
ON public.wiki_pages
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

-- Admins and mods can update
CREATE POLICY "Admins and mods can update wiki_pages"
ON public.wiki_pages
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

-- Only admins can delete
CREATE POLICY "Admins can delete wiki_pages"
ON public.wiki_pages
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Index for ordering
CREATE INDEX idx_wiki_pages_sort_order ON public.wiki_pages (sort_order);
