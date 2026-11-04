-- Make the explicit canteen print confirmation a single durable notification
-- for its order. A print confirmation never changes order/payment status.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS bill_print_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS bill_print_thank_you_seen_at timestamptz;

-- Preserve existing confirmed print records as customer notifications.
WITH first_confirmed_print AS (
  SELECT order_id, min(confirmed_at) AS confirmed_at
  FROM public.order_print_events
  GROUP BY order_id
)
UPDATE public.orders o
SET bill_print_confirmed_at = p.confirmed_at
FROM first_confirmed_print p
WHERE o.id = p.order_id AND o.bill_print_confirmed_at IS NULL;

CREATE INDEX IF NOT EXISTS orders_pending_print_thank_you
  ON public.orders (user_id, created_at DESC)
  WHERE bill_print_confirmed_at IS NOT NULL AND bill_print_thank_you_seen_at IS NULL;

CREATE OR REPLACE FUNCTION public.hungry_confirm_order_bill_print(
  p_order_id uuid,
  p_owner_user_id uuid,
  p_paper_width text
) RETURNS TABLE (confirmed_at timestamptz, already_confirmed boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_confirmed_at timestamptz;
BEGIN
  IF p_paper_width NOT IN ('auto', '58', '80') THEN
    RAISE EXCEPTION 'PRINT:invalid_paper_width';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'PRINT:order_not_found'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.canteens c
    WHERE c.id = v_order.canteen_id AND c.owner_user_id = p_owner_user_id AND c.is_active
  ) THEN RAISE EXCEPTION 'PRINT:not_canteen_owner'; END IF;
  IF v_order.status = 'cancelled' THEN RAISE EXCEPTION 'PRINT:cancelled_order'; END IF;

  -- The order row lock serializes repeated or simultaneous confirmation calls.
  -- Only the first explicit confirmation creates an audit row/notification.
  IF v_order.bill_print_confirmed_at IS NOT NULL THEN
    RETURN QUERY SELECT v_order.bill_print_confirmed_at, true;
    RETURN;
  END IF;

  v_confirmed_at := now();
  INSERT INTO public.order_print_events (
    order_id, canteen_id, owner_user_id, order_number, order_type,
    payment_method, payment_status, order_status, paper_width, bill_snapshot,
    confirmed_at
  ) VALUES (
    v_order.id, v_order.canteen_id, p_owner_user_id, v_order.order_number,
    v_order.order_type, v_order.payment_method, v_order.payment_status,
    v_order.status, p_paper_width,
    jsonb_build_object(
      'customer_name', v_order.customer_name,
      'lines', v_order.lines,
      'subtotal', v_order.subtotal,
      'discount', v_order.discount,
      'total', v_order.total,
      'pickup_code', v_order.pickup_code,
      'counter', v_order.counter,
      'created_at', v_order.created_at
    ),
    v_confirmed_at
  );

  UPDATE public.orders
  SET bill_print_confirmed_at = v_confirmed_at
  WHERE id = v_order.id;

  RETURN QUERY SELECT v_confirmed_at, false;
END;
$$;

REVOKE ALL ON FUNCTION public.hungry_confirm_order_bill_print(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hungry_confirm_order_bill_print(uuid, uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.hungry_acknowledge_bill_print_thank_you(
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
    RAISE EXCEPTION 'PRINT:not_order_customer';
  END IF;
  IF v_order.bill_print_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'PRINT:not_confirmed';
  END IF;
  IF v_order.bill_print_thank_you_seen_at IS NOT NULL THEN RETURN false; END IF;

  UPDATE public.orders
  SET bill_print_thank_you_seen_at = now()
  WHERE id = p_order_id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.hungry_acknowledge_bill_print_thank_you(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hungry_acknowledge_bill_print_thank_you(uuid, uuid) TO service_role;
