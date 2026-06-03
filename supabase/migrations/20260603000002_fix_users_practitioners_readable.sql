-- Allow authenticated users to read user profile data for approved practitioners
-- Needed so patients can see practitioner names in search and appointment views
-- No recursion: inner SELECT on practitioners uses is_verified column directly
CREATE POLICY "users_practitioners_public_readable"
ON public.users FOR SELECT
USING (
  auth.role() = 'authenticated'
  AND id IN (
    SELECT user_id FROM public.practitioners WHERE is_verified = TRUE
  )
);
