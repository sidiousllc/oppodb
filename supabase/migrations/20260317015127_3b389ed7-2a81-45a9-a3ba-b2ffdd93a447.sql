
-- Create tracked bills table for users to save/monitor legislation
CREATE TABLE public.tracked_bills (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  bill_id integer NOT NULL,
  bill_number text NOT NULL,
  title text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT '',
  status_desc text,
  last_action text,
  last_action_date text,
  legiscan_url text,
  notes text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, bill_id)
);

-- Enable RLS
ALTER TABLE public.tracked_bills ENABLE ROW LEVEL SECURITY;

-- Users can only see their own tracked bills
CREATE POLICY "Users can read own tracked bills"
ON public.tracked_bills FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own tracked bills"
ON public.tracked_bills FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own tracked bills"
ON public.tracked_bills FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can delete own tracked bills"
ON public.tracked_bills FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Enable realtime for tracked bills
ALTER PUBLICATION supabase_realtime ADD TABLE public.tracked_bills;
