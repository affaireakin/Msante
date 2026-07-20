-- QA finding (audit organisation) : /organization/messages annonce "Échangez
-- avec l'équipe M-Santé et vos collaborateurs", mais internal_messages_send
-- ne permettait l'envoi qu'aux rôles admin/organization_admin -- un
-- organization_member ou secretary ne pouvait jamais répondre. Corrigé en
-- symétrie avec la policy de lecture (déjà ouverte aux 4 rôles).

DROP POLICY IF EXISTS "internal_messages_send" ON public.internal_messages;
CREATE POLICY "internal_messages_send" ON public.internal_messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'organization_admin', 'organization_member', 'secretary'))
  AND EXISTS (SELECT 1 FROM public.users WHERE id = receiver_id AND role IN ('admin', 'organization_admin', 'organization_member', 'secretary'))
);
