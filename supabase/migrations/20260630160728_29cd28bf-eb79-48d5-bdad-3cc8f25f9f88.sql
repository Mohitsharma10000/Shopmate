
-- Suppliers
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name text NOT NULL,
  contact_person text,
  phone text,
  email text,
  address text,
  gstin text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_suppliers_shop ON public.suppliers(shop_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suppliers read members" ON public.suppliers FOR SELECT TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id));
CREATE POLICY "suppliers write managers" ON public.suppliers FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_shop(auth.uid(), shop_id));
CREATE POLICY "suppliers update managers" ON public.suppliers FOR UPDATE TO authenticated
  USING (public.can_manage_shop(auth.uid(), shop_id))
  WITH CHECK (public.can_manage_shop(auth.uid(), shop_id));
CREATE POLICY "suppliers delete managers" ON public.suppliers FOR DELETE TO authenticated
  USING (public.can_manage_shop(auth.uid(), shop_id));
CREATE TRIGGER suppliers_set_updated_at BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Purchases (invoice header)
CREATE TABLE public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  invoice_number text,
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  subtotal numeric NOT NULL DEFAULT 0,
  tax_total numeric NOT NULL DEFAULT 0,
  discount numeric NOT NULL DEFAULT 0,
  other_charges numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'unpaid',
  amount_paid numeric NOT NULL DEFAULT 0,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_purchases_shop ON public.purchases(shop_id);
CREATE INDEX idx_purchases_supplier ON public.purchases(supplier_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchases TO authenticated;
GRANT ALL ON public.purchases TO service_role;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchases read members" ON public.purchases FOR SELECT TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id));
CREATE POLICY "purchases insert managers" ON public.purchases FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_shop(auth.uid(), shop_id));
CREATE POLICY "purchases update managers" ON public.purchases FOR UPDATE TO authenticated
  USING (public.can_manage_shop(auth.uid(), shop_id))
  WITH CHECK (public.can_manage_shop(auth.uid(), shop_id));
CREATE POLICY "purchases delete managers" ON public.purchases FOR DELETE TO authenticated
  USING (public.can_manage_shop(auth.uid(), shop_id));
CREATE TRIGGER purchases_set_updated_at BEFORE UPDATE ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Purchase items
CREATE TABLE public.purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity numeric NOT NULL CHECK (quantity > 0),
  unit_cost numeric NOT NULL DEFAULT 0,
  tax_rate numeric NOT NULL DEFAULT 0,
  discount numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_purchase_items_purchase ON public.purchase_items(purchase_id);
CREATE INDEX idx_purchase_items_product ON public.purchase_items(product_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_items TO authenticated;
GRANT ALL ON public.purchase_items TO service_role;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchase_items read members" ON public.purchase_items FOR SELECT TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id));
CREATE POLICY "purchase_items insert managers" ON public.purchase_items FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_shop(auth.uid(), shop_id));
CREATE POLICY "purchase_items update managers" ON public.purchase_items FOR UPDATE TO authenticated
  USING (public.can_manage_shop(auth.uid(), shop_id))
  WITH CHECK (public.can_manage_shop(auth.uid(), shop_id));
CREATE POLICY "purchase_items delete managers" ON public.purchase_items FOR DELETE TO authenticated
  USING (public.can_manage_shop(auth.uid(), shop_id));

-- Trigger: when purchase item inserted, create stock movement (which auto-updates stock)
CREATE OR REPLACE FUNCTION public.purchase_item_record_stock()
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
    SELECT invoice_number INTO v_inv FROM public.purchases WHERE id = NEW.purchase_id;
    INSERT INTO public.stock_movements (shop_id, product_id, type, quantity, unit_cost, reference, note, created_by)
    VALUES (NEW.shop_id, NEW.product_id, 'purchase', NEW.quantity, NEW.unit_cost,
            COALESCE(v_inv, NEW.purchase_id::text), 'Purchase entry', auth.uid());
  END IF;
  -- Optionally update product cost_price to latest
  UPDATE public.products SET cost_price = NEW.unit_cost WHERE id = NEW.product_id AND NEW.unit_cost > 0;
  RETURN NEW;
END $$;

CREATE TRIGGER purchase_items_apply_stock
AFTER INSERT ON public.purchase_items
FOR EACH ROW EXECUTE FUNCTION public.purchase_item_record_stock();
