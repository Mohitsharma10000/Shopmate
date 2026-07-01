import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAppwriteAuth } from "@/integrations/appwrite/auth-middleware";
import { APPWRITE_DATABASE_ID } from "@/integrations/appwrite/client.server";
import { Query, ID } from "node-appwrite";
import {
  mapDocument,
  mapDocuments,
  ensureMember,
  applyCustomerLedger,
} from "@/integrations/appwrite/helpers.server";

const customerSchema = z.object({
  shop_id: z.string(),
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().max(160).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  credit_limit: z.number().min(0).default(0),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const listCustomers = createServerFn({ method: "GET" })
  .middleware([requireAppwriteAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        shop_id: z.string(),
        search: z.string().nullable().optional(),
        with_balance_only: z.boolean().optional(),
      })
      .parse(d),
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
    if (data.with_balance_only) {
      queries.push(Query.greaterThan("balance", 0));
    }
    const response = await context.databases.listDocuments(
      APPWRITE_DATABASE_ID,
      "customers",
      queries,
    );
    return mapDocuments(response.documents);
  });

export const upsertCustomer = createServerFn({ method: "POST" })
  .middleware([requireAppwriteAuth])
  .inputValidator((d: unknown) =>
    customerSchema.extend({ id: z.string().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureMember(context.databases, context.userId, data.shop_id);
    const payload = {
      shop_id: data.shop_id,
      name: data.name,
      phone: data.phone || null,
      email: data.email || null,
      address: data.address || null,
      credit_limit: data.credit_limit || 0,
      notes: data.notes || null,
    };
    if (data.id) {
      const doc = await context.databases.updateDocument(
        APPWRITE_DATABASE_ID,
        "customers",
        data.id,
        payload,
      );
      return mapDocument(doc);
    }
    const doc = await context.databases.createDocument(
      APPWRITE_DATABASE_ID,
      "customers",
      ID.unique(),
      { ...payload, created_by: context.userId, balance: 0 },
    );
    return mapDocument(doc);
  });

export const deleteCustomer = createServerFn({ method: "POST" })
  .middleware([requireAppwriteAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string(), shop_id: z.string() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureMember(context.databases, context.userId, data.shop_id);
    await context.databases.deleteDocument(APPWRITE_DATABASE_ID, "customers", data.id);
    return { ok: true };
  });

export const getCustomer = createServerFn({ method: "GET" })
  .middleware([requireAppwriteAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string(), shop_id: z.string() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureMember(context.databases, context.userId, data.shop_id);
    const cust = await context.databases.getDocument(
      APPWRITE_DATABASE_ID,
      "customers",
      data.id,
    );
    const ledgerRes = await context.databases.listDocuments(
      APPWRITE_DATABASE_ID,
      "customer_ledger",
      [
        Query.equal("customer_id", data.id),
        Query.orderDesc("$createdAt"),
        Query.limit(200),
      ],
    );
    return { ...mapDocument(cust), ledger: mapDocuments(ledgerRes.documents) };
  });

export const recordPayment = createServerFn({ method: "POST" })
  .middleware([requireAppwriteAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        shop_id: z.string(),
        customer_id: z.string(),
        amount: z.number().positive(),
        payment_method: z.enum(["cash", "card", "upi", "bank"]).default("cash"),
        note: z.string().trim().max(300).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureMember(context.databases, context.userId, data.shop_id);
    const entry = await applyCustomerLedger(context.databases, {
      shop_id: data.shop_id,
      customer_id: data.customer_id,
      type: "payment",
      amount: data.amount,
      note: data.note || null,
      created_by: context.userId,
    });
    return mapDocument(entry);
  });

export const adjustBalance = createServerFn({ method: "POST" })
  .middleware([requireAppwriteAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        shop_id: z.string(),
        customer_id: z.string(),
        amount: z.number(),
        note: z.string().trim().max(300).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureMember(context.databases, context.userId, data.shop_id);
    const entry = await applyCustomerLedger(context.databases, {
      shop_id: data.shop_id,
      customer_id: data.customer_id,
      type: "adjustment",
      amount: data.amount,
      note: data.note || null,
      created_by: context.userId,
    });
    return mapDocument(entry);
  });

export const khataSummary = createServerFn({ method: "GET" })
  .middleware([requireAppwriteAuth])
  .inputValidator((d: unknown) => z.object({ shop_id: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureMember(context.databases, context.userId, data.shop_id);
    const response = await context.databases.listDocuments(
      APPWRITE_DATABASE_ID,
      "customers",
      [Query.equal("shop_id", data.shop_id), Query.limit(5000)],
    );
    const all = response.documents as unknown as Array<{ balance: number | string; credit_limit: number | string }>;
    let total_due = 0;
    let over_limit = 0;
    let with_dues = 0;
    all.forEach((r) => {
      const b = Number(r.balance || 0);
      const l = Number(r.credit_limit || 0);
      if (b > 0) {
        total_due += b;
        with_dues += 1;
        if (l > 0 && b > l) over_limit += 1;
      }
    });
    return { total_customers: all.length, with_dues, total_due, over_limit };
  });
