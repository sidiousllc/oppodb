-- Drop the expression-based index
DROP INDEX IF EXISTS public.intel_briefings_dedup_key;

-- Backfill: ensure region and published_at are not NULL so plain unique index works
UPDATE public.intel_briefings SET region = '' WHERE region IS NULL;
UPDATE public.intel_briefings SET published_at = 'epoch'::timestamptz WHERE published_at IS NULL;

-- Set defaults so future inserts always have values
ALTER TABLE public.intel_briefings ALTER COLUMN region SET DEFAULT '';
ALTER TABLE public.intel_briefings ALTER COLUMN region SET NOT NULL;
ALTER TABLE public.intel_briefings ALTER COLUMN published_at SET DEFAULT now();
ALTER TABLE public.intel_briefings ALTER COLUMN published_at SET NOT NULL;

-- Re-dedupe after backfill
DELETE FROM public.intel_briefings a
USING public.intel_briefings b
WHERE a.ctid > b.ctid
  AND a.title = b.title
  AND a.source_name = b.source_name
  AND a.region = b.region
  AND a.published_at = b.published_at;

-- Plain unique index on the four columns
CREATE UNIQUE INDEX IF NOT EXISTS intel_briefings_dedup_key
  ON public.intel_briefings (title, source_name, region, published_at);