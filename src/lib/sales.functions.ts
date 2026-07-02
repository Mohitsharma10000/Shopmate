import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAppwriteAuth } from "@/integrations/appwrite/auth-middleware";
import { APPWRITE_DATABASE_ID } from "@/integrations/appwrite/client.server";
import { Query, ID } from "node-appwrite";
import {
  mapDocument,
  mapDocuments,
  ensureMember,
  withLock,
  applyStockMovement,
  applyCustomerLedger,
  sanitizeError,
} from "@/integrations/appwrite/helpers.server";

const itemSchema = z.object({
  product_id: z.string(),
  quantity: z.number().positive(),
  unit_price: z.number().min(0),
  tax_rate: z.number().min(0).default(0),
  discount: z.number().min(0).default(0),
});

const saleSchema = z.object({
  shop_id: z.string(),
  customer_id: z.string().optional().nullable(),
  customer_name: z.string().trim().max(120).optional().nullable(),
  customer_phone: z.string().trim().max(40).optional().nullable(),
  discount: z.number().min(0).default(0),
  round_off: z.number().default(0),
  amount_paid: z.number().min(0).default(0),
  payment_method: z.enum(["cash", "card", "upi", "credit", "split"]).default("cash"),
  notes: z.string().trim().max(500).optional().nullable(),
  items: z.array(itemSchema).min(1),
});

export const lookupProductByCode = createServerFn({ method: "GET" })
  .middleware([requireAppwriteAuth])
  .inputValidator((d: unknown) =>
    z.object({ shop_id: z.string(), code: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureMember(context.databases, context.userId, data.shop_id);
    const response = await context.databases.listDocuments(
      APPWRITE_DATABASE_ID,
      "products",
      [
        Query.equal("shop_id", data.shop_id),
        Query.equal("is_active", true),
        Query.or([
          Query.equal("barcode", data.code),
          Query.equal("sku", data.code),
        ]),
        Query.limit(1),
      ]
    );
    return mapDocument(response.documents[0]) || null;
  });

export const createSale = createServerFn({ method: "POST" })
  .middleware([requireAppwriteAuth])
  .inputValidator((d: unknown) => saleSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureMember(context.databases, context.userId, data.shop_id);

    let subtotal = 0;
    let taxTotal = 0;
    const lines = data.items.map((it) => {
      const gross = it.quantity * it.unit_price - (it.discount || 0);
      const tax = (gross * (it.tax_rate || 0)) / 100;
      subtotal += gross;
      taxTotal += tax;
      return { ...it, line_total: gross + tax };
    });
    const total = subtotal + taxTotal - (data.discount || 0) + (data.round_off || 0);
    const paid = data.amount_paid || 0;
    const change_due = Math.max(0, paid - total);
    const payment_status = paid >= total ? "paid" : paid > 0 ? "partial" : "unpaid";

    // 1. Generate invoice number atomically using a promise lock and a counter document
    const invoiceNumber = await withLock(data.shop_id, async () => {
      let currentVal = 0;
      try {
        const counterDoc = await context.databases.getDocument(
          APPWRITE_DATABASE_ID,
          "counters",
          data.shop_id
        );
        currentVal = Number(counterDoc.current_value || 0);
      } catch (err: any) {
        if (err.code !== 404) throw err;
        await context.databases.createDocument(
          APPWRITE_DATABASE_ID,
          "counters",
          data.shop_id,
          { current_value: 0 }
        );
      }
      
      const newVal = currentVal + 1;
      await context.databases.updateDocument(
        APPWRITE_DATABASE_ID,
        "counters",
        data.shop_id,
        { current_value: newVal }
      );
      return 'INV-' + String(newVal).padStart(6, '0');
    });

    const saleId = ID.unique();

    // 2. Create the Sale document
    const saleDoc = await context.databases.createDocument(
      APPWRITE_DATABASE_ID,
      "sales",
      saleId,
      {
        shop_id: data.shop_id,
        invoice_number: invoiceNumber,
        invoice_date: new Date().toISOString(),
        customer_id: data.customer_id || null,
        customer_name: data.customer_name || null,
        customer_phone: data.customer_phone || null,
        subtotal,
        tax_total: taxTotal,
        discount: data.discount || 0,
        round_off: data.round_off || 0,
        total,
        amount_paid: paid,
        change_due,
        payment_method: data.payment_method,
        payment_status,
        notes: data.notes || null,
        status: "completed",
        created_by: context.userId,
      }
    );

    // 3. Fetch product details to get cost price snapshot
    const productIds = lines.map((l) => l.product_id);
    const productsRes = await context.databases.listDocuments(
      APPWRITE_DATABASE_ID,
      "products",
      [
        Query.equal("$id", productIds),
        Query.limit(100),
      ]
    );
    const productsMap = new Map(productsRes.documents.map((p) => [p.$id, p]));

    try {
      // 4. Create Sale Items and log stock movements
      for (const l of lines) {
        const product = productsMap.get(l.product_id);
        const unit_cost = product ? Number(product.cost_price || 0) : 0;
        
        await context.databases.createDocument(
          APPWRITE_DATABASE_ID,
          "sale_items",
          ID.unique(),
          {
            sale_id: saleId,
            shop_id: data.shop_id,
            product_id: l.product_id,
            quantity: l.quantity,
            unit_price: l.unit_price,
            unit_cost,
            tax_rate: l.tax_rate || 0,
            discount: l.discount || 0,
            line_total: l.line_total,
          }
        );

        // Apply stock movement
        await applyStockMovement(context.databases, {
          shop_id: data.shop_id,
          product_id: l.product_id,
          type: "sale",
          quantity: l.quantity,
          unit_cost: l.unit_price,
          reference: invoiceNumber,
          note: "POS sale",
          created_by: context.userId,
        });
      }

      // 5. Link sale to customer + auto-add credit ledger (replicates sale_record_credit trigger)
      const due = total - paid;
      if (data.customer_id && due > 0) {
        await applyCustomerLedger(context.databases, {
          shop_id: data.shop_id,
          customer_id: data.customer_id,
          type: "credit_sale",
          amount: due,
          sale_id: saleId,
          reference: invoiceNumber,
          note: "Credit on invoice",
          created_by: context.userId,
        });
      }
    } catch (err: any) {
      // Clean up parent sale document on failure
      await context.databases.deleteDocument(
        APPWRITE_DATABASE_ID,
        "sales",
        saleId
      );
      throw sanitizeError(err);
    }

    return mapDocument(saleDoc);
  });

