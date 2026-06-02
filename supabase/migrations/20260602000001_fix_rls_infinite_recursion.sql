-- Fix infinite recursion in RLS policies.
-- Cycle: users → appointments (via users_readable_by_appointment_*)
--        → practitioners (via practitioners_own_appointments)
--        → appointments (via practitioners_readable_by_appointment_patients)
--        → LOOP

-- Drop the two users policies that query appointments
-- (redundant: users_authenticated_read already grants read to any authenticated user)
DROP POLICY IF EXISTS "users_readable_by_appointment_patients"      ON public.users;
DROP POLICY IF EXISTS "users_readable_by_appointment_practitioners" ON public.users;

-- Drop the practitioners policy that queries appointments (completes the cycle)
DROP POLICY IF EXISTS "practitioners_readable_by_appointment_patients" ON public.practitioners;
