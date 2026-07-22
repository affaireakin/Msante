-- Section 22 ("Respect des processus") : le statut d'un ticket pouvait être
-- changé directement vers n'importe quelle colonne (glisser-déposer ou menu
-- déroulant), sautant les étapes obligatoires du parcours
-- à_faire → en_cours → en_test → corrigé → validé → déployé. Cette contrainte
-- s'applique au niveau base pour ne jamais pouvoir être contournée, quel que
-- soit le chemin d'appel (UI, API directe).
--
-- Règle : le recul (rouvrir un ticket, revenir en arrière après un test
-- raté) reste toujours autorisé sans restriction — seule une AVANCÉE de plus
-- d'une étape à la fois est bloquée.

CREATE OR REPLACE FUNCTION public.ticket_status_rank(s public.ticket_status)
RETURNS INT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE s
    WHEN 'a_faire' THEN 0
    WHEN 'en_cours' THEN 1
    WHEN 'en_test' THEN 2
    WHEN 'corrige' THEN 3
    WHEN 'valide' THEN 4
    WHEN 'deploye' THEN 5
  END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_ticket_status_order()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND public.ticket_status_rank(NEW.status) > public.ticket_status_rank(OLD.status) + 1
  THEN
    RAISE EXCEPTION 'Étape ignorée : impossible de passer directement de "%" à "%" — le ticket doit suivre chaque étape du parcours.', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_ticket_status_order ON public.tickets;
CREATE TRIGGER trg_enforce_ticket_status_order
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.enforce_ticket_status_order();
