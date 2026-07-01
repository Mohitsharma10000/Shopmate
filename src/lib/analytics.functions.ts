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

// Helper: fetch sale_items for a batch of sale IDs (Appwrite limits array values to 100)
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

// Helper: fetch completed sales in a date range
async function fetchCompletedSales(
  databases: any,
  shopId: string,
  since: Date,
) {
  const res = await databases.listDocuments(
    APPWRITE_DATABASE_ID,
    "sales",
    [
      Query.equal("shop_id", shopId),
      Query.equal("status", "completed"),
      Query.greaterThanEqual("invoice_date", since.toISOString()),
      Query.limit(5000),
    ],
  );
  return res.documents;
}

/**
 * Profit timeseries — uses unit_cost snapshot on sale_items.
 */
export const profitTimeseries = createServerFn({ method: "GET" })
  .middleware([requireAppwriteAuth])
  .inputValidator((d: unknown) => rangeSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureMember(context.databases, context.userId, data.shop_id);
    const today = startOfDay(new Date());
    const start = addDays(today, -(data.days - 1));

    const salesDocs = await fetchCompletedSales(context.databases, data.shop_id, start);
    const saleDateMap = new Map<string, string>();
    const saleIds: string[] = [];
    for (const s of salesDocs) {
      saleDateMap.set(s.$id, s.invoice_date);
      saleIds.push(s.$id);
    }

    const items = await fetchSaleItemsForSales(context.databases, saleIds);

    const buckets: Record<
      string,
      { date: string; revenue: number; cost: number; profit: number }
    > = {};
    for (let i = data.days - 1; i >= 0; i--) {
      const d = addDays(today, -i);
      const k = dayKey(d);
      buckets[k] = { date: k, revenue: 0, cost: 0, profit: 0 };
    }

    let totRev = 0;
    let totCost = 0;
    for (const r of items) {
      const invoiceDate = saleDateMap.get(r.sale_id);
      if (!invoiceDate) continue;
      const k = dayKey(new Date(invoiceDate));
      if (!buckets[k]) continue;
      const rev = Number(r.line_total || 0);
      const cost = Number(r.unit_cost || 0) * Number(r.quantity || 0);
      buckets[k].revenue += rev;
      buckets[k].cost += cost;
      buckets[k].profit += rev - cost;
      totRev += rev;
      totCost += cost;
    }

    return {
      series: Object.values(buckets),
      totals: {
        revenue: totRev,
        cost: totCost,
        profit: totRev - totCost,
        margin: totRev > 0 ? ((totRev - totCost) / totRev) * 100 : 0,
      },
    };
  });

/**
 * Most profitable products by margin in window.
 */
export const topProfitProducts = createServerFn({ method: "GET" })
  .middleware([requireAppwriteAuth])
  .inputValidator((d: unknown) => rangeSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureMember(context.databases, context.userId, data.shop_id);
    const start = addDays(startOfDay(new Date()), -(data.days - 1));

    const salesDocs = await fetchCompletedSales(context.databases, data.shop_id, start);
    const saleIds = salesDocs.map((s: any) => s.$id);
    const items = await fetchSaleItemsForSales(context.databases, saleIds);

    // Fetch product info
    const productIds = [...new Set(items.map((i: any) => i.product_id))] as string[];
    const productMap = new Map<string, any>();
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

    const agg = new Map<
      string,
      { id: string; name: string; unit: string; qty: number; revenue: number; cost: number; profit: number }
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
        cost: 0,
        profit: 0,
      };
      const q = Number(r.quantity || 0);
      const rev = Number(r.line_total || 0);
      const cost = Number(r.unit_cost || 0) * q;
      ex.qty += q;
      ex.revenue += rev;
      ex.cost += cost;
      ex.profit += rev - cost;
      agg.set(r.product_id, ex);
    }

    return Array.from(agg.values())
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 10);
  });

/**
 * Slow movers / dead stock — products with stock but no sales in window.
 */
