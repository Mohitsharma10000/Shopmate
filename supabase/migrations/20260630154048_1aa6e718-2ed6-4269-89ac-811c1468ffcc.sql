DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'on_shop_created'
      AND tgrelid = 'public.shops'::regclass
  ) THEN
    CREATE TRIGGER on_shop_created
      AFTER INSERT ON public.shops
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_new_shop();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_profiles_updated_at'
      AND tgrelid = 'public.profiles'::regclass
  ) THEN
    CREATE TRIGGER set_profiles_updated_at
      BEFORE UPDATE ON public.profiles
      FOR EACH ROW
      EXECUTE FUNCTION public.tg_set_updated_at();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_shops_updated_at'
      AND tgrelid = 'public.shops'::regclass
  ) THEN
    CREATE TRIGGER set_shops_updated_at
      BEFORE UPDATE ON public.shops
      FOR EACH ROW
      EXECUTE FUNCTION public.tg_set_updated_at();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_shop_members_updated_at'
      AND tgrelid = 'public.shop_members'::regclass
  ) THEN
    CREATE TRIGGER set_shop_members_updated_at
      BEFORE UPDATE ON public.shop_members
      FOR EACH ROW
      EXECUTE FUNCTION public.tg_set_updated_at();
  END IF;
END $$;