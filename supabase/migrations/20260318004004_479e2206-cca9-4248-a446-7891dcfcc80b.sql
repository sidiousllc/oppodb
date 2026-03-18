
CREATE TABLE public.winred_donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_first_name text,
  donor_last_name text,
  donor_email text,
  donor_phone text,
  donor_address text,
  donor_city text,
  donor_state text,
  donor_zip text,
  donor_employer text,
  donor_occupation text,
  amount numeric NOT NULL DEFAULT 0,
  recurring boolean DEFAULT false,
  page_name text,
  page_slug text,
  candidate_name text,
  committee_name text,
  transaction_id text UNIQUE,
  transaction_date timestamp with time zone,
  refunded boolean DEFAULT false,
  raw_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_winred_donor_name ON public.winred_donations (donor_last_name, donor_first_name);
CREATE INDEX idx_winred_donor_state ON public.winred_donations (donor_state);
CREATE INDEX idx_winred_donor_email ON public.winred_donations (donor_email);
CREATE INDEX idx_winred_transaction_date ON public.winred_donations (transaction_date DESC);

ALTER TABLE public.winred_donations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read winred_donations" ON public.winred_donations
  FOR SELECT TO public USING (true);

CREATE POLICY "Service role can manage winred_donations" ON public.winred_donations
  FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
