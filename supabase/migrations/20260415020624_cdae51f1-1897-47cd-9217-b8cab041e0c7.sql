
CREATE TABLE public.international_polling (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  country_code text NOT NULL,
  poll_topic text NOT NULL,
  question text,
  favor_pct numeric,
  oppose_pct numeric,
  approve_pct numeric,
  disapprove_pct numeric,
  margin numeric,
  sample_size integer,
  methodology text,
  margin_of_error numeric,
  source text NOT NULL DEFAULT '',
  source_url text,
  date_conducted date,
  end_date date,
  poll_type text NOT NULL DEFAULT 'issue',
  key_finding text,
  raw_data jsonb DEFAULT '{}'::jsonb,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.international_polling ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read international_polling"
  ON public.international_polling
  FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage international_polling"
  ON public.international_polling
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX idx_international_polling_country ON public.international_polling(country_code);
CREATE INDEX idx_international_polling_topic ON public.international_polling(poll_topic);
