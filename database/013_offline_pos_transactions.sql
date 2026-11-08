-- Offline counter POS transaction outbox. This is separate from customer orders/payments.
CREATE TABLE IF NOT EXISTS public.offline_pos_transactions (
  transaction_id uuid PRIMARY KEY,
  canteen_id uuid NOT NULL REFERENCES public.canteens(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_created_at timestamptz NOT NULL,
  lines jsonb NOT NULL CHECK (jsonb_typeof(lines) = 'array' AND jsonb_array_length(lines) > 0),
  subtotal integer NOT NULL CHECK (subtotal >= 0),
  total integer NOT NULL CHECK (total >= 0),
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'upi', 'card')),
  payment_status text NOT NULL CHECK (payment_status IN ('paid', 'unpaid')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS offline_pos_transactions_canteen_created_idx
  ON public.offline_pos_transactions (canteen_id, client_created_at DESC);

ALTER TABLE public.offline_pos_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Canteen owners insert offline POS transactions" ON public.offline_pos_transactions;
CREATE POLICY "Canteen owners insert offline POS transactions"
  ON public.offline_pos_transactions FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid() AND public.owns_canteen(canteen_id));

DROP POLICY IF EXISTS "Canteen owners read offline POS transactions" ON public.offline_pos_transactions;
CREATE POLICY "Canteen owners read offline POS transactions"
  ON public.offline_pos_transactions FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid() AND public.owns_canteen(canteen_id));

GRANT SELECT, INSERT ON public.offline_pos_transactions TO authenticated;
