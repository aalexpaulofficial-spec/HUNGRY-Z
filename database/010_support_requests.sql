-- Persist ratings, feedback and issue reports before attempting support email delivery.
CREATE TABLE public.support_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  canteen_id uuid REFERENCES public.canteens(id) ON DELETE SET NULL,
  sender_name text NOT NULL,
  sender_email text NOT NULL DEFAULT '',
  sender_role text NOT NULL,
  category text NOT NULL CHECK (category IN ('Rate Us','Feedback','Report an issue','Order issue','Payment issue','Operational issue','Other')),
  description text NOT NULL CHECK (char_length(description) BETWEEN 3 AND 2000),
  order_number text NOT NULL DEFAULT '' CHECK (char_length(order_number) <= 80),
  rating integer CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  email_status text NOT NULL DEFAULT 'pending' CHECK (email_status IN ('pending','sent','failed')),
  email_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((category = 'Rate Us' AND rating IS NOT NULL) OR (category <> 'Rate Us' AND rating IS NULL))
);

CREATE INDEX support_requests_user_created ON public.support_requests(user_id, created_at DESC);
CREATE INDEX support_requests_canteen_created ON public.support_requests(canteen_id, created_at DESC);

REVOKE ALL ON public.support_requests FROM anon, authenticated;
GRANT SELECT ON public.support_requests TO authenticated;
GRANT ALL ON public.support_requests TO service_role;
ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own support requests" ON public.support_requests
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR (canteen_id IS NOT NULL AND public.owns_canteen(canteen_id))
    OR public.has_role(auth.uid(), 'admin')
  );
