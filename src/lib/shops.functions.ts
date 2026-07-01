import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAppwriteAuth } from "@/integrations/appwrite/auth-middleware";
import { APPWRITE_DATABASE_ID } from "@/integrations/appwrite/client.server";
import { Query, ID } from "node-appwrite";
import { mapDocument, mapDocuments, ensureMember } from "@/integrations/appwrite/helpers.server";

const createShopSchema = z.object({
  name: z.string().trim().min(1).max(120),
  business_type: z.string().trim().min(1).max(40).default("grocery"),
  gstin: z.string().trim().max(20).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().email().max(255).optional().nullable().or(z.literal("")),
  currency: z.string().trim().min(3).max(8).default("INR"),
  timezone: z.string().trim().min(3).max(64).default("Asia/Kolkata"),
});

export const listMyShops = createServerFn({ method: "GET" })
  .middleware([requireAppwriteAuth])
  .handler(async ({ context }) => {
    const response = await context.databases.listDocuments(
      APPWRITE_DATABASE_ID,
      "shop_members",
      [
        Query.equal("user_id", context.userId),
        Query.equal("status", "active"),
      ]
    );

    const members = mapDocuments(response.documents);
    const shopIds = [...new Set(members.map((m: any) => m.shop_id).filter(Boolean))] as string[];

    let shopMap = new Map<string, any>();
    if (shopIds.length > 0) {
      const shopRes = await context.databases.listDocuments(
        APPWRITE_DATABASE_ID,
        "shops",
        [
          Query.equal("$id", shopIds),
          Query.limit(100),
        ]
      );
      for (const s of shopRes.documents) {
        shopMap.set(s.$id, mapDocument(s));
      }
    }

    return members
      .map((row: any) => ({
        ...row,
        shop: shopMap.get(row.shop_id) || null,
      }))
      .filter((row: any) => row.shop)
      .map((row: any) => ({
        id: row.shop.id,
        name: row.shop.name,
        business_type: row.shop.business_type,
        currency: row.shop.currency,
        logo_url: row.shop.logo_url,
        created_at: row.shop.created_at,
        role: row.role as "owner" | "manager" | "cashier" | "staff",
      }));
  });

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireAppwriteAuth])
  .handler(async ({ context }) => {
    try {
      const doc = await context.databases.getDocument(
        APPWRITE_DATABASE_ID,
        "profiles",
        context.userId
      );
      return mapDocument(doc);
    } catch (err: any) {
      if (err.code === 404) {
        return null;
      }
      throw new Error(err.message || String(err));
    }
  });

export const createShop = createServerFn({ method: "POST" })
  .middleware([requireAppwriteAuth])
  .inputValidator((data: unknown) => createShopSchema.parse(data))
  .handler(async ({ data, context }) => {
    const shopId = ID.unique();
    const payload = {
      owner_id: context.userId,
      name: data.name,
      business_type: data.business_type,
      gstin: data.gstin || null,
      address: data.address || null,
      phone: data.phone || null,
      email: data.email || null,
      currency: data.currency,
      timezone: data.timezone,
    };

    const shopDoc = await context.databases.createDocument(
      APPWRITE_DATABASE_ID,
      "shops",
      shopId,
      payload
    );

    // Also auto-create a membership for the creator as 'owner'
    await context.databases.createDocument(
      APPWRITE_DATABASE_ID,
      "shop_members",
      ID.unique(),
      {
        shop_id: shopId,
        user_id: context.userId,
        invited_email: context.user.email,
        role: "owner",
        status: "active",
      }
    );

    // Upsert profile with active_shop_id so the dashboard knows which shop is active
    try {
      await context.databases.updateDocument(
        APPWRITE_DATABASE_ID,
        "profiles",
        context.userId,
        { active_shop_id: shopId }
      );
    } catch (profileErr: any) {
      // Profile doesn't exist yet — create it
      if (profileErr.code === 404) {
        await context.databases.createDocument(
          APPWRITE_DATABASE_ID,
          "profiles",
          context.userId,
          {
            full_name: context.user.name || null,
            active_shop_id: shopId,
          }
        );
      }
    }

    return {
      id: shopDoc.$id,
      name: shopDoc.name,
    };
  });

export const setActiveShop = createServerFn({ method: "POST" })
  .middleware([requireAppwriteAuth])
  .inputValidator((data: unknown) => z.object({ shop_id: z.string() }).parse(data))
  .handler(async ({ data, context }) => {
    // Ensure user is a member
    const response = await context.databases.listDocuments(
      APPWRITE_DATABASE_ID,
      "shop_members",
      [
        Query.equal("user_id", context.userId),
        Query.equal("shop_id", data.shop_id),
        Query.equal("status", "active"),
      ]
    );

    if (response.documents.length === 0) {
      throw new Error("Not a member of that shop");
    }

    await context.databases.updateDocument(
      APPWRITE_DATABASE_ID,
      "profiles",
      context.userId,
      {
        active_shop_id: data.shop_id,
      }
    );

    return { ok: true };
  });

export const updateShop = createServerFn({ method: "POST" })
  .middleware([requireAppwriteAuth])
  .inputValidator((data: unknown) =>
    createShopSchema.partial().extend({ id: z.string() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    
    // Enforce authorization check: Must be owner or manager
    const role = await ensureMember(context.databases, context.userId, id);
    if (role !== "owner" && role !== "manager") {
      throw new Error("Unauthorized: Only owners and managers can update shop configuration");
    }

    await context.databases.updateDocument(
      APPWRITE_DATABASE_ID,
      "shops",
      id,
      {
        ...rest,
        email: rest.email === "" ? null : rest.email,
      }
    );
    return { ok: true };
  });
