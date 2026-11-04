-- Persist the customer collection thank-you dismissal and consume any legacy
-- print thank-you notification through the same popup.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS collection_thank_you_seen_at timestamptz;

-- Do not display the new popup for orders collected before this workflow ships.
UPDATE public.orders
SET collection_thank_you_seen_at = now()
WHERE status = 'collected' AND collection_thank_you_seen_at IS NULL;

CREATE OR REPLACE FUNCTION public.hungry_acknowledge_collected_order_thank_you(
  p_order_id uuid,
  p_customer_user_id uuid
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order public.orders%ROWTYPE;
BEGIN
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND OR v_order.user_id <> p_customer_user_id THEN
    RAISE EXCEPTION 'THANKYOU:not_order_customer';
  END IF;
  IF v_order.status <> 'collected' THEN
    RAISE EXCEPTION 'THANKYOU:order_not_collected';
  END IF;
  IF v_order.collection_thank_you_seen_at IS NOT NULL THEN RETURN false; END IF;

  UPDATE public.orders
  SET collection_thank_you_seen_at = now(),
      bill_print_thank_you_seen_at = CASE
        WHEN bill_print_confirmed_at IS NOT NULL THEN coalesce(bill_print_thank_you_seen_at, now())
        ELSE bill_print_thank_you_seen_at
      END
  WHERE id = p_order_id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.hungry_acknowledge_collected_order_thank_you(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hungry_acknowledge_collected_order_thank_you(uuid, uuid) TO service_role;
