
-- Phase 0: Ground News parity data model

-- 1. Source ratings (bias + factuality + ownership)
CREATE TABLE public.news_source_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name TEXT NOT NULL UNIQUE,
  source_domain TEXT,
  bias TEXT NOT NULL CHECK (bias IN ('left','lean-left','center','lean-right','right','unknown')),
  factuality TEXT NOT NULL DEFAULT 'mixed' CHECK (factuality IN ('high','mostly-factual','mixed','low','very-low','unknown')),
  ownership TEXT,
  country TEXT DEFAULT 'US',
  is_sponsored BOOLEAN NOT NULL DEFAULT false,
  rating_source TEXT NOT NULL DEFAULT 'static',
  confidence NUMERIC(3,2) DEFAULT 0.80,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_news_source_ratings_domain ON public.news_source_ratings(source_domain);
ALTER TABLE public.news_source_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read source ratings"
  ON public.news_source_ratings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage source ratings"
  ON public.news_source_ratings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. Story clusters
CREATE TABLE public.news_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  summary TEXT,
  scope TEXT NOT NULL DEFAULT 'national',
  category TEXT,
  topic_keywords TEXT[] DEFAULT '{}',
  article_count INTEGER NOT NULL DEFAULT 0,
  left_count INTEGER NOT NULL DEFAULT 0,
  center_count INTEGER NOT NULL DEFAULT 0,
  right_count INTEGER NOT NULL DEFAULT 0,
  unrated_count INTEGER NOT NULL DEFAULT 0,
  left_pct NUMERIC(5,2) DEFAULT 0,
  center_pct NUMERIC(5,2) DEFAULT 0,
  right_pct NUMERIC(5,2) DEFAULT 0,
  is_blindspot BOOLEAN NOT NULL DEFAULT false,
  blindspot_side TEXT CHECK (blindspot_side IN ('left','right','center', NULL)),
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_news_stories_scope ON public.news_stories(scope);
CREATE INDEX idx_news_stories_blindspot ON public.news_stories(is_blindspot) WHERE is_blindspot = true;
CREATE INDEX idx_news_stories_last_updated ON public.news_stories(last_updated_at DESC);
ALTER TABLE public.news_stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read stories"
  ON public.news_stories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage stories"
  ON public.news_stories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. Story <-> articles join
CREATE TABLE public.news_story_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.news_stories(id) ON DELETE CASCADE,
  briefing_id UUID NOT NULL,
  source_name TEXT NOT NULL,
  bias TEXT,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(story_id, briefing_id)
);
CREATE INDEX idx_news_story_articles_story ON public.news_story_articles(story_id);
CREATE INDEX idx_news_story_articles_briefing ON public.news_story_articles(briefing_id);
ALTER TABLE public.news_story_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read story articles"
  ON public.news_story_articles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage story articles"
  ON public.news_story_articles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. User preferences
CREATE TABLE public.user_news_preferences (
  user_id UUID PRIMARY KEY,
  followed_topics TEXT[] DEFAULT '{}',
  followed_sources TEXT[] DEFAULT '{}',
  blocked_sources TEXT[] DEFAULT '{}',
  followed_regions TEXT[] DEFAULT '{}',
  preferred_bias_balance TEXT DEFAULT 'balanced',
  hide_sponsored BOOLEAN NOT NULL DEFAULT true,
  min_factuality TEXT DEFAULT 'mixed',
  digest_frequency TEXT DEFAULT 'weekly' CHECK (digest_frequency IN ('off','daily','weekly')),
  digest_last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_news_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own news prefs"
  ON public.user_news_preferences FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users insert own news prefs"
  ON public.user_news_preferences FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own news prefs"
  ON public.user_news_preferences FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users delete own news prefs"
  ON public.user_news_preferences FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 5. User bias reading history (rolling tally)
CREATE TABLE public.user_bias_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  briefing_id UUID,
  source_name TEXT NOT NULL,
  bias TEXT NOT NULL,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_user_bias_history_user ON public.user_bias_history(user_id, read_at DESC);
ALTER TABLE public.user_bias_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own bias history"
  ON public.user_bias_history FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users insert own bias history"
  ON public.user_bias_history FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own bias history"
  ON public.user_bias_history FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 6. URL bias check cache
CREATE TABLE public.url_bias_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL UNIQUE,
  url_hash TEXT NOT NULL UNIQUE,
  title TEXT,
  source_name TEXT,
  bias TEXT,
  factuality TEXT,
  reasoning TEXT,
  excerpt TEXT,
  ai_model TEXT,
  checked_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '30 days')
);
CREATE INDEX idx_url_bias_checks_hash ON public.url_bias_checks(url_hash);
ALTER TABLE public.url_bias_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read url bias checks"
  ON public.url_bias_checks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert url bias checks"
  ON public.url_bias_checks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = checked_by OR checked_by IS NULL);
CREATE POLICY "Admins manage url bias checks"
  ON public.url_bias_checks FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete url bias checks"
  ON public.url_bias_checks FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- updated_at triggers
CREATE TRIGGER trg_news_source_ratings_updated
  BEFORE UPDATE ON public.news_source_ratings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_user_news_preferences_updated
  BEFORE UPDATE ON public.user_news_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
