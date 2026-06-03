-- Add order_certificate and professional_insurance to verification_documents constraint
ALTER TABLE public.verification_documents
  DROP CONSTRAINT IF EXISTS verification_documents_document_type_check;

ALTER TABLE public.verification_documents
  ADD CONSTRAINT verification_documents_document_type_check
    CHECK (document_type IN ('diploma', 'license', 'id_card', 'order_certificate', 'professional_insurance', 'other'));
