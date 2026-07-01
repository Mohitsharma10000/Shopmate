DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'shops'
      AND policyname = 'shops owner can read'
  ) THEN
    CREATE POLICY "shops owner can read"
      ON public.shops
      FOR SELECT
      TO authenticated
      USING (owner_id = auth.uid());
  END IF;
END $$;