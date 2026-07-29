-- can_message() only ever allowed messaging if one party is role='admin',
-- or between a patient and a practitioner with an established relationship.
-- web's own InternalMessaging directory (admin/messages, organization/messages)
-- explicitly lets an organization_admin message their own organization_member/
-- secretary colleagues — neither of whom is 'admin' — so that insert was
-- being silently rejected by this same-org staff-to-staff case. Extends the
-- allowed relationships to also cover same-organization staff messaging.
CREATE OR REPLACE FUNCTION public.can_message(p_sender UUID, p_receiver UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_sender IS DISTINCT FROM p_receiver
  AND (
    EXISTS (SELECT 1 FROM public.users WHERE id IN (p_sender, p_receiver) AND role = 'admin')
    OR EXISTS (
      SELECT 1 FROM public.patient_data_permissions pdp
      JOIN public.practitioners pr ON pr.id = pdp.practitioner_id
      WHERE (pdp.patient_id = p_sender AND pr.user_id = p_receiver)
         OR (pdp.patient_id = p_receiver AND pr.user_id = p_sender)
    )
    OR EXISTS (
      SELECT 1 FROM public.users s, public.users r
      WHERE s.id = p_sender AND r.id = p_receiver
        AND s.organization_id IS NOT NULL
        AND s.organization_id = r.organization_id
        AND s.role IN ('organization_admin', 'organization_member', 'secretary')
        AND r.role IN ('organization_admin', 'organization_member', 'secretary')
    )
  );
$$;
