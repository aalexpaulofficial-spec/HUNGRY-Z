-- Keep bill printing, the customer's tracking display, and physical food receipt
-- as distinct states. PRINT BILL never changes payment or manual order status.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS food_received_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completion_workflow text;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_completion_workflow_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_completion_workflow_check
  CHECK (completion_workflow IS NULL OR completion_workflow IN ('manual', 'printed'));

UPDATE public.orders
SET completion_workflow = 'printed'
WHERE bill_print_confirmed_at IS NOT NULL AND completion_workflow IS NULL;

UPDATE public.orders
SET completion_workflow = 'manual'
WHERE completion_workflow IS NULL AND status IN ('preparing', 'ready', 'collected');

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
  IF v_order.completion_workflow = 'manual' THEN
    RAISE EXCEPTION 'PRINT:manual_workflow_started';
  END IF;

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
  SET bill_print_confirmed_at = v_confirmed_at,
      completion_workflow = 'printed'
  WHERE id = v_order.id;

  RETURN QUERY SELECT v_confirmed_at, false;
END;
$$;

REVOKE ALL ON FUNCTION public.hungry_confirm_order_bill_print(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hungry_confirm_order_bill_print(uuid, uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.hungry_confirm_printed_order_food_received(
  p_order_id uuid,
  p_customer_user_id uuid
) RETURNS TABLE (confirmed_at timestamptz, already_confirmed boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_confirmed_at timestamptz;
BEGIN
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND OR v_order.user_id <> p_customer_user_id THEN
    RAISE EXCEPTION 'RECEIPT:not_order_customer';
  END IF;
  IF v_order.bill_print_confirmed_at IS NULL OR v_order.completion_workflow <> 'printed' THEN
    RAISE EXCEPTION 'RECEIPT:bill_not_printed';
  END IF;
  IF v_order.status = 'cancelled' THEN
    RAISE EXCEPTION 'RECEIPT:order_cancelled';
  END IF;
  IF v_order.food_received_confirmed_at IS NOT NULL THEN
    RETURN QUERY SELECT v_order.food_received_confirmed_at, true;
    RETURN;
  END IF;

  v_confirmed_at := now();
  UPDATE public.orders
  SET food_received_confirmed_at = v_confirmed_at
  WHERE id = p_order_id;
  RETURN QUERY SELECT v_confirmed_at, false;
END;
$$;

REVOKE ALL ON FUNCTION public.hungry_confirm_printed_order_food_received(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hungry_confirm_printed_order_food_received(uuid, uuid) TO service_role;

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
  IF NOT (
    (v_order.completion_workflow = 'printed' AND v_order.food_received_confirmed_at IS NOT NULL)
    OR (v_order.completion_workflow IS DISTINCT FROM 'printed' AND v_order.status = 'collected')
  ) THEN
    RAISE EXCEPTION 'THANKYOU:food_not_confirmed';
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
