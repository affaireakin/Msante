-- Seeds the "Bienvenue" workflow active by default, so new patients get a
-- WhatsApp welcome message out of the box (section 3, cahier des charges
-- 2026-09-02) without requiring an admin to first find and activate it from
-- /admin/workflows — same row shape useToggleWorkflow() creates from there,
-- so the admin can still toggle/edit it normally afterwards.
INSERT INTO public.workflows (name, description, trigger_type, trigger_config, nodes, edges, is_active)
SELECT
  'Bienvenue',
  'Envoyé une fois, juste après confirmation de l''email d''un nouveau patient.',
  'postgres_changes',
  jsonb_build_object(
    'template_key', 'account.welcome',
    'channels', jsonb_build_array('whatsapp', 'email'),
    'recipients', 'Patient'
  ),
  '[]'::jsonb,
  '[]'::jsonb,
  TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM public.workflows WHERE trigger_config->>'template_key' = 'account.welcome'
);
