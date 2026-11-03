-- HUNGRY canteen-owner credentials and brute-force protection.
-- Run after 001_hungry_core.sql and 002_payments_coupons_refunds.sql.

CREATE TABLE public.canteen_owner_credentials (
  canteen_id uuid PRIMARY KEY REFERENCES public.canteens(id) ON DELETE CASCADE,
  login_id text NOT NULL UNIQUE CHECK (login_id ~ '^[A-Z2-9]{7}$'),
  code_salt text NOT NULL CHECK (code_salt ~ '^[a-f0-9]{32}$'),
  code_hash text NOT NULL CHECK (code_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.canteen_owner_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.canteen_owner_credentials FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.canteen_owner_credentials TO service_role;

-- Store only SHA-256 digests of IP and Canteen ID rate-limit keys.
CREATE TABLE public.canteen_owner_login_limits (
  key_hash text PRIMARY KEY CHECK (key_hash ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  blocked_until timestamptz
);
ALTER TABLE public.canteen_owner_login_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.canteen_owner_login_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.canteen_owner_login_limits TO service_role;

CREATE OR REPLACE FUNCTION public.hungry_allow_canteen_owner_login(p_ip_key text, p_owner_key text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_key text;
  v_started timestamptz;
  v_attempts integer;
  v_blocked timestamptz;
  v_allowed boolean := true;
BEGIN
  IF p_ip_key !~ '^[a-f0-9]{64}$' OR p_owner_key !~ '^[a-f0-9]{64}$' THEN
    RETURN false;
  END IF;

  -- Lock both buckets in a stable order so concurrent requests cannot skip limits.
  FOR v_key IN SELECT DISTINCT unnest(ARRAY[p_ip_key, p_owner_key]) AS key_hash ORDER BY key_hash LOOP
    INSERT INTO public.canteen_owner_login_limits (key_hash) VALUES (v_key) ON CONFLICT DO NOTHING;
    SELECT window_started_at, attempts, blocked_until
      INTO v_started, v_attempts, v_blocked
      FROM public.canteen_owner_login_limits WHERE key_hash = v_key FOR UPDATE;

    IF v_blocked > now() THEN
      v_allowed := false;
    ELSIF v_started < now() - interval '15 minutes' THEN
      UPDATE public.canteen_owner_login_limits
        SET window_started_at = now(), attempts = 1, blocked_until = NULL WHERE key_hash = v_key;
    ELSIF v_attempts >= 5 THEN
      UPDATE public.canteen_owner_login_limits
        SET blocked_until = now() + interval '15 minutes' WHERE key_hash = v_key;
      v_allowed := false;
    ELSE
      UPDATE public.canteen_owner_login_limits SET attempts = attempts + 1 WHERE key_hash = v_key;
    END IF;
  END LOOP;
  RETURN v_allowed;
END;
$$;
REVOKE ALL ON FUNCTION public.hungry_allow_canteen_owner_login(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hungry_allow_canteen_owner_login(text, text) TO service_role;
