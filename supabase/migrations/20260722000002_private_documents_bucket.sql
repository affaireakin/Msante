-- QA finding (audit sécurité, "accès direct par URL") : le bucket
-- `documents` (diplômes, CNI, licences des praticiens/organisations) est
-- public, avec une policy de lecture ouverte à QUICONQUE possède l'URL, sans
-- authentification ni expiration. Cette URL est en plus littéralement
-- rendue en dur dans le DOM (`<a href={doc.file_url}>`) sur au moins 3 pages
-- (admin/users, practitioner/profile, admin/organizations) -- n'importe qui
-- pouvant voir cette page HTML (ou une capture réseau) obtient un lien
-- permanent vers une pièce d'identité. Fix : bucket privé + policies de
-- lecture scoping (propriétaire ou permission admin granulaire) + signed
-- URLs générées à la demande côté client (voir apps/web/lib/signedDocumentUrl.ts).
--
-- Les lignes existantes stockent l'URL publique complète dans file_url; le
-- helper client extrait le path après "/documents/" pour rester compatible
-- sans migration de données. Les nouveaux uploads stockent directement le
-- path (voir apps/web/app/**/page.tsx modifiés dans le même commit).

UPDATE storage.buckets SET public = FALSE WHERE id = 'documents';

DROP POLICY IF EXISTS "documents_public_read" ON storage.objects;

CREATE POLICY "documents_read_own"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "documents_read_admin"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents'
  AND (public.has_admin_permission('practitioners.validate') OR public.has_admin_permission('organizations.validate'))
);

-- verification_documents had the same "any admin" gap as the tables fixed in
-- 20260721000001 -- closing it here alongside its storage bucket for the
-- same finding.
DROP POLICY IF EXISTS "docs_admin_all" ON public.verification_documents;
CREATE POLICY "docs_admin_all" ON public.verification_documents
  FOR ALL USING (
    public.has_admin_permission('practitioners.validate')
  );
