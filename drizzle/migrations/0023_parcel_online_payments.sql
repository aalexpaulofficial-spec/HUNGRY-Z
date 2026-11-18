-- Let parcel orders use the same Razorpay and counter payment options as dine-in.
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_parcel_counter_only;

-- Keep the existing atomic order creation logic and relax only its parcel/payment guard.
DO $migration$
DECLARE
  function_definition text;
  parcel_guard constant text := $guard$IF p_order_type = 'parcel' AND p_payment_method <> 'counter' THEN RAISE EXCEPTION 'HUNGRY:parcel_counter_only'; END IF;$guard$;
BEGIN
  function_definition := pg_get_functiondef(
    'public.hungry_place_order(uuid,uuid,text,jsonb,text,text,integer,uuid,integer,text,text,text)'::regprocedure
  );

  IF position(parcel_guard IN function_definition) = 0 THEN
    RAISE EXCEPTION 'Could not find the existing parcel payment guard in hungry_place_order.';
  END IF;

  EXECUTE replace(function_definition, parcel_guard, '');
END;
$migration$;
