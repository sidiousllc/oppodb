-- =====================================================================
-- PHASE 0/1/2 FOUNDATIONS — Opposition Research + Political Intel
-- =====================================================================

-- Helper: updated_at trigger function (idempotent)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =====================================================================
-- SHARED PRIMITIVES
-- =====================================================================

-- Saved searches
CREATE TABLE public.saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'global', -- global | candidates | bills | districts | finance | intel
  query TEXT NOT NULL DEFAULT '',
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  alert_enabled BOOLEAN NOT NULL DEFAULT false,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own saved searches" ON public.saved_searches
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX idx_saved_searches_user ON public.saved_searches(user_id);
CREATE TRIGGER trg_saved_searches_updated BEFORE UPDATE ON public.saved_searches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Watchlist items
CREATE TABLE public.watchlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  entity_type TEXT NOT NULL, -- candidate | district | bill | race | stakeholder | committee | country
  entity_id TEXT NOT NULL,
  label TEXT,
  notes TEXT,
  alert_on_change BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, entity_type, entity_id)
);
ALTER TABLE public.watchlist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own watchlist" ON public.watchlist_items
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX idx_watchlist_user ON public.watchlist_items(user_id);
CREATE INDEX idx_watchlist_entity ON public.watchlist_items(entity_type, entity_id);

-- Entity notes
CREATE TABLE public.entity_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  is_shared BOOLEAN NOT NULL DEFAULT false,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  mentions UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.entity_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own or shared notes" ON public.entity_notes
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR is_shared = true OR auth.uid() = ANY(mentions));
CREATE POLICY "Users insert own notes" ON public.entity_notes
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own notes" ON public.entity_notes
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own notes" ON public.entity_notes
  FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX idx_entity_notes_entity ON public.entity_notes(entity_type, entity_id);
CREATE INDEX idx_entity_notes_user ON public.entity_notes(user_id);
CREATE TRIGGER trg_entity_notes_updated BEFORE UPDATE ON public.entity_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Entity activity feed
CREATE TABLE public.entity_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  event_type TEXT NOT NULL, -- created | updated | rating_changed | poll_added | bill_action | finance_filed
  summary TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.entity_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read activity" ON public.entity_activity
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role writes activity" ON public.entity_activity
  FOR INSERT TO public WITH CHECK (auth.role() = 'service_role');
CREATE INDEX idx_entity_activity_entity ON public.entity_activity(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_entity_activity_created ON public.entity_activity(created_at DESC);

-- Notifications (in-app inbox)
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  category TEXT NOT NULL DEFAULT 'general', -- alert | mention | war_room | system | forecast
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  link TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Service role inserts notifications" ON public.notifications
  FOR INSERT TO public WITH CHECK (auth.role() = 'service_role');
CREATE INDEX idx_notifications_user ON public.notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON public.notifications(user_id) WHERE read_at IS NULL;

-- Webhook endpoints (Slack/Discord)
CREATE TABLE public.webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  channel TEXT NOT NULL, -- slack | discord | generic
  url TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own webhooks" ON public.webhook_endpoints
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX idx_webhook_endpoints_user ON public.webhook_endpoints(user_id);
CREATE TRIGGER trg_webhook_endpoints_updated BEFORE UPDATE ON public.webhook_endpoints
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================================
-- PHASE 1 — OPPOSITION RESEARCH
-- =====================================================================

-- Trackers (Kanban-style boards)
CREATE TABLE public.oppo_trackers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  scope TEXT NOT NULL DEFAULT 'race', -- race | candidate | topic | district
  scope_ref TEXT, -- e.g. candidate slug, district id
  columns JSONB NOT NULL DEFAULT '["Backlog","In Research","Verified","Published"]'::jsonb,
  is_shared BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.oppo_trackers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own or shared trackers" ON public.oppo_trackers
  FOR SELECT TO authenticated USING (owner_id = auth.uid() OR is_shared = true);
CREATE POLICY "Owner manages tracker" ON public.oppo_trackers
  FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE INDEX idx_oppo_trackers_owner ON public.oppo_trackers(owner_id);
CREATE TRIGGER trg_oppo_trackers_updated BEFORE UPDATE ON public.oppo_trackers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Tracker items (cards)
CREATE TABLE public.oppo_tracker_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracker_id UUID NOT NULL REFERENCES public.oppo_trackers(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  column_name TEXT NOT NULL DEFAULT 'Backlog',
  position INTEGER NOT NULL DEFAULT 0,
  priority TEXT NOT NULL DEFAULT 'medium', -- low | medium | high | critical
  assignee_id UUID,
  due_date DATE,
  tags TEXT[] NOT NULL DEFAULT '{}',
  source_urls TEXT[] NOT NULL DEFAULT '{}',
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'open', -- open | done | archived
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.oppo_tracker_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read tracker items if tracker visible" ON public.oppo_tracker_items
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.oppo_trackers t WHERE t.id = tracker_id AND (t.owner_id = auth.uid() OR t.is_shared = true))
  );
