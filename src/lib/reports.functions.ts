import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAppwriteAuth } from "@/integrations/appwrite/auth-middleware";
import { APPWRITE_DATABASE_ID } from "@/integrations/appwrite/client.server";
import { Query } from "node-appwrite";
import {
  mapDocuments,
  ensureMember,
} from "@/integrations/appwrite/helpers.server";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

const rangeSchema = z.object({
  shop_id: z.string(),
  days: z.number().int().min(1).max(365).default(30),
});

export const dashboardOverview = createServerFn({ method: "GET" })
  .middleware([requireAppwriteAuth])
  .inputValidator((d: unknown) => z.object({ shop_id: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureMember(context.databases, context.userId, data.shop_id);
    const today = startOfDay(new Date());
    const yest = addDays(today, -1);
    const last7 = addDays(today, -6);
    const last30 = addDays(today, -29);

    const salesRes = await context.databases.listDocuments(
      APPWRITE_DATABASE_ID,
      "sales",
      [
        Query.equal("shop_id", data.shop_id),
        Query.equal("status", "completed"),
        Query.greaterThanEqual("invoice_date", last30.toISOString()),
        Query.limit(5000),
      ],
    );
    const sales = mapDocuments(salesRes.documents) as Array<{
      total: number | string;
      invoice_date: string;
      payment_status: string;
      amount_paid: number | string;
    }>;

    const sum = (xs: typeof sales) => xs.reduce((a, b) => a + Number(b.total || 0), 0);

    const todays = sales.filter((r) => new Date(r.invoice_date) >= today);
    const yesterdays = sales.filter((r) => {
      const d = new Date(r.invoice_date);
      return d >= yest && d < today;
    });
    const sevens = sales.filter((r) => new Date(r.invoice_date) >= last7);

    // Inventory snapshot
    const productsRes = await context.databases.listDocuments(
      APPWRITE_DATABASE_ID,
      "products",
      [
        Query.equal("shop_id", data.shop_id),
        Query.equal("is_active", true),
        Query.limit(5000),
      ],
    );
    const prods = mapDocuments(productsRes.documents) as Array<{
      stock_qty: number | string;
      cost_price: number | string;
      reorder_level: number | string | null;
      track_stock: boolean;
    }>;

    const inventoryValue = prods.reduce(
      (a, p) => a + Number(p.stock_qty || 0) * Number(p.cost_price || 0),
      0,
    );
    const lowStock = prods.filter(
      (p) =>
        p.track_stock &&
        Number(p.stock_qty || 0) <= Number(p.reorder_level || 0) &&
        Number(p.stock_qty || 0) > 0,
    ).length;
    const outOfStock = prods.filter(
      (p) => p.track_stock && Number(p.stock_qty || 0) <= 0,
    ).length;

    // Unpaid credit
    const unpaid = sales
      .filter((r) => r.payment_status !== "paid")
      .reduce(
        (a, b) => a + (Number(b.total || 0) - Number(b.amount_paid || 0)),
        0,
      );

    // 7-day series
    const series: Array<{ date: string; sales: number; orders: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = addDays(today, -i);
      const key = dayKey(d);
      const day = sales.filter((r) => dayKey(new Date(r.invoice_date)) === key);
      series.push({
        date: key,
        sales: day.reduce((a, b) => a + Number(b.total || 0), 0),
        orders: day.length,
      });
    }

    return {
      today_sales: sum(todays),
      today_orders: todays.length,
      yesterday_sales: sum(yesterdays),
      week_sales: sum(sevens),
      week_orders: sevens.length,
      month_sales: sum(sales),
      month_orders: sales.length,
      inventory_value: inventoryValue,
      low_stock: lowStock,
      out_of_stock: outOfStock,
      product_count: prods.length,
      unpaid_credit: unpaid,
      series,
    };
  });

export const salesTimeseries = createServerFn({ method: "GET" })
  .middleware([requireAppwriteAuth])
  .inputValidator((d: unknown) => rangeSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureMember(context.databases, context.userId, data.shop_id);
    const today = startOfDay(new Date());
    const start = addDays(today, -(data.days - 1));

    const salesRes = await context.databases.listDocuments(
      APPWRITE_DATABASE_ID,
      "sales",
      [
        Query.equal("shop_id", data.shop_id),
        Query.equal("status", "completed"),
        Query.greaterThanEqual("invoice_date", start.toISOString()),
        Query.limit(5000),
      ],
    );
    const sales = mapDocuments(salesRes.documents) as Array<{
      total: number | string;
      tax_total: number | string;
      discount: number | string;
      invoice_date: string;
      payment_method: string;
    }>;

    const buckets: Record<
      string,
      { date: string; sales: number; orders: number; tax: number }
    > = {};
    for (let i = data.days - 1; i >= 0; i--) {
      const d = addDays(today, -i);
      const key = dayKey(d);
      buckets[key] = { date: key, sales: 0, orders: 0, tax: 0 };
    }
    for (const s of sales) {
      const k = dayKey(new Date(s.invoice_date));
      if (!buckets[k]) continue;
      buckets[k].sales += Number(s.total || 0);
      buckets[k].orders += 1;
      buckets[k].tax += Number(s.tax_total || 0);
    }

    const payment: Record<string, number> = {};
    for (const s of sales) {
      payment[s.payment_method] = (payment[s.payment_method] || 0) + Number(s.total || 0);
    }

    return {
      series: Object.values(buckets),
      payment_breakdown: Object.entries(payment).map(([method, total]) => ({
        method,
        total,
      })),
      totals: {
        sales: sales.reduce((a, b) => a + Number(b.total || 0), 0),
        orders: sales.length,
        tax: sales.reduce((a, b) => a + Number(b.tax_total || 0), 0),
        discount: sales.reduce((a, b) => a + Number(b.discount || 0), 0),
      },
    };
  });

