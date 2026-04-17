CREATE TABLE IF NOT EXISTS public.app_serial_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  serial text NOT NULL UNIQUE,
  device_id text,
  device_bound_at timestamptz,
  last_validated_at timestamptz,
  validation_count integer NOT NULL DEFAULT 0,
  revoked_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_serial_keys_user_id_idx ON public.app_serial_keys(user_id);
CREATE INDEX IF NOT EXISTS app_serial_keys_serial_idx ON public.app_serial_keys(serial);

ALTER TABLE public.app_serial_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own serial keys" ON public.app_serial_keys FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own serial keys" ON public.app_serial_keys FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own serial keys" ON public.app_serial_keys FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own serial keys" ON public.app_serial_keys FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins view all serial keys" ON public.app_serial_keys FOR SELECT USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage all serial keys" ON public.app_serial_keys FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_app_serial_keys_updated_at
  BEFORE UPDATE ON public.app_serial_keys
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.validate_app_serial(p_serial text, p_device_id text)
RETURNS TABLE(valid boolean, user_id uuid, key_id uuid, reason text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _row public.app_serial_keys%ROWTYPE;
BEGIN
  SELECT * INTO _row FROM public.app_serial_keys WHERE serial = p_serial LIMIT 1;
  IF _row.id IS NULL THEN RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, 'not_found'::text; RETURN; END IF;
  IF _row.revoked_at IS NOT NULL THEN RETURN QUERY SELECT false, _row.user_id, _row.id, 'revoked'::text; RETURN; END IF;
  IF _row.device_id IS NULL THEN
    UPDATE public.app_serial_keys SET device_id = p_device_id, device_bound_at = now(), last_validated_at = now(), validation_count = validation_count + 1 WHERE id = _row.id;
  ELSIF _row.device_id <> p_device_id THEN
    RETURN QUERY SELECT false, _row.user_id, _row.id, 'device_mismatch'::text; RETURN;
  ELSE
    UPDATE public.app_serial_keys SET last_validated_at = now(), validation_count = validation_count + 1 WHERE id = _row.id;
  END IF;
  RETURN QUERY SELECT true, _row.user_id, _row.id, 'ok'::text;
END; $$;

CREATE OR REPLACE FUNCTION public.unbind_serial_device(p_key_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.app_serial_keys SET device_id = NULL, device_bound_at = NULL WHERE id = p_key_id AND user_id = auth.uid();
$$;