CREATE POLICY "Insert items in own/shared trackers" ON public.oppo_tracker_items
  FOR INSERT TO authenticated WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (SELECT 1 FROM public.oppo_trackers t WHERE t.id = tracker_id AND (t.owner_id = auth.uid() OR t.is_shared = true))
  );
CREATE POLICY "Update items in own/shared trackers" ON public.oppo_tracker_items
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.oppo_trackers t WHERE t.id = tracker_id AND (t.owner_id = auth.uid() OR t.is_shared = true))
  );
CREATE POLICY "Delete items if creator or owner" ON public.oppo_tracker_items
  FOR DELETE TO authenticated USING (
    created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM public.oppo_trackers t WHERE t.id = tracker_id AND t.owner_id = auth.uid())
  );
CREATE INDEX idx_tracker_items_tracker ON public.oppo_tracker_items(tracker_id, column_name, position);
CREATE TRIGGER trg_tracker_items_updated BEFORE UPDATE ON public.oppo_tracker_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- War rooms
CREATE TABLE public.war_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  race_scope TEXT, -- e.g. "TX-15", "Senate-PA"
  pinned_entities JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.war_rooms ENABLE ROW LEVEL SECURITY;

-- War room members
CREATE TABLE public.war_room_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  war_room_id UUID NOT NULL REFERENCES public.war_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer', -- owner | editor | viewer
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (war_room_id, user_id)
);
ALTER TABLE public.war_room_members ENABLE ROW LEVEL SECURITY;

-- Helper function: is user member of a war room? (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.is_war_room_member(_room_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.war_room_members WHERE war_room_id = _room_id AND user_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.war_rooms WHERE id = _room_id AND owner_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.war_room_role(_room_id UUID, _user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.war_rooms WHERE id = _room_id AND owner_id = _user_id) THEN 'owner'
    ELSE (SELECT role FROM public.war_room_members WHERE war_room_id = _room_id AND user_id = _user_id LIMIT 1)
  END;
$$;

CREATE POLICY "Read war rooms if member or owner" ON public.war_rooms
  FOR SELECT TO authenticated USING (public.is_war_room_member(id, auth.uid()));
CREATE POLICY "Owner inserts war room" ON public.war_rooms
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owner updates war room" ON public.war_rooms
  FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owner deletes war room" ON public.war_rooms
  FOR DELETE TO authenticated USING (owner_id = auth.uid());
CREATE INDEX idx_war_rooms_owner ON public.war_rooms(owner_id);
CREATE TRIGGER trg_war_rooms_updated BEFORE UPDATE ON public.war_rooms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Read war room members if member" ON public.war_room_members
  FOR SELECT TO authenticated USING (public.is_war_room_member(war_room_id, auth.uid()));
CREATE POLICY "Owner manages members" ON public.war_room_members
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.war_rooms WHERE id = war_room_id AND owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.war_rooms WHERE id = war_room_id AND owner_id = auth.uid())
  );
CREATE INDEX idx_war_room_members_room ON public.war_room_members(war_room_id);
CREATE INDEX idx_war_room_members_user ON public.war_room_members(user_id);

-- War room messages
CREATE TABLE public.war_room_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  war_room_id UUID NOT NULL REFERENCES public.war_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  body TEXT NOT NULL,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.war_room_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read war room messages if member" ON public.war_room_messages
  FOR SELECT TO authenticated USING (public.is_war_room_member(war_room_id, auth.uid()));
CREATE POLICY "Members post war room messages" ON public.war_room_messages
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid() AND public.is_war_room_member(war_room_id, auth.uid())
  );
CREATE POLICY "Authors delete own messages" ON public.war_room_messages
  FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX idx_war_room_messages_room ON public.war_room_messages(war_room_id, created_at DESC);

-- Vulnerability scores (AI-cached)
CREATE TABLE public.vulnerability_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_slug TEXT NOT NULL UNIQUE,
  overall_score NUMERIC, -- 0-100
  category_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  top_vulnerabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT 'google/gemini-2.5-pro',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.vulnerability_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read vulnerability scores" ON public.vulnerability_scores
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role manages vuln scores" ON public.vulnerability_scores
  FOR ALL TO public USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Admins manage vuln scores" ON public.vulnerability_scores
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_vuln_scores_updated BEFORE UPDATE ON public.vulnerability_scores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Talking points (AI-generated)
CREATE TABLE public.talking_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type TEXT NOT NULL, -- candidate | bill | issue
  subject_ref TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT 'general', -- general | press | donors | volunteers | base
  angle TEXT NOT NULL DEFAULT 'attack', -- attack | defense | contrast | persuasion
  points JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  model TEXT NOT NULL DEFAULT 'google/gemini-2.5-pro',
  generated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.talking_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read talking points" ON public.talking_points
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users create talking points" ON public.talking_points
  FOR INSERT TO authenticated WITH CHECK (generated_by = auth.uid() OR auth.role() = 'service_role');
