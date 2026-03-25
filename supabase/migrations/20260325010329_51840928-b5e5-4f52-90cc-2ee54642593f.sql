
-- Invitations table (admin sends invite links)
CREATE TABLE public.user_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  token text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by uuid NOT NULL,
  role text NOT NULL DEFAULT 'user',
  used_at timestamp with time zone,
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(token)
);

-- Access requests table (public users request access)
CREATE TABLE public.access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  display_name text,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(email, status)
);

-- RLS for invitations: only admins can manage
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage invitations"
  ON public.user_invitations FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Allow anon to read invitations by token (for signup validation)
CREATE POLICY "Anyone can validate invite token"
  ON public.user_invitations FOR SELECT
  TO anon
  USING (true);

-- RLS for access requests
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

-- Anyone can insert a request (anon)
CREATE POLICY "Anyone can submit access request"
  ON public.access_requests FOR INSERT
  TO anon
  WITH CHECK (true);

-- Also allow authenticated to insert
CREATE POLICY "Authenticated can submit access request"
  ON public.access_requests FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Admins can read and manage requests
CREATE POLICY "Admins can manage access requests"
  ON public.access_requests FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));
