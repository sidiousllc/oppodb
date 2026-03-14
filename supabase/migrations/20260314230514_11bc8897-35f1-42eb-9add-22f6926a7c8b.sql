
CREATE TABLE public.polling_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  source_url text,
  poll_type text NOT NULL DEFAULT 'approval',
  question text,
  date_conducted date NOT NULL,
  end_date date,
  candidate_or_topic text NOT NULL,
  approve_pct numeric,
  disapprove_pct numeric,
  favor_pct numeric,
  oppose_pct numeric,
  margin numeric,
  sample_size integer,
  sample_type text,
  margin_of_error numeric,
  partisan_lean text,
  methodology text,
  raw_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Public read access
ALTER TABLE public.polling_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read polling_data"
  ON public.polling_data FOR SELECT TO public
  USING (true);

CREATE POLICY "Admins can insert polling_data"
  ON public.polling_data FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update polling_data"
  ON public.polling_data FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete polling_data"
  ON public.polling_data FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Index for common queries
CREATE INDEX idx_polling_data_source ON public.polling_data(source);
CREATE INDEX idx_polling_data_date ON public.polling_data(date_conducted DESC);
CREATE INDEX idx_polling_data_type ON public.polling_data(poll_type);
