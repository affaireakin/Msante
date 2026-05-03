-- 1. Add push_token to users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS push_token TEXT,
  ADD COLUMN IF NOT EXISTS push_token_updated_at TIMESTAMPTZ;

-- 2. Create notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  channel TEXT NOT NULL CHECK (channel IN ('push', 'email', 'sms', 'whatsapp')),
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'read')),
  sent_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_status ON notifications(user_id, status);
CREATE INDEX idx_notifications_type_created ON notifications(type, created_at);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Patient/practitioner can only read their own notifications
CREATE POLICY "users_own_notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

-- Service role (Edge Functions) can do everything
CREATE POLICY "service_role_manage_notifications" ON notifications
  FOR ALL USING (auth.role() = 'service_role');

-- 3. pg_cron: call send-appointment-reminders every hour
SELECT cron.schedule(
  'msante-appointment-reminders',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/send-appointment-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  )
  $$
);
