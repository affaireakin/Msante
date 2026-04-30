CREATE TABLE public.practitioners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  speciality TEXT NOT NULL,
  bio TEXT,
  languages TEXT[] DEFAULT ARRAY['fr'],
  session_price NUMERIC(10,2),
  session_currency TEXT DEFAULT 'XOF',
  session_duration_min INT DEFAULT 60,
  is_verified BOOLEAN DEFAULT FALSE,
  verification_status TEXT DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'under_review', 'approved', 'rejected')),
  rating NUMERIC(3,2),
  total_reviews INT DEFAULT 0,
  timezone TEXT DEFAULT 'Africa/Dakar',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.verification_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id UUID NOT NULL REFERENCES public.practitioners(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL
    CHECK (document_type IN ('diploma', 'license', 'id_card', 'other')),
  file_url TEXT NOT NULL,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES public.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_practitioners_user ON public.practitioners(user_id);
CREATE INDEX idx_practitioners_status ON public.practitioners(verification_status);
CREATE INDEX idx_verification_docs_practitioner ON public.verification_documents(practitioner_id);
