
-- Create user_mail table for AOL-style internal mail
CREATE TABLE public.user_mail (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL,
  recipient_id UUID NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  read_at TIMESTAMP WITH TIME ZONE,
  deleted_by_sender BOOLEAN NOT NULL DEFAULT false,
  deleted_by_recipient BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_mail ENABLE ROW LEVEL SECURITY;

-- Users can read mail they sent or received (unless deleted)
CREATE POLICY "Users can read own mail"
  ON public.user_mail FOR SELECT TO authenticated
  USING (
    (sender_id = auth.uid() AND deleted_by_sender = false) OR
    (recipient_id = auth.uid() AND deleted_by_recipient = false)
  );

-- Users can send mail
CREATE POLICY "Users can send mail"
  ON public.user_mail FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());

-- Users can update mail they received (mark as read) or soft-delete their own
CREATE POLICY "Users can update own mail"
  ON public.user_mail FOR UPDATE TO authenticated
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_mail;
