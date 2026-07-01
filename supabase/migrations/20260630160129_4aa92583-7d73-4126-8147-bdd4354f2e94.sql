
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TYPE public.stock_movement_type AS ENUM ('purchase','sale','adjustment','return_in','return_out','opening','transfer','wastage');

-- categories
CREATE TABLE public.categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  slug text NOT NULL,
  color text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, slug)
);
CREATE INDEX idx_categories_shop ON public.categories(shop_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categories members read" ON public.categories
  FOR SELECT TO authenticated USING (public.is_shop_member(auth.uid(), shop_id));
CREATE POLICY "categories managers insert" ON public.categories
  FOR INSERT TO authenticated WITH CHECK (public.can_manage_shop(auth.uid(), shop_id));
CREATE POLICY "categories managers update" ON public.categories
  FOR UPDATE TO authenticated USING (public.can_manage_shop(auth.uid(), shop_id))
  WITH CHECK (public.can_manage_shop(auth.uid(), shop_id));
CREATE POLICY "categories managers delete" ON public.categories
  FOR DELETE TO authenticated USING (public.can_manage_shop(auth.uid(), shop_id));

CREATE TRIGGER set_categories_updated_at BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- products
CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  sku text,
  barcode text,
  unit text NOT NULL DEFAULT 'pcs',
  mrp numeric(12,2) NOT NULL DEFAULT 0,
  sale_price numeric(12,2) NOT NULL DEFAULT 0,
  cost_price numeric(12,2) NOT NULL DEFAULT 0,
  tax_rate numeric(5,2) NOT NULL DEFAULT 0,
  hsn_code text,
  image_url text,
  track_stock boolean NOT NULL DEFAULT true,
  stock_qty numeric(14,3) NOT NULL DEFAULT 0,
  reorder_level numeric(14,3) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_products_shop ON public.products(shop_id);
CREATE INDEX idx_products_category ON public.products(category_id);
CREATE UNIQUE INDEX uq_products_shop_sku ON public.products(shop_id, sku) WHERE sku IS NOT NULL;
CREATE UNIQUE INDEX uq_products_shop_barcode ON public.products(shop_id, barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_products_name_trgm ON public.products USING gin (lower(name) public.gin_trgm_ops);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products members read" ON public.products
  FOR SELECT TO authenticated USING (public.is_shop_member(auth.uid(), shop_id));
CREATE POLICY "products managers insert" ON public.products
  FOR INSERT TO authenticated WITH CHECK (public.can_manage_shop(auth.uid(), shop_id));
CREATE POLICY "products managers update" ON public.products
  FOR UPDATE TO authenticated USING (public.can_manage_shop(auth.uid(), shop_id))
  WITH CHECK (public.can_manage_shop(auth.uid(), shop_id));
CREATE POLICY "products managers delete" ON public.products
  FOR DELETE TO authenticated USING (public.can_manage_shop(auth.uid(), shop_id));

CREATE TRIGGER set_products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- stock_movements
CREATE TABLE public.stock_movements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  type public.stock_movement_type NOT NULL,
  quantity numeric(14,3) NOT NULL,
  unit_cost numeric(12,2),
  reference text,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_stock_movements_shop ON public.stock_movements(shop_id);
CREATE INDEX idx_stock_movements_product ON public.stock_movements(product_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_movements members read" ON public.stock_movements
  FOR SELECT TO authenticated USING (public.is_shop_member(auth.uid(), shop_id));
CREATE POLICY "stock_movements members insert" ON public.stock_movements
  FOR INSERT TO authenticated WITH CHECK (public.is_shop_member(auth.uid(), shop_id));
CREATE POLICY "stock_movements managers update" ON public.stock_movements
  FOR UPDATE TO authenticated USING (public.can_manage_shop(auth.uid(), shop_id))
  WITH CHECK (public.can_manage_shop(auth.uid(), shop_id));
CREATE POLICY "stock_movements managers delete" ON public.stock_movements
  FOR DELETE TO authenticated USING (public.can_manage_shop(auth.uid(), shop_id));

CREATE OR REPLACE FUNCTION public.apply_stock_movement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  delta numeric;
BEGIN
  delta := CASE NEW.type
    WHEN 'purchase' THEN NEW.quantity
    WHEN 'opening' THEN NEW.quantity
    WHEN 'return_in' THEN NEW.quantity
    WHEN 'sale' THEN -NEW.quantity
    WHEN 'return_out' THEN -NEW.quantity
    WHEN 'wastage' THEN -NEW.quantity
    WHEN 'transfer' THEN -NEW.quantity
    WHEN 'adjustment' THEN NEW.quantity
  END;
  UPDATE public.products SET stock_qty = stock_qty + delta WHERE id = NEW.product_id;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_apply_stock_movement
  AFTER INSERT ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.apply_stock_movement();
