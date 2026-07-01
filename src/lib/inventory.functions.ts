import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAppwriteAuth } from "@/integrations/appwrite/auth-middleware";
import { APPWRITE_DATABASE_ID } from "@/integrations/appwrite/client.server";
import { Query, ID } from "node-appwrite";
import {
  mapDocument,
  mapDocuments,
  ensureMember,
  applyStockMovement,
} from "@/integrations/appwrite/helpers.server";

// ---------- helpers ----------
function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// ---------- Categories ----------
const categorySchema = z.object({
  shop_id: z.string(),
  name: z.string().trim().min(1).max(80),
  color: z.string().trim().max(20).optional().nullable(),
  parent_id: z.string().optional().nullable(),
});

export const listCategories = createServerFn({ method: "GET" })
  .middleware([requireAppwriteAuth])
  .inputValidator((d: unknown) => z.object({ shop_id: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureMember(context.databases, context.userId, data.shop_id);
    const response = await context.databases.listDocuments(
      APPWRITE_DATABASE_ID,
      "categories",
      [
        Query.equal("shop_id", data.shop_id),
        Query.orderAsc("sort_order"),
        Query.orderAsc("name"),
        Query.limit(500),
      ]
    );
    return mapDocuments(response.documents);
  });

export const createCategory = createServerFn({ method: "POST" })
  .middleware([requireAppwriteAuth])
  .inputValidator((d: unknown) => categorySchema.parse(d))
  .handler(async ({ data, context }) => {
    const baseSlug = slugify(data.name) || "category";
    let slug = baseSlug;
    let i = 1;
    while (true) {
      const clashResponse = await context.databases.listDocuments(
        APPWRITE_DATABASE_ID,
        "categories",
        [
          Query.equal("shop_id", data.shop_id),
          Query.equal("slug", slug),
          Query.limit(1),
        ]
      );
      if (clashResponse.documents.length === 0) break;
      i += 1;
      slug = `${baseSlug}-${i}`;
    }

    const doc = await context.databases.createDocument(
      APPWRITE_DATABASE_ID,
      "categories",
      ID.unique(),
      {
        shop_id: data.shop_id,
        name: data.name,
        slug,
        color: data.color ?? null,
        parent_id: data.parent_id ?? null,
        sort_order: 0,
      }
    );
    return mapDocument(doc);
  });

export const deleteCategory = createServerFn({ method: "POST" })
  .middleware([requireAppwriteAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await context.databases.deleteDocument(
      APPWRITE_DATABASE_ID,
      "categories",
      data.id
    );
    return { ok: true };
  });

// ---------- Products ----------
const productSchema = z.object({
  shop_id: z.string(),
  category_id: z.string().optional().nullable(),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).optional().nullable(),
  sku: z.string().trim().max(60).optional().nullable(),
  barcode: z.string().trim().max(60).optional().nullable(),
  unit: z.string().trim().min(1).max(20).default("pcs"),
  mrp: z.coerce.number().min(0).default(0),
  sale_price: z.coerce.number().min(0).default(0),
  cost_price: z.coerce.number().min(0).default(0),
  tax_rate: z.coerce.number().min(0).max(100).default(0),
  hsn_code: z.string().trim().max(20).optional().nullable(),
  image_url: z.string().trim().max(500).optional().nullable(),
  track_stock: z.boolean().default(true),
  reorder_level: z.coerce.number().min(0).default(0),
  is_active: z.boolean().default(true),
  opening_stock: z.coerce.number().min(0).default(0).optional(),
});

const productListSchema = z.object({
  shop_id: z.string(),
  search: z.string().trim().optional().nullable(),
  category_id: z.string().optional().nullable(),
  only_low: z.boolean().optional().default(false),
  limit: z.number().int().positive().max(500).default(200),
});

export const listProducts = createServerFn({ method: "GET" })
  .middleware([requireAppwriteAuth])
  .inputValidator((d: unknown) => productListSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureMember(context.databases, context.userId, data.shop_id);
    const queries = [
      Query.equal("shop_id", data.shop_id),
      Query.orderDesc("$createdAt"),
      Query.limit(data.limit),
    ];

    if (data.category_id) {
      queries.push(Query.equal("category_id", data.category_id));
    }

    if (data.search) {
      const s = data.search.replace(/[%_]/g, "");
      queries.push(
        Query.or([
          Query.contains("name", s),
          Query.contains("sku", s),
          Query.contains("barcode", s),
        ])
      );
    }

    const response = await context.databases.listDocuments(
      APPWRITE_DATABASE_ID,
      "products",
      queries
    );

    let result = mapDocuments(response.documents);
    if (data.only_low) {
      result = result.filter(
        (p: any) => p.track_stock && Number(p.stock_qty) <= Number(p.reorder_level)
      );
    }
    return result;
  });

export const getProduct = createServerFn({ method: "GET" })
  .middleware([requireAppwriteAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const doc = await context.databases.getDocument(
      APPWRITE_DATABASE_ID,
      "products",
      data.id
    );
    return mapDocument(doc);
  });

