
-- Create app_role enum and user_roles table
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create has_role function (SECURITY DEFINER to avoid recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS on user_roles: users can read their own roles
CREATE POLICY "Users can read own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Drop overly permissive write policies on candidate_profiles
DROP POLICY IF EXISTS "Authenticated users can insert candidate_profiles" ON public.candidate_profiles;
DROP POLICY IF EXISTS "Authenticated users can update candidate_profiles" ON public.candidate_profiles;
DROP POLICY IF EXISTS "Authenticated users can delete candidate_profiles" ON public.candidate_profiles;

-- Create admin-only write policies
CREATE POLICY "Admins can insert candidate_profiles"
  ON public.candidate_profiles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update candidate_profiles"
  ON public.candidate_profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete candidate_profiles"
  ON public.candidate_profiles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
