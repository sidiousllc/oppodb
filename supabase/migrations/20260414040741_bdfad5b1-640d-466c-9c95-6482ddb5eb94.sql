
-- Add tags to international_profiles
ALTER TABLE public.international_profiles
ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}'::text[];

CREATE INDEX IF NOT EXISTS idx_intl_profiles_tags ON public.international_profiles USING GIN(tags);

-- Add tags to international_elections
ALTER TABLE public.international_elections
ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}'::text[];

CREATE INDEX IF NOT EXISTS idx_intl_elections_tags ON public.international_elections USING GIN(tags);

-- Add tags to international_leaders
ALTER TABLE public.international_leaders
ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}'::text[];

CREATE INDEX IF NOT EXISTS idx_intl_leaders_tags ON public.international_leaders USING GIN(tags);
