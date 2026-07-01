
-- Enums
CREATE TYPE public.app_role AS ENUM ('owner', 'manager', 'cashier', 'staff');
CREATE TYPE public.member_status AS ENUM ('active', 'invited', 'disabled');

-- updated_at helper
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ profiles ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  active_shop_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles self read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles self insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ shops ============
CREATE TABLE public.shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  business_type TEXT NOT NULL DEFAULT 'grocery',
  gstin TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  currency TEXT NOT NULL DEFAULT 'INR',
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shops TO authenticated;
GRANT ALL ON public.shops TO service_role;
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_shops_updated BEFORE UPDATE ON public.shops FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ shop_members ============
CREATE TABLE public.shop_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_email TEXT,
  role public.app_role NOT NULL DEFAULT 'staff',
  status public.member_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT shop_member_unique UNIQUE (shop_id, user_id),
  CONSTRAINT shop_member_has_target CHECK (user_id IS NOT NULL OR invited_email IS NOT NULL)
);
CREATE INDEX idx_shop_members_user ON public.shop_members(user_id);
CREATE INDEX idx_shop_members_shop ON public.shop_members(shop_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_members TO authenticated;
GRANT ALL ON public.shop_members TO service_role;
ALTER TABLE public.shop_members ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_shop_members_updated BEFORE UPDATE ON public.shop_members FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ user_roles (global, rarely used) ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles self read" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ============ Security definer helpers ============
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_shop_member(_user_id UUID, _shop_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shop_members
    WHERE shop_id = _shop_id AND user_id = _user_id AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.shop_member_role(_user_id UUID, _shop_id UUID)
RETURNS public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.shop_members
  WHERE shop_id = _shop_id AND user_id = _user_id AND status = 'active'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_shop(_user_id UUID, _shop_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shop_members
    WHERE shop_id = _shop_id AND user_id = _user_id AND status = 'active'
      AND role IN ('owner', 'manager')
  );
$$;

-- ============ Shops policies (after helpers exist) ============
CREATE POLICY "shops members can read" ON public.shops FOR SELECT TO authenticated
  USING (public.is_shop_member(auth.uid(), id));
CREATE POLICY "shops anyone can create as owner" ON public.shops FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "shops owner can update" ON public.shops FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "shops owner can delete" ON public.shops FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- ============ shop_members policies ============
CREATE POLICY "members read own row" ON public.shop_members FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "members read shop roster" ON public.shop_members FOR SELECT TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id));
CREATE POLICY "managers add members" ON public.shop_members FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_shop(auth.uid(), shop_id));
CREATE POLICY "managers update members" ON public.shop_members FOR UPDATE TO authenticated
  USING (public.can_manage_shop(auth.uid(), shop_id))
  WITH CHECK (public.can_manage_shop(auth.uid(), shop_id));
CREATE POLICY "managers remove members" ON public.shop_members FOR DELETE TO authenticated
  USING (public.can_manage_shop(auth.uid(), shop_id));

-- ============ Triggers: auto profile on signup ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ Auto-add shop creator as owner member ============
CREATE OR REPLACE FUNCTION public.handle_new_shop()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.shop_members (shop_id, user_id, role, status)
  VALUES (NEW.id, NEW.owner_id, 'owner', 'active')
  ON CONFLICT DO NOTHING;

  -- Set as active shop if user has none
  UPDATE public.profiles SET active_shop_id = NEW.id
   WHERE id = NEW.owner_id AND active_shop_id IS NULL;

  RETURN NEW;
END; $$;

CREATE TRIGGER on_shop_created
AFTER INSERT ON public.shops
FOR EACH ROW EXECUTE FUNCTION public.handle_new_shop();
