
-- Customers (Khata) + ledger, profit cost snapshot, sales.customer_id link

-- 1) Customers
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  email text,
  address text,
  credit_limit numeric(14,2) NOT NULL DEFAULT 0,
  balance numeric(14,2) NOT NULL DEFAULT 0,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX customers_shop_idx ON public.customers(shop_id);
CREATE INDEX customers_phone_idx ON public.customers(shop_id, phone);
CREATE INDEX customers_name_trgm ON public.customers USING gin (name gin_trgm_ops);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read customers" ON public.customers FOR SELECT TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id));
CREATE POLICY "members insert customers" ON public.customers FOR INSERT TO authenticated
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id));
CREATE POLICY "members update customers" ON public.customers FOR UPDATE TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id));
CREATE POLICY "managers delete customers" ON public.customers FOR DELETE TO authenticated
  USING (public.can_manage_shop(auth.uid(), shop_id));

CREATE TRIGGER customers_set_updated BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 2) Customer ledger (Khata entries)
CREATE TABLE public.customer_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  -- credit_sale increases balance (customer owes more), payment decreases, adjustment can be +/-
  type text NOT NULL CHECK (type IN ('credit_sale','payment','adjustment','opening')),
  amount numeric(14,2) NOT NULL,
  sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  payment_method text,
  reference text,
  note text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ledger_customer_idx ON public.customer_ledger(customer_id, created_at DESC);
CREATE INDEX ledger_shop_idx ON public.customer_ledger(shop_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_ledger TO authenticated;
GRANT ALL ON public.customer_ledger TO service_role;
ALTER TABLE public.customer_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read ledger" ON public.customer_ledger FOR SELECT TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id));
CREATE POLICY "members insert ledger" ON public.customer_ledger FOR INSERT TO authenticated
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id));
CREATE POLICY "managers update ledger" ON public.customer_ledger FOR UPDATE TO authenticated
  USING (public.can_manage_shop(auth.uid(), shop_id));
CREATE POLICY "managers delete ledger" ON public.customer_ledger FOR DELETE TO authenticated
  USING (public.can_manage_shop(auth.uid(), shop_id));

-- Trigger: apply ledger entry to customer balance
CREATE OR REPLACE FUNCTION public.apply_customer_ledger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  delta numeric;
BEGIN
  delta := CASE NEW.type
    WHEN 'credit_sale' THEN NEW.amount
    WHEN 'opening' THEN NEW.amount
    WHEN 'adjustment' THEN NEW.amount
    WHEN 'payment' THEN -NEW.amount
  END;
  UPDATE public.customers SET balance = balance + delta WHERE id = NEW.customer_id;
  RETURN NEW;
END $$;

CREATE TRIGGER ledger_apply_balance AFTER INSERT ON public.customer_ledger
  FOR EACH ROW EXECUTE FUNCTION public.apply_customer_ledger();

-- 3) Link sales to customer + auto-add credit ledger
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS sales_customer_idx ON public.sales(customer_id);

CREATE OR REPLACE FUNCTION public.sale_record_credit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  due numeric;
BEGIN
  IF NEW.customer_id IS NULL THEN RETURN NEW; END IF;
  due := COALESCE(NEW.total,0) - COALESCE(NEW.amount_paid,0);
  IF due > 0 THEN
    INSERT INTO public.customer_ledger(shop_id, customer_id, type, amount, sale_id, reference, note, created_by)
    VALUES (NEW.shop_id, NEW.customer_id, 'credit_sale', due, NEW.id, NEW.invoice_number, 'Credit on invoice', NEW.created_by);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER sale_after_insert_credit AFTER INSERT ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.sale_record_credit();

-- 4) Cost snapshot on sale_items for profit analytics
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS unit_cost numeric(14,4) NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.sale_item_set_cost()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.unit_cost IS NULL OR NEW.unit_cost = 0 THEN
    SELECT COALESCE(cost_price,0) INTO NEW.unit_cost FROM public.products WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER sale_item_before_insert_cost BEFORE INSERT ON public.sale_items
  FOR EACH ROW EXECUTE FUNCTION public.sale_item_set_cost();
