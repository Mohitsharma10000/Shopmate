
-- Sales (POS invoices)
CREATE TABLE public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  invoice_number text NOT NULL,
  invoice_date timestamptz NOT NULL DEFAULT now(),
  customer_name text,
  customer_phone text,
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  tax_total numeric(14,2) NOT NULL DEFAULT 0,
  discount numeric(14,2) NOT NULL DEFAULT 0,
  round_off numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  amount_paid numeric(14,2) NOT NULL DEFAULT 0,
  change_due numeric(14,2) NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash','card','upi','credit','split')),
  payment_status text NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('paid','unpaid','partial')),
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','void','refunded')),
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, invoice_number)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO authenticated;
GRANT ALL ON public.sales TO service_role;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view sales" ON public.sales
  FOR SELECT TO authenticated USING (public.is_shop_member(auth.uid(), shop_id));
CREATE POLICY "Members can create sales" ON public.sales
  FOR INSERT TO authenticated WITH CHECK (public.is_shop_member(auth.uid(), shop_id));
CREATE POLICY "Managers can update sales" ON public.sales
  FOR UPDATE TO authenticated USING (public.can_manage_shop(auth.uid(), shop_id));
CREATE POLICY "Managers can delete sales" ON public.sales
  FOR DELETE TO authenticated USING (public.can_manage_shop(auth.uid(), shop_id));

CREATE INDEX idx_sales_shop_date ON public.sales(shop_id, invoice_date DESC);

CREATE TRIGGER sales_updated_at BEFORE UPDATE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Sale items
CREATE TABLE public.sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity numeric(14,3) NOT NULL CHECK (quantity > 0),
  unit_price numeric(14,2) NOT NULL DEFAULT 0,
  tax_rate numeric(6,2) NOT NULL DEFAULT 0,
  discount numeric(14,2) NOT NULL DEFAULT 0,
  line_total numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_items TO authenticated;
GRANT ALL ON public.sale_items TO service_role;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view sale_items" ON public.sale_items
  FOR SELECT TO authenticated USING (public.is_shop_member(auth.uid(), shop_id));
CREATE POLICY "Members can create sale_items" ON public.sale_items
  FOR INSERT TO authenticated WITH CHECK (public.is_shop_member(auth.uid(), shop_id));
CREATE POLICY "Managers can delete sale_items" ON public.sale_items
  FOR DELETE TO authenticated USING (public.can_manage_shop(auth.uid(), shop_id));

CREATE INDEX idx_sale_items_sale ON public.sale_items(sale_id);
CREATE INDEX idx_sale_items_product ON public.sale_items(product_id);

-- Trigger: when a sale item is inserted, create a 'sale' stock movement
CREATE OR REPLACE FUNCTION public.sale_item_record_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_track boolean;
  v_inv text;
BEGIN
  SELECT track_stock INTO v_track FROM public.products WHERE id = NEW.product_id;
  IF v_track THEN
    SELECT invoice_number INTO v_inv FROM public.sales WHERE id = NEW.sale_id;
    INSERT INTO public.stock_movements (shop_id, product_id, type, quantity, unit_cost, reference, note, created_by)
    VALUES (NEW.shop_id, NEW.product_id, 'sale', NEW.quantity, NEW.unit_price,
            COALESCE(v_inv, NEW.sale_id::text), 'POS sale', auth.uid());
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER sale_items_apply_stock
AFTER INSERT ON public.sale_items
FOR EACH ROW EXECUTE FUNCTION public.sale_item_record_stock();

-- Invoice number generator: per shop, formatted like INV-000001
CREATE OR REPLACE FUNCTION public.next_invoice_number(_shop_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.sales WHERE shop_id = _shop_id;
  RETURN 'INV-' || LPAD((v_count + 1)::text, 6, '0');
END $$;

GRANT EXECUTE ON FUNCTION public.next_invoice_number(uuid) TO authenticated;
