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
  sanitizeError,
} from "@/integrations/appwrite/helpers.server";

function ensureManager(role: string) {
  if (role !== "owner" && role !== "manager") throw new Error("Insufficient permissions");
}

// ---------- Suppliers ----------
const supplierSchema = z.object({
  shop_id: z.string(),
  name: z.string().trim().min(1).max(120),
  contact_person: z.string().trim().max(120).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().email().max(160).optional().nullable().or(z.literal("")),
  address: z.string().trim().max(500).optional().nullable(),
  gstin: z.string().trim().max(40).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  is_active: z.boolean().optional(),
});

export const listSuppliers = createServerFn({ method: "GET" })
  .middleware([requireAppwriteAuth])
  .inputValidator((d: unknown) =>
    z.object({ shop_id: z.string(), search: z.string().nullable().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureMember(context.databases, context.userId, data.shop_id);
    const queries: any[] = [
      Query.equal("shop_id", data.shop_id),
      Query.orderAsc("name"),
      Query.limit(500),
    ];
    if (data.search) {
      queries.push(Query.search("name", data.search));
    }
    const response = await context.databases.listDocuments(
      APPWRITE_DATABASE_ID,
      "suppliers",
      queries,
    );
    return mapDocuments(response.documents);
  });

export const createSupplier = createServerFn({ method: "POST" })
  .middleware([requireAppwriteAuth])
  .inputValidator((d: unknown) => supplierSchema.parse(d))
  .handler(async ({ data, context }) => {
    const role = await ensureMember(context.databases, context.userId, data.shop_id);
    ensureManager(role);
    const doc = await context.databases.createDocument(
      APPWRITE_DATABASE_ID,
      "suppliers",
      ID.unique(),
      {
        shop_id: data.shop_id,
        name: data.name,
        contact_person: data.contact_person || null,
        phone: data.phone || null,
        email: data.email || null,
        address: data.address || null,
        gstin: data.gstin || null,
        notes: data.notes || null,
        is_active: data.is_active ?? true,
        created_by: context.userId,
      },
    );
    return mapDocument(doc);
  });

export const updateSupplier = createServerFn({ method: "POST" })
  .middleware([requireAppwriteAuth])
  .inputValidator((d: unknown) =>
    supplierSchema.extend({ id: z.string() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const role = await ensureMember(context.databases, context.userId, data.shop_id);
    ensureManager(role);
    const { id, shop_id, ...rest } = data;
    const doc = await context.databases.updateDocument(
      APPWRITE_DATABASE_ID,
      "suppliers",
      id,
      { ...rest, email: rest.email || null },
    );
    return mapDocument(doc);
  });

export const deleteSupplier = createServerFn({ method: "POST" })
  .middleware([requireAppwriteAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string(), shop_id: z.string() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const role = await ensureMember(context.databases, context.userId, data.shop_id);
    ensureManager(role);
    await context.databases.deleteDocument(APPWRITE_DATABASE_ID, "suppliers", data.id);
    return { ok: true };
  });

// ---------- Purchases ----------
const purchaseItemSchema = z.object({
  product_id: z.string(),
  quantity: z.number().positive(),
  unit_cost: z.number().min(0),
  tax_rate: z.number().min(0).default(0),
  discount: z.number().min(0).default(0),
});

const purchaseSchema = z.object({
  shop_id: z.string(),
  supplier_id: z.string().nullable().optional(),
  invoice_number: z.string().trim().max(80).optional().nullable(),
  invoice_date: z.string().min(1),
  other_charges: z.number().min(0).default(0),
  discount: z.number().min(0).default(0),
  amount_paid: z.number().min(0).default(0),
  payment_status: z.enum(["unpaid", "partial", "paid"]).default("unpaid"),
  notes: z.string().trim().max(500).optional().nullable(),
  items: z.array(purchaseItemSchema).min(1),
});

export const listPurchases = createServerFn({ method: "GET" })
  .middleware([requireAppwriteAuth])
  .inputValidator((d: unknown) => z.object({ shop_id: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureMember(context.databases, context.userId, data.shop_id);
    const response = await context.databases.listDocuments(
      APPWRITE_DATABASE_ID,
      "purchases",
      [
        Query.equal("shop_id", data.shop_id),
        Query.orderDesc("invoice_date"),
        Query.limit(200),
      ],
    );
    const purchases = mapDocuments(response.documents);

    // Attach supplier info via in-memory join
    const supplierIds = [
      ...new Set(
        purchases
          .map((p: any) => p.supplier_id)
          .filter(Boolean),
      ),
    ] as string[];

    let supplierMap = new Map<string, { id: string; name: string }>();
    if (supplierIds.length > 0) {
      const supRes = await context.databases.listDocuments(
        APPWRITE_DATABASE_ID,
        "suppliers",
        [Query.equal("$id", supplierIds), Query.limit(100)],
      );
      for (const s of supRes.documents) {
        supplierMap.set(s.$id, { id: s.$id, name: s.name });
      }
    }

    return purchases.map((p: any) => ({
      ...p,
      supplier: p.supplier_id ? supplierMap.get(p.supplier_id) || null : null,
    }));
  });

export const getPurchase = createServerFn({ method: "GET" })
  .middleware([requireAppwriteAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string(), shop_id: z.string() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureMember(context.databases, context.userId, data.shop_id);
    const header = await context.databases.getDocument(
      APPWRITE_DATABASE_ID,
      "purchases",
      data.id,
    );

    // Cross-tenant verification
    if (header.shop_id !== data.shop_id) {
      throw new Error("Access Denied: Record does not belong to this shop.");
    }

    // Attach supplier
    let supplier = null;
    if (header.supplier_id) {
      try {
        const s = await context.databases.getDocument(
          APPWRITE_DATABASE_ID,
          "suppliers",
          header.supplier_id,
        );
        supplier = { id: s.$id, name: s.name };
      } catch {}
    }

    // Fetch items
    const itemsRes = await context.databases.listDocuments(
      APPWRITE_DATABASE_ID,
      "purchase_items",
      [Query.equal("purchase_id", data.id), Query.limit(100)],
    );

    // Attach product info to items
    const productIds = [
      ...new Set(itemsRes.documents.map((i: any) => i.product_id)),
    ] as string[];
    let productMap = new Map<string, any>();
    if (productIds.length > 0) {
      const prodRes = await context.databases.listDocuments(
        APPWRITE_DATABASE_ID,
        "products",
        [Query.equal("$id", productIds), Query.limit(100)],
      );
      for (const p of prodRes.documents) {
        productMap.set(p.$id, { id: p.$id, name: p.name, unit: p.unit, sku: p.sku });
      }
    }

    const items = itemsRes.documents.map((i: any) => ({
      ...mapDocument(i),
      product: productMap.get(i.product_id) || null,
    }));

    return { ...mapDocument(header), supplier, items };
  });

export const createPurchase = createServerFn({ method: "POST" })
  .middleware([requireAppwriteAuth])
  .inputValidator((d: unknown) => purchaseSchema.parse(d))
  .handler(async ({ data, context }) => {
    const role = await ensureMember(context.databases, context.userId, data.shop_id);
    ensureManager(role);

    let subtotal = 0;
    let taxTotal = 0;
    const lines = data.items.map((it) => {
      const gross = it.quantity * it.unit_cost - (it.discount || 0);
      const tax = (gross * (it.tax_rate || 0)) / 100;
      subtotal += gross;
      taxTotal += tax;
      return { ...it, line_total: gross + tax };
    });
    const total = subtotal + taxTotal + (data.other_charges || 0) - (data.discount || 0);

    const purchaseId = ID.unique();
    const purchaseDoc = await context.databases.createDocument(
      APPWRITE_DATABASE_ID,
      "purchases",
      purchaseId,
      {
        shop_id: data.shop_id,
        supplier_id: data.supplier_id || null,
        invoice_number: data.invoice_number || null,
        invoice_date: data.invoice_date,
        subtotal,
        tax_total: taxTotal,
        discount: data.discount || 0,
        other_charges: data.other_charges || 0,
        total,
        amount_paid: data.amount_paid || 0,
        payment_status: data.payment_status,
        notes: data.notes || null,
        created_by: context.userId,
      },
    );

    try {
      for (const l of lines) {
        await context.databases.createDocument(
          APPWRITE_DATABASE_ID,
          "purchase_items",
          ID.unique(),
          {
            purchase_id: purchaseId,
            shop_id: data.shop_id,
            product_id: l.product_id,
            quantity: l.quantity,
            unit_cost: l.unit_cost,
            tax_rate: l.tax_rate || 0,
            discount: l.discount || 0,
            line_total: l.line_total,
          },
        );

        await applyStockMovement(context.databases, {
          shop_id: data.shop_id,
          product_id: l.product_id,
          type: "purchase",
          quantity: l.quantity,
          unit_cost: l.unit_cost,
          reference: purchaseId,
          note: "Purchase",
          created_by: context.userId,
        });
      }
    } catch (err: any) {
      await context.databases.deleteDocument(APPWRITE_DATABASE_ID, "purchases", purchaseId);
      throw sanitizeError(err);
    }

    return mapDocument(purchaseDoc);
  });

export const deletePurchase = createServerFn({ method: "POST" })
  .middleware([requireAppwriteAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string(), shop_id: z.string() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const role = await ensureMember(context.databases, context.userId, data.shop_id);
    ensureManager(role);

    // Reverse stock
    const itemsRes = await context.databases.listDocuments(
      APPWRITE_DATABASE_ID,
      "purchase_items",
      [Query.equal("purchase_id", data.id), Query.limit(100)],
    );

    for (const it of itemsRes.documents) {
      await applyStockMovement(context.databases, {
        shop_id: data.shop_id,
        product_id: it.product_id,
        type: "adjustment",
        quantity: -Number(it.quantity),
        unit_cost: it.unit_cost,
        reference: data.id,
        note: "Purchase deleted — stock reversed",
        created_by: context.userId,
      });
    }

    await context.databases.deleteDocument(APPWRITE_DATABASE_ID, "purchases", data.id);
    return { ok: true };
  });

export const purchaseSummary = createServerFn({ method: "GET" })
  .middleware([requireAppwriteAuth])
  .inputValidator((d: unknown) => z.object({ shop_id: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureMember(context.databases, context.userId, data.shop_id);
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const response = await context.databases.listDocuments(
      APPWRITE_DATABASE_ID,
      "purchases",
      [Query.equal("shop_id", data.shop_id), Query.limit(5000)],
    );

    const all = mapDocuments(response.documents) as Array<{
      total: number | string;
      amount_paid: number | string;
      payment_status: string;
      invoice_date: string;
    }>;
    const last30 = all.filter((r) => new Date(r.invoice_date) >= since);
    const sum = (xs: typeof all, k: "total" | "amount_paid") =>
      xs.reduce((a, b) => a + Number(b[k] || 0), 0);

    return {
      total_purchases: all.length,
      total_value: sum(all, "total"),
      total_paid: sum(all, "amount_paid"),
      total_due: sum(all, "total") - sum(all, "amount_paid"),
      last30_value: sum(last30, "total"),
      last30_count: last30.length,
    };
  });
