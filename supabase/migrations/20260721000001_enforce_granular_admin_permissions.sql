-- QA finding (audit sécurité) : le système de rôles granulaires (sections
-- 9/12) ne gate que la NAVIGATION côté client (admin/layout.tsx) — les
-- policies RLS sous-jacentes vérifient toutes juste "role = 'admin'", sans
-- regarder la permission réellement accordée. Un compte avec un rôle étroit
-- (ex. "Marketing", limité à content.manage) peut donc, via un appel direct
-- à l'API Supabase (contournant l'UI), lire/écrire tickets, litiges, CGU/FAQ,
-- paramètres du site — exactement la question "un collaborateur peut-il
-- accéder aux droits d'un administrateur ?" posée dans le cahier de tests.
--
-- Fix : une fonction utilitaire centralisant la vérification (super admin
-- toujours autorisé ; sinon vérifie la permission via user_admin_roles),
-- appliquée aux tables créées pendant cette session pour le système de
-- rôles + à `disputes`/`dispute_events` (antérieures, même lacune).
-- NOTE: mirrors admin/layout.tsx's legacy canAccess()/ROLE_ACCESS exactly —
-- sub_role NULL *or* 'admin' both meant unrestricted access in the old
-- system, and moderator/accountant/readonly had a fixed route list. Existing
-- accounts that were never migrated to the new granular admin_roles system
-- must keep exactly the access they already have; only a *new*, narrowly-
-- scoped granular role should ever be more restrictive than before.
CREATE OR REPLACE FUNCTION public.has_admin_permission(permission_key TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'admin' AND (u.sub_role IS NULL OR u.sub_role = 'admin')
  )
  OR EXISTS (
    SELECT 1 FROM public.user_admin_roles uar
    JOIN public.admin_role_permissions arp ON arp.role_id = uar.role_id
    JOIN public.admin_permissions ap ON ap.id = arp.permission_id
    WHERE uar.user_id = auth.uid() AND ap.key = permission_key
  )
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'admin' AND u.sub_role IN ('moderator', 'accountant', 'readonly')
      AND permission_key = ANY(
        CASE u.sub_role
          WHEN 'moderator'  THEN ARRAY['tickets.manage','disputes.manage','appeals.manage','practitioners.validate','organizations.validate','users.manage','analytics.view']
          WHEN 'accountant' THEN ARRAY['payments.view','analytics.view','tickets.manage']
          WHEN 'readonly'   THEN ARRAY['analytics.view']
          ELSE ARRAY[]::text[]
        END
      )
  );
$$;

-- ── tickets / ticket_comments / ticket_attachments ───────────────────────
DROP POLICY IF EXISTS "admins_all_tickets" ON public.tickets;
CREATE POLICY "admins_all_tickets" ON public.tickets FOR ALL USING (
  public.has_admin_permission('tickets.manage') OR public.has_admin_permission('technical.manage')
);

DROP POLICY IF EXISTS "admins_all_ticket_comments" ON public.ticket_comments;
CREATE POLICY "admins_all_ticket_comments" ON public.ticket_comments FOR ALL USING (
  public.has_admin_permission('tickets.manage') OR public.has_admin_permission('technical.manage')
);

DROP POLICY IF EXISTS "admins_all_ticket_attachments" ON public.ticket_attachments;
CREATE POLICY "admins_all_ticket_attachments" ON public.ticket_attachments FOR ALL USING (
  public.has_admin_permission('tickets.manage') OR public.has_admin_permission('technical.manage')
);
-- ticket_history stays SELECT-only for any admin (audit trail — no write policy exists for it anyway).

-- ── content_pages / faq_items / site_settings ────────────────────────────
DROP POLICY IF EXISTS "content_pages_admin_write" ON public.content_pages;
CREATE POLICY "content_pages_admin_write" ON public.content_pages FOR ALL USING (
  public.has_admin_permission('content.manage')
);

DROP POLICY IF EXISTS "faq_admin_all" ON public.faq_items;
CREATE POLICY "faq_admin_all" ON public.faq_items FOR ALL USING (
  public.has_admin_permission('content.manage')
);

DROP POLICY IF EXISTS "site_settings_admin_write" ON public.site_settings;
CREATE POLICY "site_settings_admin_write" ON public.site_settings FOR UPDATE USING (
  public.has_admin_permission('content.manage')
);

-- ── disputes / dispute_events (pre-existing, same gap) ───────────────────
DROP POLICY IF EXISTS "admins_full_disputes" ON public.disputes;
CREATE POLICY "admins_full_disputes" ON public.disputes FOR ALL USING (
  public.has_admin_permission('disputes.manage')
);

DROP POLICY IF EXISTS "admins_full_dispute_events" ON public.dispute_events;
CREATE POLICY "admins_full_dispute_events" ON public.dispute_events FOR ALL USING (
  public.has_admin_permission('disputes.manage')
);

-- ── practitioner_appeals (pre-existing, same gap) ────────────────────────
DROP POLICY IF EXISTS "admins_manage_appeals" ON public.practitioner_appeals;
CREATE POLICY "admins_manage_appeals" ON public.practitioner_appeals FOR ALL USING (
  public.has_admin_permission('practitioners.validate')
);

-- practitioner_documents holds CLINICAL records (prescriptions/reports/
-- appreciations shared during a consultation) -- unrelated to the
-- verification_documents table (diploma/ID/license) that practitioners.validate
-- actually governs. Gating this on practitioners.validate would grant clinical
-- record access to the practitioner-validation admin role, which has no
-- legitimate need for it. No admin UI currently reads this table (dead
-- broad-access policy), so disputes.manage -- the one plausible legitimate
-- reason an admin would ever need to see a patient's prescription/report -- is
-- the correct, narrower mapping.
DROP POLICY IF EXISTS "admin_all_documents" ON public.practitioner_documents;
CREATE POLICY "admin_all_documents" ON public.practitioner_documents FOR ALL USING (
  public.has_admin_permission('disputes.manage')
);
