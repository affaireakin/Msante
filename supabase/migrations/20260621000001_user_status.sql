-- Statut utilisateur : actif / suspendu
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended'));

-- Colonne sub_role pour stocker le rôle fin des collaborateurs admin
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS sub_role TEXT
    CHECK (sub_role IN ('admin', 'moderator', 'accountant', 'readonly'));

-- Mettre à jour le trigger pour propager sub_role depuis les métadonnées
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.users (id, role, sub_role, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'patient'),
    NEW.raw_user_meta_data->>'sub_role',
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;
