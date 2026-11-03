-- Store a snapshot only after canteen staff confirm the bill printed or saved as PDF.
-- Print records are audit events; they never change order, payment, or collection state.
CREATE TABLE public.order_print_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  canteen_id uuid NOT NULL REFERENCES public.canteens(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_number text NOT NULL,
  order_type text NOT NULL CHECK (order_type IN ('dine_in','parcel')),
  payment_method text NOT NULL CHECK (payment_method IN ('counter','razorpay')),
  payment_status text NOT NULL CHECK (payment_status IN ('unpaid','pending','paid','failed','refund_pending','refunded')),
  order_status text NOT NULL CHECK (order_status IN ('pending_payment','placed','preparing','ready','collected','cancelled')),
  paper_width text NOT NULL CHECK (paper_width IN ('auto','58','80')),
  bill_snapshot jsonb NOT NULL,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX order_print_events_order_created ON public.order_print_events(order_id, created_at DESC);
CREATE INDEX order_print_events_owner_created ON public.order_print_events(owner_user_id, created_at DESC);
GRANT SELECT ON public.order_print_events TO authenticated;
GRANT ALL ON public.order_print_events TO service_role;
ALTER TABLE public.order_print_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Canteen owners read their print events" ON public.order_print_events
  FOR SELECT TO authenticated USING (owner_user_id = auth.uid() AND public.owns_canteen(canteen_id));
CREATE POLICY "Admins read order print events" ON public.order_print_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