export const slowMovers = createServerFn({ method: "GET" })
  .middleware([requireAppwriteAuth])
  .inputValidator((d: unknown) => rangeSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureMember(context.databases, context.userId, data.shop_id);
    const start = addDays(startOfDay(new Date()), -(data.days - 1));

    // Fetch active products with stock
    const productsRes = await context.databases.listDocuments(
      APPWRITE_DATABASE_ID,
      "products",
      [
        Query.equal("shop_id", data.shop_id),
        Query.equal("is_active", true),
        Query.equal("track_stock", true),
        Query.greaterThan("stock_qty", 0),
        Query.limit(5000),
      ],
    );
    const products = mapDocuments(productsRes.documents);

    // Fetch sold items in window
    const salesDocs = await fetchCompletedSales(context.databases, data.shop_id, start);
    const saleIds = salesDocs.map((s: any) => s.$id);
    const items = await fetchSaleItemsForSales(context.databases, saleIds);

    const sold = new Map<string, number>();
    for (const r of items) {
      sold.set(r.product_id, (sold.get(r.product_id) || 0) + Number(r.quantity || 0));
    }

    const rows = (products as any[])
      .map((p) => ({
        ...p,
        sold_qty: sold.get(p.id) || 0,
        stock_value: Number(p.stock_qty || 0) * Number(p.cost_price || 0),
      }))
      .filter((p) => p.sold_qty === 0)
      .sort((a, b) => b.stock_value - a.stock_value)
      .slice(0, 30);

    return rows;
  });

/**
 * AI Business Insights — daily summary, reorder suggestions, dead stock callouts.
 */
