
-- Create section_permissions table for granular access control
CREATE TABLE public.section_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  section_id TEXT NOT NULL,
  subsection_id TEXT,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('user', 'group', 'role')),
  entity_id TEXT NOT NULL,
  allowed BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE (section_id, subsection_id, entity_type, entity_id)
);

-- Enable RLS
ALTER TABLE public.section_permissions ENABLE ROW LEVEL SECURITY;

-- Admins can manage section permissions
CREATE POLICY "Admins can manage section_permissions"
  ON public.section_permissions
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Authenticated users can read section permissions (needed to check their own access)
CREATE POLICY "Authenticated can read section_permissions"
  ON public.section_permissions
  FOR SELECT
  TO authenticated
  USING (true);

-- Security definer function to check section access for a user
CREATE OR REPLACE FUNCTION public.check_section_access(
  _user_id UUID,
  _section_id TEXT,
  _subsection_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _denied BOOLEAN := false;
  _user_roles TEXT[];
  _user_groups UUID[];
BEGIN
  -- Get user roles
  SELECT ARRAY_AGG(role::TEXT) INTO _user_roles
  FROM public.user_roles
  WHERE user_id = _user_id;

  -- Get user groups
  SELECT ARRAY_AGG(group_id) INTO _user_groups
  FROM public.role_group_members
  WHERE user_id = _user_id;

  -- Check if there's any explicit deny for this user, their roles, or their groups
  -- Priority: user-specific > group > role
  -- If any explicit deny exists and no explicit allow overrides it, deny

  -- Check user-level deny
  IF EXISTS (
    SELECT 1 FROM public.section_permissions
    WHERE section_id = _section_id
      AND (subsection_id = _subsection_id OR (_subsection_id IS NULL AND subsection_id IS NULL))
      AND entity_type = 'user'
      AND entity_id = _user_id::TEXT
      AND allowed = false
  ) THEN
    RETURN false;
  END IF;

  -- Check user-level allow
  IF EXISTS (
    SELECT 1 FROM public.section_permissions
    WHERE section_id = _section_id
      AND (subsection_id = _subsection_id OR (_subsection_id IS NULL AND subsection_id IS NULL))
      AND entity_type = 'user'
      AND entity_id = _user_id::TEXT
      AND allowed = true
  ) THEN
    RETURN true;
  END IF;

  -- Check group-level deny
  IF _user_groups IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.section_permissions
    WHERE section_id = _section_id
      AND (subsection_id = _subsection_id OR (_subsection_id IS NULL AND subsection_id IS NULL))
      AND entity_type = 'group'
      AND entity_id = ANY(SELECT unnest(_user_groups)::TEXT)
      AND allowed = false
  ) THEN
    RETURN false;
  END IF;

  -- Check group-level allow
  IF _user_groups IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.section_permissions
    WHERE section_id = _section_id
      AND (subsection_id = _subsection_id OR (_subsection_id IS NULL AND subsection_id IS NULL))
      AND entity_type = 'group'
      AND entity_id = ANY(SELECT unnest(_user_groups)::TEXT)
      AND allowed = true
  ) THEN
    RETURN true;
  END IF;

  -- Check role-level deny
  IF _user_roles IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.section_permissions
    WHERE section_id = _section_id
      AND (subsection_id = _subsection_id OR (_subsection_id IS NULL AND subsection_id IS NULL))
      AND entity_type = 'role'
      AND entity_id = ANY(_user_roles)
      AND allowed = false
  ) THEN
    RETURN false;
  END IF;

  -- Check role-level allow
  IF _user_roles IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.section_permissions
    WHERE section_id = _section_id
      AND (subsection_id = _subsection_id OR (_subsection_id IS NULL AND subsection_id IS NULL))
      AND entity_type = 'role'
      AND entity_id = ANY(_user_roles)
      AND allowed = true
  ) THEN
    RETURN true;
  END IF;

  -- Default: allow (no restrictions configured = access granted)
  -- But if ANY permission rule exists for this section, default to deny for unlisted entities
  IF EXISTS (
    SELECT 1 FROM public.section_permissions
    WHERE section_id = _section_id
      AND (subsection_id = _subsection_id OR (_subsection_id IS NULL AND subsection_id IS NULL))
      AND allowed = true
  ) THEN
    -- There are explicit allows for others but not for this user → deny
    RETURN false;
  END IF;

  -- No rules at all → allow by default
  RETURN true;
END;
$$;