export const createProduct = createServerFn({ method: "POST" })
  .middleware([requireAppwriteAuth])
  .inputValidator((d: unknown) => productSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { opening_stock, ...fields } = data;
    const productId = ID.unique();
    const payload = {
      ...fields,
      created_by: context.userId,
      sku: fields.sku || null,
      barcode: fields.barcode || null,
      hsn_code: fields.hsn_code || null,
      image_url: fields.image_url || null,
      description: fields.description || null,
      category_id: fields.category_id || null,
      stock_qty: opening_stock || 0,
    };

    const doc = await context.databases.createDocument(
      APPWRITE_DATABASE_ID,
      "products",
      productId,
      payload
    );

    if (opening_stock && opening_stock > 0) {
      await context.databases.createDocument(
        APPWRITE_DATABASE_ID,
        "stock_movements",
        ID.unique(),
        {
          shop_id: data.shop_id,
          product_id: productId,
          type: "opening",
          quantity: opening_stock,
          note: "Opening stock",
          created_by: context.userId,
        }
      );
    }
    return { id: doc.$id };
  });

export const updateProduct = createServerFn({ method: "POST" })
  .middleware([requireAppwriteAuth])
  .inputValidator((d: unknown) =>
    productSchema.partial().extend({ id: z.string() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { id, opening_stock: _ignore, shop_id: _s, ...rest } = data;
    const update = { ...rest } as Record<string, unknown>;
    if ("sku" in update) update.sku = update.sku || null;
    if ("barcode" in update) update.barcode = update.barcode || null;
    if ("hsn_code" in update) update.hsn_code = update.hsn_code || null;
    if ("image_url" in update) update.image_url = update.image_url || null;
    if ("category_id" in update) update.category_id = update.category_id || null;

    await context.databases.updateDocument(
      APPWRITE_DATABASE_ID,
      "products",
      id,
      update
    );
    return { ok: true };
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireAppwriteAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await context.databases.deleteDocument(
      APPWRITE_DATABASE_ID,
      "products",
      data.id
    );
    return { ok: true };
  });

// ---------- Stock movements ----------
const stockAdjustSchema = z.object({
  shop_id: z.string(),
  product_id: z.string(),
  type: z.enum(["purchase", "adjustment", "wastage", "return_in", "return_out", "opening"]),
  quantity: z.coerce.number(),
  unit_cost: z.coerce.number().min(0).optional().nullable(),
  note: z.string().trim().max(300).optional().nullable(),
});

export const adjustStock = createServerFn({ method: "POST" })
  .middleware([requireAppwriteAuth])
  .inputValidator((d: unknown) => stockAdjustSchema.parse(d))
  .handler(async ({ data, context }) => {
    if (data.quantity === 0) throw new Error("Quantity cannot be zero");
    
    // We use the helper applyStockMovement which updates both stock_movements and products.stock_qty
    await applyStockMovement(context.databases, {
      shop_id: data.shop_id,
      product_id: data.product_id,
      type: data.type,
      quantity: Math.abs(data.quantity), // quantity to log is absolute, delta is derived by type
      unit_cost: data.unit_cost ?? null,
      note: data.note ?? null,
      created_by: context.userId,
    });
    
    return { ok: true };
  });

export const listStockMovements = createServerFn({ method: "GET" })
  .middleware([requireAppwriteAuth])
  .inputValidator((d: unknown) =>
    z.object({ product_id: z.string(), limit: z.number().int().positive().max(100).default(30) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const response = await context.databases.listDocuments(
      APPWRITE_DATABASE_ID,
      "stock_movements",
      [
        Query.equal("product_id", data.product_id),
        Query.orderDesc("$createdAt"),
        Query.limit(data.limit),
      ]
    );
    return mapDocuments(response.documents);
  });

// ---------- Inventory summary ----------
export const inventorySummary = createServerFn({ method: "GET" })
  .middleware([requireAppwriteAuth])
  .inputValidator((d: unknown) => z.object({ shop_id: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureMember(context.databases, context.userId, data.shop_id);
    
    // Fetch all products using the listAllDocuments helper to aggregate in memory
    const docs = await context.databases.listDocuments(
      APPWRITE_DATABASE_ID,
      "products",
      [
        Query.equal("shop_id", data.shop_id),
        Query.limit(2000), // Fetch up to 2000 items
      ]
    );
    const list = mapDocuments(docs.documents);

    let totalSkus = 0;
    let activeSkus = 0;
    let inventoryCost = 0;
    let inventoryRetail = 0;
    let lowStock = 0;
    let outOfStock = 0;

    for (const p of list) {
      totalSkus += 1;
      if (p.is_active) activeSkus += 1;
      const qty = Number(p.stock_qty) || 0;
      inventoryCost += qty * (Number(p.cost_price) || 0);
      inventoryRetail += qty * (Number(p.sale_price) || 0);
      if (p.track_stock) {
        if (qty <= 0) outOfStock += 1;
        else if (qty <= Number(p.reorder_level)) lowStock += 1;
      }
    }
    return { totalSkus, activeSkus, inventoryCost, inventoryRetail, lowStock, outOfStock };
  });
