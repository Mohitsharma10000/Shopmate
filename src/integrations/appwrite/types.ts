export interface Shop {
  id: string;
  name: string;
  business_type: string;
  currency: string;
  timezone: string;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  active_shop_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShopMember {
  id: string;
  shop_id: string;
  user_id: string | null;
  invited_email: string | null;
  role: 'owner' | 'manager' | 'cashier' | 'staff';
  status: 'active' | 'invited' | 'disabled';
  created_at: string;
  updated_at: string;
  shop?: Shop;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: 'owner' | 'manager' | 'cashier' | 'staff';
  created_at: string;
}

export interface Category {
  id: string;
  shop_id: string;
  name: string;
  slug: string;
  color: string | null;
  parent_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  shop_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  sku: string | null;
  barcode: string | null;
  unit: string;
  mrp: number;
  sale_price: number;
  cost_price: number;
  tax_rate: number;
  hsn_code: string | null;
  image_url: string | null;
  track_stock: boolean;
  stock_qty: number;
  reorder_level: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  category?: {
    id: string;
    name: string;
    color: string | null;
  } | null;
}

export interface StockMovement {
  id: string;
  shop_id: string;
  product_id: string;
  type: 'purchase' | 'sale' | 'adjustment' | 'return_in' | 'return_out' | 'opening' | 'transfer' | 'wastage';
  quantity: number;
  unit_cost: number | null;
  note: string | null;
  reference: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Customer {
  id: string;
  shop_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  credit_limit: number;
  balance: number;
  is_active: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerLedger {
  id: string;
  shop_id: string;
  customer_id: string;
  sale_id: string | null;
  amount: number;
  type: string;
  payment_method: string | null;
  reference: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Sale {
  id: string;
  shop_id: string;
  customer_id: string | null;
  invoice_number: string;
  invoice_date: string;
  customer_name: string | null;
  customer_phone: string | null;
  payment_method: string;
  payment_status: string;
  status: string;
  subtotal: number;
  tax_total: number;
  discount: number;
  round_off: number;
  total: number;
  amount_paid: number;
  change_due: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SaleItem {
  id: string;
  shop_id: string;
  sale_id: string;
  product_id: string;
  quantity: number;
  unit_cost: number | null;
  unit_price: number;
  tax_rate: number;
  discount: number;
  line_total: number;
  created_at: string;
  product?: {
    id: string;
    name: string;
    unit: string;
    sku: string | null;
  } | null;
}

export interface Supplier {
  id: string;
  shop_id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  address: string | null;
  is_active: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Purchase {
  id: string;
  shop_id: string;
  supplier_id: string | null;
  invoice_number: string | null;
  invoice_date: string;
  payment_status: string;
  subtotal: number;
  tax_total: number;
  discount: number;
  other_charges: number;
  total: number;
  amount_paid: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  supplier?: {
    id: string;
    name: string;
  } | null;
}

export interface PurchaseItem {
  id: string;
  shop_id: string;
  purchase_id: string;
  product_id: string;
  quantity: number;
  unit_cost: number;
  tax_rate: number;
  discount: number;
  line_total: number;
  created_at: string;
  product?: {
    id: string;
    name: string;
    unit: string;
    sku: string | null;
  } | null;
}

export interface Counter {
  id: string;
  current_value: number;
}