CREATE POLICY "Admins manage talking points" ON public.talking_points
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX idx_talking_points_subject ON public.talking_points(subject_type, subject_ref);
CREATE TRIGGER trg_talking_points_updated BEFORE UPDATE ON public.talking_points
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================================
-- PHASE 2 — POLITICAL INTEL
-- =====================================================================

-- Stakeholders (CRM)
CREATE TABLE public.stakeholders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'contact', -- donor | journalist | staffer | elected | lobbyist | activist | contact
  organization TEXT,
  title TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  state_abbr TEXT,
  party TEXT,
  influence_score INTEGER DEFAULT 50, -- 0-100
  tags TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT NOT NULL DEFAULT '',
  social_handles JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.stakeholders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own stakeholders" ON public.stakeholders
  FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE INDEX idx_stakeholders_owner ON public.stakeholders(owner_id);
CREATE INDEX idx_stakeholders_type ON public.stakeholders(type);
CREATE TRIGGER trg_stakeholders_updated BEFORE UPDATE ON public.stakeholders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Stakeholder interactions
CREATE TABLE public.stakeholder_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stakeholder_id UUID NOT NULL REFERENCES public.stakeholders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  interaction_type TEXT NOT NULL DEFAULT 'note', -- call | meeting | email | event | note
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  outcome TEXT,
  follow_up_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.stakeholder_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own interactions" ON public.stakeholder_interactions
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX idx_interactions_stakeholder ON public.stakeholder_interactions(stakeholder_id, occurred_at DESC);

-- Bill impact analyses (AI-cached)
CREATE TABLE public.bill_impact_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'national', -- national | state | district
  scope_ref TEXT, -- e.g. "TX-15" or "CA"
  summary TEXT NOT NULL DEFAULT '',
  winners JSONB NOT NULL DEFAULT '[]'::jsonb,
  losers JSONB NOT NULL DEFAULT '[]'::jsonb,
  fiscal_impact TEXT,
  political_impact TEXT,
  affected_groups JSONB NOT NULL DEFAULT '[]'::jsonb,
  model TEXT NOT NULL DEFAULT 'google/gemini-2.5-pro',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bill_id, scope, scope_ref)
);
ALTER TABLE public.bill_impact_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read bill impacts" ON public.bill_impact_analyses
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role manages bill impacts" ON public.bill_impact_analyses
  FOR ALL TO public USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Admins manage bill impacts" ON public.bill_impact_analyses
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX idx_bill_impacts_bill ON public.bill_impact_analyses(bill_id);
CREATE TRIGGER trg_bill_impacts_updated BEFORE UPDATE ON public.bill_impact_analyses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Alert rules
CREATE TABLE public.alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  entity_type TEXT, -- candidate | district | bill | race | keyword | global
  entity_id TEXT,
  event_types TEXT[] NOT NULL DEFAULT '{}', -- rating_change, new_poll, new_bill_action, finance_filed, news_match
  keywords TEXT[] NOT NULL DEFAULT '{}',
  channels TEXT[] NOT NULL DEFAULT ARRAY['in_app']::text[], -- in_app | email | webhook
  webhook_endpoint_id UUID REFERENCES public.webhook_endpoints(id) ON DELETE SET NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  trigger_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own alert rules" ON public.alert_rules
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX idx_alert_rules_user ON public.alert_rules(user_id) WHERE enabled = true;
CREATE TRIGGER trg_alert_rules_updated BEFORE UPDATE ON public.alert_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Alert dispatch log
CREATE TABLE public.alert_dispatch_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_rule_id UUID REFERENCES public.alert_rules(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  channel TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent', -- sent | failed | skipped
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.alert_dispatch_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own dispatch log" ON public.alert_dispatch_log
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Service role writes dispatch log" ON public.alert_dispatch_log
  FOR INSERT TO public WITH CHECK (auth.role() = 'service_role');
CREATE INDEX idx_alert_dispatch_user ON public.alert_dispatch_log(user_id, created_at DESC);

-- =====================================================================
-- STORAGE BUCKET FOR ATTACHMENTS
-- =====================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('oro-attachments', 'oro-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users read own attachments" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'oro-attachments' AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "Users upload own attachments" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'oro-attachments' AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "Users update own attachments" ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'oro-attachments' AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "Users delete own attachments" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'oro-attachments' AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- =====================================================================
-- REALTIME
-- =====================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.war_room_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.oppo_tracker_items;