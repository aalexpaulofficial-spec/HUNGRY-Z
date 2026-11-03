-- =====================================================================
-- HUNGRY — Migration 1 of 2: core schema
-- Roles, canteen applications, canteens, profiles, menu, orders,
-- Row Level Security, guard triggers, signup trigger, realtime.
-- Run this FIRST: Supabase dashboard → SQL Editor → New query → paste this whole file → Run.
-- =====================================================================

CREATE TYPE public.app_role AS ENUM ('admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Canteen applications (inserted only by server code after validation)
CREATE TABLE public.canteen_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_name text NOT NULL,
  owner_phone text NOT NULL,
  canteen_name text NOT NULL,
  university_name text NOT NULL,
  campus_location text NOT NULL,
  contact_email text NOT NULL,
  fssai_license text NOT NULL,
  owner_id_proof text NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.canteen_applications TO authenticated;
GRANT ALL ON public.canteen_applications TO service_role;
ALTER TABLE public.canteen_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read applications" ON public.canteen_applications FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Approved canteens
CREATE TABLE public.canteens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9]{7}$'),
  application_id uuid REFERENCES public.canteen_applications(id) ON DELETE SET NULL,
  name text NOT NULL,
  university_name text NOT NULL,
  campus_location text NOT NULL,
  contact_email text NOT NULL,
  owner_user_id uuid,
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','private','maintenance')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.canteens TO authenticated;
GRANT ALL ON public.canteens TO service_role;
ALTER TABLE public.canteens ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('student','faculty','guest')),
  full_name text NOT NULL,
  registration_number text,
  email text NOT NULL,
  current_canteen_id uuid REFERENCES public.canteens(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.current_canteen()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT current_canteen_id FROM public.profiles WHERE id = auth.uid()
$$;
CREATE OR REPLACE FUNCTION public.owns_canteen(_canteen uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.canteens WHERE id = _canteen AND owner_user_id = auth.uid())
$$;

CREATE POLICY "Admins read canteens" ON public.canteens FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owners read own canteen" ON public.canteens FOR SELECT TO authenticated USING (owner_user_id = auth.uid());
CREATE POLICY "Members read joined canteen" ON public.canteens FOR SELECT TO authenticated USING (id = public.current_canteen() AND is_active);

-- Menu
CREATE TABLE public.menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canteen_id uuid NOT NULL REFERENCES public.canteens(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 300),
  price integer NOT NULL CHECK (price >= 0 AND price <= 100000),
  category text NOT NULL DEFAULT 'Meals' CHECK (char_length(category) BETWEEN 1 AND 30),
  veg boolean NOT NULL DEFAULT true,
  prep_minutes integer NOT NULL DEFAULT 10 CHECK (prep_minutes BETWEEN 1 AND 180),
  image text NOT NULL DEFAULT 'food-indian',
  counter text NOT NULL DEFAULT 'Counter 1',
  tag text,
  available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.menu_items (canteen_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_items TO authenticated;
GRANT ALL ON public.menu_items TO service_role;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read menu" ON public.menu_items FOR SELECT TO authenticated USING (canteen_id = public.current_canteen() OR public.owns_canteen(canteen_id));
CREATE POLICY "Owners insert menu" ON public.menu_items FOR INSERT TO authenticated WITH CHECK (public.owns_canteen(canteen_id));
CREATE POLICY "Owners update menu" ON public.menu_items FOR UPDATE TO authenticated USING (public.owns_canteen(canteen_id)) WITH CHECK (public.owns_canteen(canteen_id));
CREATE POLICY "Owners delete menu" ON public.menu_items FOR DELETE TO authenticated USING (public.owns_canteen(canteen_id));

-- Orders (created only by server code which validates prices and canteen state)
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE,
  canteen_id uuid NOT NULL REFERENCES public.canteens(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  customer_name text NOT NULL,
  lines jsonb NOT NULL,
  total integer NOT NULL,
  payment text NOT NULL,
  pickup_code text NOT NULL,
  counter text NOT NULL,
  prep_minutes integer NOT NULL,
  status text NOT NULL DEFAULT 'placed' CHECK (status IN ('placed','preparing','ready','collected','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.orders (canteen_id);
CREATE INDEX ON public.orders (user_id);
GRANT SELECT, UPDATE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own orders" ON public.orders FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Owners read canteen orders" ON public.orders FOR SELECT TO authenticated USING (public.owns_canteen(canteen_id));
CREATE POLICY "Owners update order status" ON public.orders FOR UPDATE TO authenticated USING (public.owns_canteen(canteen_id)) WITH CHECK (public.owns_canteen(canteen_id));

-- Owners may only change status on orders
CREATE OR REPLACE FUNCTION public.orders_guard_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE s text := NEW.status;
BEGIN
  IF current_user = 'authenticated' THEN
    NEW := OLD;
    NEW.status := s;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER orders_guard BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.orders_guard_update();

-- Canteen owners may only toggle nothing directly; visibility is admin-only via server. Block client updates entirely except via server.
CREATE OR REPLACE FUNCTION public.canteens_guard_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user = 'authenticated' THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER canteens_guard BEFORE UPDATE ON public.canteens FOR EACH ROW EXECUTE FUNCTION public.canteens_guard_update();
CREATE OR REPLACE FUNCTION public.apps_guard_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user = 'authenticated' THEN RAISE EXCEPTION 'Not allowed'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER apps_guard BEFORE UPDATE ON public.canteen_applications FOR EACH ROW EXECUTE FUNCTION public.apps_guard_update();

CREATE OR REPLACE FUNCTION public.touch_menu()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
CREATE TRIGGER menu_touch BEFORE UPDATE ON public.menu_items FOR EACH ROW EXECUTE FUNCTION public.touch_menu();

-- Profile on signup (no canteen code at signup)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r text := lower(coalesce(NEW.raw_user_meta_data->>'role',''));
  n text := left(trim(coalesce(NEW.raw_user_meta_data->>'full_name','')), 100);
  reg text := nullif(left(trim(coalesce(NEW.raw_user_meta_data->>'registration_number','')), 40), '');
BEGIN
  IF r NOT IN ('student','faculty','guest') THEN RETURN NEW; END IF; -- canteen owners / admin have no customer profile
  IF char_length(n) < 2 THEN RAISE EXCEPTION 'Full name required'; END IF;
  IF r <> 'guest' AND reg IS NULL THEN RAISE EXCEPTION 'Registration number required'; END IF;
  INSERT INTO public.profiles (id, role, full_name, registration_number, email)
  VALUES (NEW.id, r, n, reg, NEW.email);
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.canteens;
