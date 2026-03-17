
-- Role groups table for organizing and managing permission groups
CREATE TABLE public.role_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT '#c0c0c0',
  roles text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Role group members (which users belong to which groups)
CREATE TABLE public.role_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.role_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

-- Enable RLS
ALTER TABLE public.role_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_group_members ENABLE ROW LEVEL SECURITY;

-- Anyone can read role groups (for display purposes)
CREATE POLICY "Anyone can read role_groups"
ON public.role_groups FOR SELECT TO public
USING (true);

-- Only admins can manage role groups
CREATE POLICY "Admins can insert role_groups"
ON public.role_groups FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update role_groups"
ON public.role_groups FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete role_groups"
ON public.role_groups FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Anyone can read group members
CREATE POLICY "Anyone can read role_group_members"
ON public.role_group_members FOR SELECT TO public
USING (true);

-- Only admins can manage group members
CREATE POLICY "Admins can insert role_group_members"
ON public.role_group_members FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete role_group_members"
ON public.role_group_members FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
