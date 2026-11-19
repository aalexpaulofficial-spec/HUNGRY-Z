-- HUNGRY Z in-app notifications and standards-based Web Push.
-- Apply manually in Supabase SQL Editor only after reviewing the target project.
BEGIN;

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type text NOT NULL CHECK (notification_type IN (
    'order_accepted', 'order_preparing', 'order_ready', 'order_collected',
    'new_online_order', 'faculty_event_request', 'faculty_event_update',
    'faculty_event_published', 'canteen_registration'
  )),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  href text NOT NULL CHECK (href LIKE '/%'),
  dedupe_key text NOT NULL UNIQUE CHECK (char_length(dedupe_key) <= 240),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

CREATE INDEX IF NOT EXISTS notifications_recipient_created_idx
  ON public.notifications (recipient_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_unread_idx
  ON public.notifications (recipient_user_id, created_at DESC) WHERE read_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notifications FROM PUBLIC, anon;
GRANT SELECT ON public.notifications TO authenticated;
GRANT UPDATE (read_at) ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
DROP POLICY IF EXISTS "Users read their own notifications" ON public.notifications;
CREATE POLICY "Users read their own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (recipient_user_id = auth.uid());
DROP POLICY IF EXISTS "Users mark their own notifications read" ON public.notifications;
CREATE POLICY "Users mark their own notifications read" ON public.notifications
  FOR UPDATE TO authenticated
  USING (recipient_user_id = auth.uid())
  WITH CHECK (recipient_user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE CHECK (endpoint LIKE 'https://%'),
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text NOT NULL DEFAULT '' CHECK (char_length(user_agent) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON public.push_subscriptions(user_id);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_subscriptions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

CREATE TABLE IF NOT EXISTS public.push_notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES public.push_subscriptions(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'sent', 'failed')),
  attempts integer NOT NULL DEFAULT 1 CHECK (attempts > 0),
  last_status integer,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (notification_id, subscription_id)
);
ALTER TABLE public.push_notification_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_notification_deliveries FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.push_notification_deliveries TO service_role;

CREATE OR REPLACE FUNCTION public.hz_claim_push_delivery(p_notification_id uuid, p_subscription_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.push_notification_deliveries(notification_id, subscription_id, status, attempts, updated_at)
  VALUES (p_notification_id, p_subscription_id, 'processing', 1, now())
  ON CONFLICT (notification_id, subscription_id) DO UPDATE
    SET status = 'processing', attempts = public.push_notification_deliveries.attempts + 1, updated_at = now(), last_status = NULL
    WHERE public.push_notification_deliveries.status = 'failed'
       OR (public.push_notification_deliveries.status = 'processing' AND public.push_notification_deliveries.updated_at < now() - interval '2 minutes')
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.hz_claim_push_delivery(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hz_claim_push_delivery(uuid,uuid) TO service_role;

-- Insert durable notification records from the existing business tables. Unique
-- event keys make repeated status updates and webhook retries idempotent.
CREATE OR REPLACE FUNCTION public.hz_create_notification(
  p_user_id uuid, p_type text, p_title text, p_body text, p_href text, p_dedupe_key text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_id uuid;
BEGIN
  IF p_user_id IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.notifications(recipient_user_id, notification_type, title, body, href, dedupe_key)
  VALUES (p_user_id, p_type, left(p_title,120), left(p_body,500), p_href, left(p_dedupe_key,240))
  ON CONFLICT (dedupe_key) DO NOTHING
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.hz_create_notification(uuid,text,text,text,text,text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.hz_notify_order_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_canteen text;
  v_owner uuid;
  v_title text;
  v_body text;
  v_type text;
BEGIN
  SELECT name, owner_user_id INTO v_canteen, v_owner FROM public.canteens WHERE id = NEW.canteen_id;

  IF (TG_OP = 'INSERT' AND NEW.status = 'placed') OR
     (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'placed') THEN
    PERFORM public.hz_create_notification(
      NEW.user_id, 'order_accepted', 'Order accepted',
      format('Order %s is confirmed at %s.', NEW.order_number, coalesce(v_canteen, 'your canteen')),
      '/app?orderId=' || NEW.id, 'order:' || NEW.id || ':accepted'
    );
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('preparing','ready','collected') THEN
    v_type := CASE NEW.status WHEN 'preparing' THEN 'order_preparing' WHEN 'ready' THEN 'order_ready' ELSE 'order_collected' END;
    v_title := CASE NEW.status WHEN 'preparing' THEN 'Order is preparing' WHEN 'ready' THEN 'Ready for pickup' ELSE 'Order collected' END;
    v_body := CASE NEW.status
      WHEN 'preparing' THEN format('The canteen has started preparing order %s.', NEW.order_number)
      WHEN 'ready' THEN format('Order %s is ready for pickup at %s.', NEW.order_number, coalesce(v_canteen, 'your canteen'))
      ELSE format('Order %s has been marked collected.', NEW.order_number)
    END;
    PERFORM public.hz_create_notification(NEW.user_id, v_type, v_title, v_body,
      '/app?orderId=' || NEW.id, 'order:' || NEW.id || ':status:' || NEW.status);
  END IF;

  -- Printed-bill orders are complete only after customer receipt confirmation.
  IF TG_OP = 'UPDATE' AND OLD.food_received_confirmed_at IS NULL
      AND NEW.food_received_confirmed_at IS NOT NULL AND NEW.completion_workflow = 'printed'
      AND NEW.status <> 'cancelled' THEN
    PERFORM public.hz_create_notification(NEW.user_id, 'order_collected', 'Order collected',
      format('You confirmed receipt of order %s.', NEW.order_number), '/app?orderId=' || NEW.id,
      'order:' || NEW.id || ':printed-receipt-confirmed');
  END IF;

  -- A canteen receives this only after an online payment is confirmed.
  IF NEW.status = 'placed' AND NEW.payment_method = 'razorpay' AND NEW.payment_status = 'paid'
      AND ((TG_OP = 'INSERT') OR (OLD.status IS DISTINCT FROM NEW.status OR OLD.payment_status IS DISTINCT FROM NEW.payment_status)) THEN
    PERFORM public.hz_create_notification(v_owner, 'new_online_order', 'New online order',
      format('Order %s has been paid and is ready to review.', NEW.order_number),
      '/canteen?orderId=' || NEW.id, 'order:' || NEW.id || ':owner-online-order');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS hz_order_notification_changes ON public.orders;
CREATE TRIGGER hz_order_notification_changes
  AFTER INSERT OR UPDATE OF status, payment_status, food_received_confirmed_at ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.hz_notify_order_change();

CREATE OR REPLACE FUNCTION public.hz_notify_canteen_application()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_admin record;
BEGIN
  FOR v_admin IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
    PERFORM public.hz_create_notification(v_admin.user_id, 'canteen_registration', 'New canteen registration',
      format('%s submitted a canteen application for %s.', NEW.owner_name, NEW.canteen_name),
      '/admin', 'canteen-application:' || NEW.id || ':admin:' || v_admin.user_id);
  END LOOP;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS hz_canteen_application_notification ON public.canteen_applications;
CREATE TRIGGER hz_canteen_application_notification
  AFTER INSERT ON public.canteen_applications
  FOR EACH ROW EXECUTE FUNCTION public.hz_notify_canteen_application();

CREATE OR REPLACE FUNCTION public.hz_notify_faculty_event()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_owner uuid; v_profile record; v_type text; v_title text; v_body text; v_key text;
BEGIN
  SELECT owner_user_id INTO v_owner FROM public.canteens WHERE id = NEW.canteen_id;
  IF TG_OP = 'INSERT' AND NEW.status = 'requested' THEN
    PERFORM public.hz_create_notification(v_owner, 'faculty_event_request', 'New faculty event request',
      format('%s requested food for %s.', (SELECT full_name FROM public.profiles WHERE id = NEW.faculty_user_id), NEW.name),
      '/canteen?eventId=' || NEW.id, 'faculty-event:' || NEW.id || ':owner-request');
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status IN ('accepted','quotation_received','changes_requested','approved','rejected','published','closed') THEN
      v_type := CASE WHEN NEW.status = 'published' THEN 'faculty_event_published' ELSE 'faculty_event_update' END;
      v_title := CASE NEW.status
        WHEN 'accepted' THEN 'Event request accepted'
        WHEN 'quotation_received' THEN 'Event quotation ready'
        WHEN 'changes_requested' THEN 'Event quotation needs changes'
        WHEN 'approved' THEN 'Event quotation approved'
        WHEN 'rejected' THEN 'Event request declined'
        WHEN 'published' THEN 'Faculty event published'
        ELSE 'Faculty event updated'
      END;
      v_body := CASE NEW.status
        WHEN 'accepted' THEN format('The canteen accepted your request for %s.', NEW.name)
        WHEN 'quotation_received' THEN format('The canteen sent a quotation for %s.', NEW.name)
        WHEN 'changes_requested' THEN format('The canteen needs changes to the quotation for %s.', NEW.name)
        WHEN 'approved' THEN format('Your quotation for %s was approved.', NEW.name)
        WHEN 'rejected' THEN format('The canteen declined your request for %s.', NEW.name)
        WHEN 'published' THEN format('%s is now available to participants.', NEW.name)
        ELSE format('There is an update for %s.', NEW.name)
      END;
      v_key := 'faculty-event:' || NEW.id || ':faculty-status:' || NEW.status || ':' || NEW.updated_at;
      PERFORM public.hz_create_notification(NEW.faculty_user_id, v_type, v_title, v_body,
        '/app?eventId=' || NEW.id, v_key);
      IF NEW.status = 'published' THEN
        FOR v_profile IN SELECT id FROM public.profiles WHERE current_canteen_id = NEW.canteen_id AND role IN ('student','faculty','guest') LOOP
          PERFORM public.hz_create_notification(v_profile.id, 'faculty_event_published', 'New faculty event',
            format('%s is now available at your canteen.', NEW.name), '/app?eventId=' || NEW.id,
            'faculty-event:' || NEW.id || ':published:' || v_profile.id);
        END LOOP;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS hz_faculty_event_notification ON public.faculty_events;
CREATE TRIGGER hz_faculty_event_notification
  AFTER INSERT OR UPDATE OF status ON public.faculty_events
  FOR EACH ROW EXECUTE FUNCTION public.hz_notify_faculty_event();

CREATE OR REPLACE FUNCTION public.hz_notify_faculty_event_capacity_request()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_event_name text;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status OR NEW.status NOT IN ('approved','rejected') THEN RETURN NEW; END IF;
  SELECT name INTO v_event_name FROM public.faculty_events WHERE id = NEW.event_id;
  PERFORM public.hz_create_notification(NEW.faculty_user_id, 'faculty_event_update',
    CASE NEW.status WHEN 'approved' THEN 'Event capacity request approved' ELSE 'Event capacity request declined' END,
    format('Your request to update capacity for %s was %s.', coalesce(v_event_name, 'your event'), NEW.status),
    '/app?eventId=' || NEW.event_id,
    'faculty-event-capacity:' || NEW.id || ':' || NEW.status);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS hz_faculty_event_capacity_notification ON public.faculty_event_capacity_requests;
CREATE TRIGGER hz_faculty_event_capacity_notification
  AFTER UPDATE OF status ON public.faculty_event_capacity_requests
  FOR EACH ROW EXECUTE FUNCTION public.hz_notify_faculty_event_capacity_request();

CREATE OR REPLACE FUNCTION public.hz_notify_faculty_event_token_request()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_event_name text;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status OR NEW.status NOT IN ('approved','rejected') THEN RETURN NEW; END IF;
  SELECT name INTO v_event_name FROM public.faculty_events WHERE id = NEW.event_id;
  PERFORM public.hz_create_notification(NEW.requester_user_id, 'faculty_event_update',
    CASE NEW.status WHEN 'approved' THEN 'Extra event tokens approved' ELSE 'Extra event tokens declined' END,
    format('Your request for %s additional tokens at %s was %s.', NEW.requested_count, coalesce(v_event_name, 'your event'), NEW.status),
    '/app?eventId=' || NEW.event_id,
    'faculty-event-token-request:' || NEW.id || ':' || NEW.status);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS hz_faculty_event_token_request_notification ON public.faculty_event_token_requests;
CREATE TRIGGER hz_faculty_event_token_request_notification
  AFTER UPDATE OF status ON public.faculty_event_token_requests
  FOR EACH ROW EXECUTE FUNCTION public.hz_notify_faculty_event_token_request();

-- Queue one Edge Function dispatch per new in-app record. The URL is read from Vault; no credential is added to pg_net request headers.
CREATE OR REPLACE FUNCTION public.hz_queue_web_push()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_url text; v_apikey text;
BEGIN
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'notification_dispatch_url' LIMIT 1;
  SELECT decrypted_secret INTO v_apikey FROM vault.decrypted_secrets WHERE name = 'notification_dispatch_apikey' LIMIT 1;
  IF v_url IS NULL OR v_apikey IS NULL THEN
    RAISE WARNING 'Web Push dispatch is not configured; notification % remains available in-app', NEW.id;
    RETURN NEW;
  END IF;
  PERFORM net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/dispatch-push',
    body := jsonb_build_object('notification_id', NEW.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', v_apikey),
    timeout_milliseconds := 5000
  );
  RETURN NEW;
EXCEPTION WHEN undefined_table OR undefined_function THEN
  RAISE WARNING 'Web Push dispatch requires Supabase Vault and pg_net';
  RETURN NEW;
WHEN invalid_schema_name THEN
  RAISE WARNING 'Web Push dispatch requires Supabase Vault and pg_net';
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.hz_queue_web_push() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS hz_queue_web_push_after_notification ON public.notifications;
CREATE TRIGGER hz_queue_web_push_after_notification
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.hz_queue_web_push();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END;
$$;

COMMIT;
