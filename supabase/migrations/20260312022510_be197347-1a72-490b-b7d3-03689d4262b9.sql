-- Add permissive SELECT policy for authenticated users
CREATE POLICY "Authenticated users can select candidate_profiles"
  ON public.candidate_profiles FOR SELECT
  TO authenticated
  USING (true);

-- Add INSERT policy for authenticated users
CREATE POLICY "Authenticated users can insert candidate_profiles"
  ON public.candidate_profiles FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Add UPDATE policy for authenticated users
CREATE POLICY "Authenticated users can update candidate_profiles"
  ON public.candidate_profiles FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Add DELETE policy for authenticated users
CREATE POLICY "Authenticated users can delete candidate_profiles"
  ON public.candidate_profiles FOR DELETE
  TO authenticated
  USING (true);