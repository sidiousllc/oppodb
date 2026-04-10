
CREATE TABLE public.district_news_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_name TEXT NOT NULL UNIQUE,
  articles JSONB NOT NULL DEFAULT '[]'::jsonb,
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.district_news_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read cached news"
  ON public.district_news_cache FOR SELECT
  USING (true);
