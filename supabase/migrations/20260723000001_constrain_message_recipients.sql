-- QA finding (audit patient) : la policy users_send_messages ne contraint que
-- sender_id = auth.uid(), jamais receiver_id -- un appel direct au SDK
-- Supabase pouvait donc envoyer un message à N'IMPORTE QUEL utilisateur de la
-- plateforme, sans relation légitime (rendez-vous, permission, admin). Seule
-- l'UI limitait le choix du destinataire à "mes praticiens".
--
-- Fix : n'autoriser l'envoi qu'entre un patient et un praticien ayant une
-- relation établie (patient_data_permissions, créée automatiquement à la
-- confirmation d'un rendez-vous), ou vers/depuis un compte admin (support).

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
  );
$$;

DROP POLICY IF EXISTS "users_send_messages" ON public.messages;
CREATE POLICY "users_send_messages" ON public.messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND public.can_message(sender_id, receiver_id)
  );
