import { Query, ID } from 'node-appwrite';
import { APPWRITE_DATABASE_ID } from './client.server';

// Maps Appwrite system attributes ($id, $createdAt, $updatedAt) to standard database names
export function mapDocument<T = any>(doc: any): T {
  if (!doc) return doc;
  const { $id, $createdAt, $updatedAt, ...rest } = doc;
  
  const mapped: any = {
    id: $id,
    created_at: $createdAt,
    updated_at: $updatedAt,
  };
  
  for (const [key, value] of Object.entries(rest)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if ('$id' in value) {
        mapped[key] = mapDocument(value);
      } else {
        mapped[key] = value;
      }
    } else if (Array.isArray(value)) {
      mapped[key] = value.map(item => (item && typeof item === 'object' && '$id' in item) ? mapDocument(item) : item);
    } else {
      mapped[key] = value;
    }
  }

  return mapped as T;
}

// Maps an array of Appwrite documents
export function mapDocuments<T = any>(docs: any[]): T[] {
  return (docs ?? []).map(doc => mapDocument<T>(doc));
}

// Fetches all matching documents by automatically handling cursor-based pagination
export async function listAllDocuments(
  databases: any,
  collectionId: string,
  queries: string[] = []
): Promise<any[]> {
  let allDocs: any[] = [];
  let lastId: string | null = null;
  const limit = 100;
  
  while (true) {
    const currentQueries = [...queries, Query.limit(limit)];
    if (lastId) {
      currentQueries.push(Query.cursorAfter(lastId));
    }
    const response = await databases.listDocuments(APPWRITE_DATABASE_ID, collectionId, currentQueries);
    allDocs = allDocs.concat(response.documents);
    
    if (response.documents.length < limit) {
      break;
    }
    lastId = response.documents[response.documents.length - 1].$id;
  }
  
  return allDocs;
}

// Enforces that a user is an active member of a specific shop
export async function ensureMember(databases: any, userId: string, shopId: string) {
  const response = await databases.listDocuments(
    APPWRITE_DATABASE_ID,
    'shop_members',
    [
      Query.equal('user_id', userId),
      Query.equal('shop_id', shopId),
      Query.equal('status', 'active')
    ]
  );
  
  if (response.documents.length === 0) {
    throw new Error('Not a member of this shop');
  }
  
  return response.documents[0].role as 'owner' | 'manager' | 'cashier' | 'staff';
}

// Replicates the PostgreSQL trigger apply_stock_movement and purchase_item/sale_item stock tracking
export async function applyStockMovement(
  databases: any,
  params: {
    shop_id: string;
    product_id: string;
    type: 'purchase' | 'sale' | 'adjustment' | 'return_in' | 'return_out' | 'opening' | 'transfer' | 'wastage';
    quantity: number;
    unit_cost?: number | null;
    reference?: string | null;
    note?: string | null;
    created_by: string | null;
  }
) {
  // 1. Get current product configuration
  const product = await databases.getDocument(
    APPWRITE_DATABASE_ID,
    'products',
    params.product_id
  );

  // 2. Create the stock movement document
  const movement = await databases.createDocument(
    APPWRITE_DATABASE_ID,
    'stock_movements',
    ID.unique(),
    {
      shop_id: params.shop_id,
      product_id: params.product_id,
      type: params.type,
      quantity: params.quantity,
      unit_cost: params.unit_cost ?? null,
      reference: params.reference ?? null,
      note: params.note ?? null,
      created_by: params.created_by,
    }
  );

  // 3. Update stock levels if tracked
  if (product.track_stock) {
    let delta = params.quantity;
    if (['sale', 'return_out', 'wastage', 'transfer'].includes(params.type)) {
      delta = -params.quantity;
    }

    const currentStock = Number(product.stock_qty || 0);
    const newStock = currentStock + delta;

    await databases.updateDocument(
      APPWRITE_DATABASE_ID,
      'products',
      params.product_id,
      {
        stock_qty: newStock,
      }
    );
  }

  // 4. Update product cost price if this is a purchase
  if (params.type === 'purchase' && params.unit_cost && params.unit_cost > 0) {
    await databases.updateDocument(
      APPWRITE_DATABASE_ID,
      'products',
      params.product_id,
      {
        cost_price: params.unit_cost,
      }
    );
  }

  return movement;
}

// Replicates the PostgreSQL trigger apply_customer_ledger
export async function applyCustomerLedger(
  databases: any,
  params: {
    shop_id: string;
    customer_id: string;
    type: 'credit_sale' | 'opening' | 'adjustment' | 'payment';
    amount: number;
    sale_id?: string | null;
    reference?: string | null;
    note?: string | null;
    created_by: string | null;
  }
) {
  // 1. Create the ledger entry document
  const ledgerEntry = await databases.createDocument(
    APPWRITE_DATABASE_ID,
    'customer_ledger',
    ID.unique(),
    {
      shop_id: params.shop_id,
      customer_id: params.customer_id,
      type: params.type,
      amount: params.amount,
      sale_id: params.sale_id ?? null,
      reference: params.reference ?? null,
      note: params.note ?? null,
      created_by: params.created_by,
    }
  );

  // 2. Calculate balance delta
  let delta = params.amount;
  if (params.type === 'payment') {
    delta = -params.amount;
  }

  // 3. Fetch customer and update balance
  const customer = await databases.getDocument(
    APPWRITE_DATABASE_ID,
    'customers',
    params.customer_id
  );

  const currentBalance = Number(customer.balance || 0);
  const newBalance = currentBalance + delta;

  await databases.updateDocument(
    APPWRITE_DATABASE_ID,
    'customers',
    params.customer_id,
    {
      balance: newBalance,
    }
  );

  return ledgerEntry;
}

// Serializes execution per key (e.g. shop_id) to guarantee atomicity (such as invoice number generation)
const locks: Record<string, Promise<any>> = {};

export async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = locks[key] || Promise.resolve();
  const next = (async () => {
    try {
      await previous;
    } catch {}
    return fn();
  })();
  locks[key] = next;
  
  next.finally(() => {
    if (locks[key] === next) {
      delete locks[key];
    }
  });
  
  return next;
}

export function sanitizeError(err: any): Error {
  console.error("[Backend Error Logs]:", err);
  const msg = err instanceof Error ? err.message : String(err);
  
  // Keep user-friendly authorization/validation messages
  if (
    msg.includes("Unauthorized") || 
    msg.includes("Access Denied") || 
    msg.includes("Not a member") ||
    msg.includes("Only the") ||
    msg.includes("Only shop") ||
    msg.includes("Target user") ||
    msg.includes("Incorrect password")
  ) {
    return new Error(msg);
  }
  
  return new Error("An internal server error occurred. Please try again later.");
}
