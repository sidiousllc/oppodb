-- Reports table
CREATE TABLE public.reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Untitled Report',
  description text NOT NULL DEFAULT '',
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_reports_owner ON public.reports(owner_id);
CREATE INDEX idx_reports_updated ON public.reports(updated_at DESC);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Report shares table
CREATE TABLE public.report_shares (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  shared_with_user_id uuid NOT NULL,
  can_edit boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (report_id, shared_with_user_id)
);

CREATE INDEX idx_report_shares_user ON public.report_shares(shared_with_user_id);
CREATE INDEX idx_report_shares_report ON public.report_shares(report_id);

ALTER TABLE public.report_shares ENABLE ROW LEVEL SECURITY;

-- Helper function to avoid recursion when checking shares from reports policies
CREATE OR REPLACE FUNCTION public.user_has_report_access(_report_id uuid, _user_id uuid, _need_edit boolean DEFAULT false)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.report_shares
    WHERE report_id = _report_id
      AND shared_with_user_id = _user_id
      AND (NOT _need_edit OR can_edit = true)
  );
$$;

-- Reports policies
CREATE POLICY "Owners can read own reports"
  ON public.reports FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Shared users can read reports"
  ON public.reports FOR SELECT TO authenticated
  USING (public.user_has_report_access(id, auth.uid(), false));

CREATE POLICY "Public reports readable by authenticated"
  ON public.reports FOR SELECT TO authenticated
  USING (is_public = true);

CREATE POLICY "Admins can read all reports"
  ON public.reports FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can create own reports"
  ON public.reports FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can update own reports"
  ON public.reports FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Editors can update shared reports"
  ON public.reports FOR UPDATE TO authenticated
  USING (public.user_has_report_access(id, auth.uid(), true))
  WITH CHECK (public.user_has_report_access(id, auth.uid(), true));

CREATE POLICY "Admins can update all reports"
  ON public.reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners can delete own reports"
  ON public.reports FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Admins can delete all reports"
  ON public.reports FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Report shares policies
CREATE POLICY "Owners manage shares"
  ON public.report_shares FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.reports r WHERE r.id = report_id AND r.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.reports r WHERE r.id = report_id AND r.owner_id = auth.uid()));

CREATE POLICY "Users can read own shares"
  ON public.report_shares FOR SELECT TO authenticated
  USING (shared_with_user_id = auth.uid());

CREATE POLICY "Admins manage all shares"
  ON public.report_shares FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_reports_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reports_updated_at
  BEFORE UPDATE ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_reports_updated_at();