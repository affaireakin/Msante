CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'patient'
    CHECK (role IN ('patient', 'practitioner', 'admin')),
  full_name TEXT NOT NULL,
  phone TEXT,
  country TEXT DEFAULT 'SN',
  language TEXT DEFAULT 'fr',
  date_of_birth DATE,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_role ON public.users(role);
