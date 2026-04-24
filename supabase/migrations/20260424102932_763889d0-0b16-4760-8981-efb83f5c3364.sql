-- Remove existing duplicates, keeping the earliest-created row per (title, source_name, region, published_at)
DELETE FROM public.intel_briefings a
USING public.intel_briefings b
WHERE a.ctid > b.ctid
  AND COALESCE(a.title, '') = COALESCE(b.title, '')
  AND COALESCE(a.source_name, '') = COALESCE(b.source_name, '')
  AND COALESCE(a.region, '') = COALESCE(b.region, '')
  AND COALESCE(a.published_at, 'epoch'::timestamptz) = COALESCE(b.published_at, 'epoch'::timestamptz);

-- Drop older partial unique index if present
DROP INDEX IF EXISTS public.intel_briefings_title_source_name_key;

-- Create unique index for de-duplication across syncs
CREATE UNIQUE INDEX IF NOT EXISTS intel_briefings_dedup_key
  ON public.intel_briefings (
    title,
    source_name,
    COALESCE(region, ''),
    COALESCE(published_at, 'epoch'::timestamptz)
  );