// Helper to fetch sale_items for a batch of sale IDs (Appwrite limits array values)
async function fetchSaleItemsForSales(databases: any, saleIds: string[]) {
  if (saleIds.length === 0) return [];
  const allItems: any[] = [];
  for (let i = 0; i < saleIds.length; i += 100) {
    const batch = saleIds.slice(i, i + 100);
    const res = await databases.listDocuments(
      APPWRITE_DATABASE_ID,
      "sale_items",
      [Query.equal("sale_id", batch), Query.limit(5000)],
    );
    allItems.push(...res.documents);
  }
  return allItems;
}

export const topProducts = createServerFn({ method: "GET" })
  .middleware([requireAppwriteAuth])
  .inputValidator((d: unknown) => rangeSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureMember(context.databases, context.userId, data.shop_id);
    const start = addDays(startOfDay(new Date()), -(data.days - 1));

    // Fetch completed sales in the window
    const salesRes = await context.databases.listDocuments(
      APPWRITE_DATABASE_ID,
      "sales",
      [
        Query.equal("shop_id", data.shop_id),
        Query.equal("status", "completed"),
        Query.greaterThanEqual("invoice_date", start.toISOString()),
        Query.limit(5000),
      ],
    );
    const saleIds = salesRes.documents.map((s: any) => s.$id);

    // Fetch sale items for those sales
    const items = await fetchSaleItemsForSales(context.databases, saleIds);

    // Fetch product info
    const productIds = [...new Set(items.map((i: any) => i.product_id))] as string[];
    const productMap = new Map<string, any>();
    if (productIds.length > 0) {
      for (let i = 0; i < productIds.length; i += 100) {
        const batch = productIds.slice(i, i + 100);
        const prodRes = await context.databases.listDocuments(
          APPWRITE_DATABASE_ID,
          "products",
          [Query.equal("$id", batch), Query.limit(100)],
        );
        for (const p of prodRes.documents) {
          productMap.set(p.$id, { id: p.$id, name: p.name, unit: p.unit });
        }
      }
    }

    const agg = new Map<
      string,
      { id: string; name: string; unit: string; qty: number; revenue: number }
    >();
    for (const r of items) {
      const prod = productMap.get(r.product_id);
      if (!prod) continue;
      const ex = agg.get(r.product_id) ?? {
        id: prod.id,
        name: prod.name,
        unit: prod.unit,
        qty: 0,
        revenue: 0,
      };
      ex.qty += Number(r.quantity || 0);
      ex.revenue += Number(r.line_total || 0);
      agg.set(r.product_id, ex);
    }

    return Array.from(agg.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  });

export const lowStockReport = createServerFn({ method: "GET" })
  .middleware([requireAppwriteAuth])
  .inputValidator((d: unknown) => z.object({ shop_id: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureMember(context.databases, context.userId, data.shop_id);
    const response = await context.databases.listDocuments(
      APPWRITE_DATABASE_ID,
      "products",
      [
        Query.equal("shop_id", data.shop_id),
        Query.equal("is_active", true),
        Query.equal("track_stock", true),
        Query.orderAsc("stock_qty"),
        Query.limit(50),
      ],
    );
    const rows = mapDocuments(response.documents);
    return rows.filter(
      (p: any) => Number(p.stock_qty) <= Number(p.reorder_level || 0),
    );
  });

export const todaysSoldProducts = createServerFn({ method: "GET" })
  .middleware([requireAppwriteAuth])
  .inputValidator((d: unknown) => z.object({ shop_id: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureMember(context.databases, context.userId, data.shop_id);
    const today = startOfDay(new Date());

    const salesRes = await context.databases.listDocuments(
      APPWRITE_DATABASE_ID,
      "sales",
      [
        Query.equal("shop_id", data.shop_id),
        Query.equal("status", "completed"),
        Query.greaterThanEqual("invoice_date", today.toISOString()),
        Query.limit(1000),
      ],
    );
    const saleIds = salesRes.documents.map((s: any) => s.$id);
    const items = await fetchSaleItemsForSales(context.databases, saleIds);

    const productIds = [...new Set(items.map((i: any) => i.product_id))] as string[];
    const productMap = new Map<string, any>();
    if (productIds.length > 0) {
      for (let i = 0; i < productIds.length; i += 100) {
        const batch = productIds.slice(i, i + 100);
        const prodRes = await context.databases.listDocuments(
          APPWRITE_DATABASE_ID,
          "products",
          [Query.equal("$id", batch), Query.limit(100)],
        );
        for (const p of prodRes.documents) {
          productMap.set(p.$id, { id: p.$id, name: p.name, unit: p.unit });
        }
      }
    }

    const agg = new Map<
      string,
      { id: string; name: string; unit: string; qty: number; revenue: number }
    >();
    for (const r of items) {
      const prod = productMap.get(r.product_id);
      const name = prod?.name || "Unknown Product";
      const unit = prod?.unit || "pcs";
      const ex = agg.get(r.product_id) ?? {
        id: r.product_id,
        name,
        unit,
        qty: 0,
        revenue: 0,
      };
      ex.qty += Number(r.quantity || 0);
      ex.revenue += Number(r.line_total || 0);
      agg.set(r.product_id, ex);
    }

    return Array.from(agg.values()).sort((a, b) => b.qty - a.qty);
  });

