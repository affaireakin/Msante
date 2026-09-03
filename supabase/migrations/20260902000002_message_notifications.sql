-- Push notification on new message — section 3 of the 2026-09-02 spec.
-- No existing trigger covered this: 9+ separate screens (patient/
-- practitioner/organization/admin, mobile and web) each insert into
-- `messages` directly, so a client-side fix would mean touching every one
-- of them individually and staying in sync forever. A single DB trigger
-- covers all senders at once, the same way handle_new_user() already does
-- for signups — uses net.http_post exactly like the existing pg_cron jobs
-- in 20260503000001_push_notifications.sql, just fired by a row event
-- instead of a schedule.
--
-- Handles: push notification (with a deep link straight to the
-- conversation) + a row in `notifications` (existing read/unread history,
-- badge counts already read that table elsewhere in the app).

CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sender_name TEXT;
  v_sender_prefix TEXT;
  v_receiver_role TEXT;
  v_receiver_push_token TEXT;
  v_route TEXT;
  v_preview TEXT;
  v_title TEXT;
BEGIN
  SELECT u.full_name, p.prefix
    INTO v_sender_name, v_sender_prefix
    FROM public.users u
    LEFT JOIN public.professional_prefixes p ON p.id = u.prefix_id
    WHERE u.id = NEW.sender_id;

  SELECT role, push_token INTO v_receiver_role, v_receiver_push_token
    FROM public.users WHERE id = NEW.receiver_id;

  v_title := CASE
    WHEN v_sender_prefix IS NOT NULL THEN v_sender_prefix || ' ' || COALESCE(v_sender_name, '')
    ELSE COALESCE(v_sender_name, 'Nouveau message')
  END;

  v_preview := COALESCE(NEW.body, CASE WHEN NEW.attachment_url IS NOT NULL THEN '📎 Pièce jointe' ELSE '' END);
  IF length(v_preview) > 120 THEN v_preview := left(v_preview, 117) || '...'; END IF;

  v_route := CASE v_receiver_role
    WHEN 'patient' THEN '/(patient)/messages/' || NEW.sender_id
    WHEN 'practitioner' THEN '/(practitioner)/messages/' || NEW.sender_id
    WHEN 'organization_admin' THEN '/(organization)/messages/' || NEW.sender_id
    WHEN 'organization_member' THEN '/(organization)/messages/' || NEW.sender_id
    WHEN 'admin' THEN '/(admin)/messages/' || NEW.sender_id
    ELSE NULL
  END;

  INSERT INTO public.notifications (user_id, type, title, body, data, channel, status)
  VALUES (NEW.receiver_id, 'new_message', v_title, v_preview,
          jsonb_build_object('route', v_route, 'sender_id', NEW.sender_id), 'push', 'pending');

  IF v_receiver_push_token IS NOT NULL THEN
    PERFORM net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object(
        'to', v_receiver_push_token,
        'title', v_title,
        'body', v_preview,
        'data', jsonb_build_object('route', v_route),
        'sound', 'default',
        'priority', 'high',
        'channelId', 'default'
      )
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block sending a message because the notification side failed.
  RAISE WARNING 'notify_new_message failed for message %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_message_created ON public.messages;
CREATE TRIGGER on_message_created
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_message();
