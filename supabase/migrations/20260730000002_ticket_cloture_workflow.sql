-- Clôturer un ticket (ou rouvrir un ticket clôturé) est une sortie/entrée
-- volontaire du pipeline, pas une étape de plus dans l'ordre à respecter —
-- contrairement aux 6 statuts du pipeline de dev, on peut y accéder depuis
-- n'importe quel statut, et en repartir vers n'importe quel statut. Le
-- verrou "pas plus d'une étape d'avance à la fois" ne s'applique donc
-- toujours qu'entre les 6 statuts d'origine.

CREATE OR REPLACE FUNCTION public.ticket_status_rank(s public.ticket_status)
RETURNS INT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE s
    WHEN 'a_faire' THEN 0
    WHEN 'en_cours' THEN 1
    WHEN 'en_test' THEN 2
    WHEN 'corrige' THEN 3
    WHEN 'valide' THEN 4
    WHEN 'deploye' THEN 5
    WHEN 'cloture' THEN 6
  END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_ticket_status_order()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status != 'cloture' AND OLD.status != 'cloture'
     AND public.ticket_status_rank(NEW.status) > public.ticket_status_rank(OLD.status) + 1
  THEN
    RAISE EXCEPTION 'Étape ignorée : impossible de passer directement de "%" à "%" — le ticket doit suivre chaque étape du parcours.', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END;
$$;