export const listSales = createServerFn({ method: "GET" })
  .middleware([requireAppwriteAuth])
  .inputValidator((d: unknown) =>
    z.object({ shop_id: z.string(), limit: z.number().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureMember(context.databases, context.userId, data.shop_id);
    const response = await context.databases.listDocuments(
      APPWRITE_DATABASE_ID,
      "sales",
      [
        Query.equal("shop_id", data.shop_id),
        Query.orderDesc("invoice_date"),
        Query.limit(data.limit ?? 100),
      ]
    );
    return mapDocuments(response.documents);
  });

export const getSale = createServerFn({ method: "GET" })
  .middleware([requireAppwriteAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string(), shop_id: z.string() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureMember(context.databases, context.userId, data.shop_id);
    const header = await context.databases.getDocument(
      APPWRITE_DATABASE_ID,
      "sales",
      data.id
    );

    // Cross-tenant verification
    if (header.shop_id !== data.shop_id) {
      throw new Error("Access Denied: Record does not belong to this shop.");
    }

    const itemsResponse = await context.databases.listDocuments(
      APPWRITE_DATABASE_ID,
      "sale_items",
      [
        Query.equal("sale_id", data.id),
        Query.limit(100),
      ]
    );
    const items = mapDocuments(itemsResponse.documents);

    // Fetch product details to map names
    const productIds = [...new Set(items.map((it: any) => it.product_id))].filter(Boolean) as string[];
    const productMap = new Map<string, any>();
    if (productIds.length > 0) {
      for (let i = 0; i < productIds.length; i += 100) {
        const batch = productIds.slice(i, i + 100);
        const prodRes = await context.databases.listDocuments(
          APPWRITE_DATABASE_ID,
          "products",
          [Query.equal("$id", batch), Query.limit(100)]
        );
        for (const p of prodRes.documents) {
          productMap.set(p.$id, p);
        }
      }
    }

    const itemsWithProducts = items.map((it: any) => {
      const prod = productMap.get(it.product_id);
      return {
        ...it,
        name: prod?.name || "Unknown Product",
        product: prod ? mapDocument(prod) : null,
      };
    });

    return { ...mapDocument(header), items: itemsWithProducts };
  });

export const salesSummary = createServerFn({ method: "GET" })
  .middleware([requireAppwriteAuth])
  .inputValidator((d: unknown) => z.object({ shop_id: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureMember(context.databases, context.userId, data.shop_id);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const response = await context.databases.listDocuments(
      APPWRITE_DATABASE_ID,
      "sales",
      [
        Query.equal("shop_id", data.shop_id),
        Query.equal("status", "completed"),
        Query.limit(1000),
      ]
    );
    const all = mapDocuments(response.documents);
    const todays = all.filter((r: any) => new Date(r.invoice_date) >= today);
    const sum = (xs: any[]) => xs.reduce((a, b) => a + Number(b.total || 0), 0);
    
    return {
      today_count: todays.length,
      today_value: sum(todays),
      total_count: all.length,
      total_value: sum(all),
    };
  });