export const aiInsights = createServerFn({ method: "POST" })
  .middleware([requireAppwriteAuth])
  .inputValidator((d: unknown) => z.object({ shop_id: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureMember(context.databases, context.userId, data.shop_id);
    const apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey) throw new Error("AI not configured — NVIDIA_API_KEY missing from .env");

    const today = startOfDay(new Date());
    const last7 = addDays(today, -6);
    const last30 = addDays(today, -29);

    // Fetch shop info
    const shopDoc = await context.databases.getDocument(
      APPWRITE_DATABASE_ID,
      "shops",
      data.shop_id,
    );

    // Fetch sales last 7 days
    const sales7Docs = await fetchCompletedSales(context.databases, data.shop_id, last7);
    const s7 = mapDocuments(sales7Docs) as any[];

    // Fetch sale items last 30 days
    const sales30Docs = await fetchCompletedSales(context.databases, data.shop_id, last30);
    const sale30Ids = sales30Docs.map((s: any) => s.$id);
    const items30 = await fetchSaleItemsForSales(context.databases, sale30Ids);

    // Fetch products
    const productsRes = await context.databases.listDocuments(
      APPWRITE_DATABASE_ID,
      "products",
      [
        Query.equal("shop_id", data.shop_id),
        Query.equal("is_active", true),
        Query.limit(5000),
      ],
    );
    const products = productsRes.documents;

    // Short-circuit if there are no products in the inventory
    if (products.length === 0) {
      return {
        text: `## Aaj ka snapshot\nAbhi aapki inventory bilkul khali hai. AI insights shuru karne ke liye niche diye gaye steps poore karein:\n\n1. **Products add karein**: Niche **Manage inventory** button par click karke apne products aur unka stock level enter karein.\n2. **Sales/Purchases record karein**: Ek baar jab aap billing aur purchase record karenge, toh AI aapko sales trend aur top products batayega.\n3. **Stock alerts**: Low stock aur dead stock alerts automatic chalne lagenge.\n\nChalo pehla product add karte hain! 🚀`,
        context: {
          shop: shopDoc.name,
          currency: shopDoc.currency || "INR",
          today_sales: 0,
          today_orders: 0,
          week_sales: 0,
          week_orders: 0,
          unpaid_credit: 0,
          top_products_30d: [],
          reorder_suggestions: [],
          dead_stock: [],
        },
        generated_at: new Date().toISOString(),
      };
    }

    const todays = s7.filter((r) => new Date(r.invoice_date) >= today);
    const todaySales = todays.reduce((a: number, b: any) => a + Number(b.total || 0), 0);
    const weekSales = s7.reduce((a: number, b: any) => a + Number(b.total || 0), 0);
    const unpaid = s7
      .filter((r: any) => r.payment_status !== "paid")
      .reduce((a: number, b: any) => a + (Number(b.total || 0) - Number(b.amount_paid || 0)), 0);

    // top products + revenue/profit last 30d
    const agg = new Map<string, { id: string; qty: number; revenue: number; cost: number }>();
    for (const r of items30) {
      const k = r.product_id;
      const ex = agg.get(k) ?? { id: k, qty: 0, revenue: 0, cost: 0 };
      const q = Number(r.quantity || 0);
      ex.qty += q;
      ex.revenue += Number(r.line_total || 0);
      ex.cost += Number(r.unit_cost || 0) * q;
      agg.set(k, ex);
    }
    const prodMap = new Map<string, any>();
    products.forEach((p: any) => prodMap.set(p.$id, p));

    const ranked = Array.from(agg.values())
      .map((a) => ({ ...a, name: prodMap.get(a.id)?.name || "Unknown", profit: a.revenue - a.cost }))
      .sort((a, b) => b.revenue - a.revenue);
    const top = ranked.slice(0, 5).map((p) => ({ name: p.name, qty: p.qty, revenue: Math.round(p.revenue), profit: Math.round(p.profit) }));

    // low stock + reorder suggestions
    const low = (products as any[])
      .filter((p) => p.track_stock && Number(p.stock_qty) <= Number(p.reorder_level || 0))
      .map((p) => {
        const soldQty = agg.get(p.$id)?.qty || 0;
        const dailyVelocity = soldQty / 30;
        const daysOfCover = dailyVelocity > 0 ? Number(p.stock_qty) / dailyVelocity : 999;
        const suggested = Math.max(0, Math.ceil(dailyVelocity * 14 - Number(p.stock_qty || 0)));
        return {
          name: p.name,
          stock: Number(p.stock_qty),
          unit: p.unit,
          days_left: Math.round(daysOfCover),
          suggested_order: suggested,
        };
      })
      .sort((a, b) => a.days_left - b.days_left)
      .slice(0, 8);

    // dead stock (no sales 30d, stock > 0)
    const dead = (products as any[])
      .filter((p) => p.track_stock && Number(p.stock_qty) > 0 && !agg.has(p.$id))
      .map((p) => ({
        name: p.name,
        stock: Number(p.stock_qty),
        unit: p.unit,
        value: Math.round(Number(p.stock_qty) * Number(p.cost_price || 0)),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    const ctx = {
      shop: shopDoc.name,
      currency: shopDoc.currency || "INR",
      today_sales: Math.round(todaySales),
      today_orders: todays.length,
      week_sales: Math.round(weekSales),
      week_orders: s7.length,
      unpaid_credit: Math.round(unpaid),
      top_products_30d: top,
      reorder_suggestions: low,
      dead_stock: dead,
    };

    const prompt = `You are an AI business analyst for a grocery shop owner.
Write a sharp, friendly business briefing in plain language (Hinglish ok if natural).
Be specific with numbers and product names. Be concise — 4 short sections.

DATA (JSON):
${JSON.stringify(ctx)}

Output exactly this markdown structure:
## Aaj ka snapshot
2-3 lines on today's sales vs the week trend, orders, and unpaid credit if notable.

## Top performers (30d)
Bullet list of top 3 products with revenue and profit. If top_products_30d is empty, write "Abhi tak koi sales nahi hui hain." and do NOT invent or show any products.

## Reorder soon
Bullet list of items running low — name, days left, suggested order qty. Skip if list is empty or write "Koi item low stock nahi hai."

## Dead stock alert
Bullet list of items not sold in 30 days with money tied up. Skip if list is empty or write "Koi dead stock nahi hai."

CRITICAL RULE: Do not invent, fabricate, or show any products or data not present in the JSON data above. If lists are empty, explicitly state that there is no data or skip.`;

    const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "meta/llama-3.1-8b-instruct",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1024,
        temperature: 0.7,
      }),
    });
    if (res.status === 429) throw new Error("AI rate limit. Thodi der me try karo.");
    if (res.status === 402) throw new Error("AI credits khatam. Workspace billing me top-up karo.");
    if (!res.ok) throw new Error(`AI error: ${res.status}`);
    const json = await res.json();
    const text = json?.choices?.[0]?.message?.content ?? "No insights generated.";
    return { text, context: ctx, generated_at: new Date().toISOString() };
  });
