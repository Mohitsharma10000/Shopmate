import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAppwriteAuth } from "@/integrations/appwrite/auth-middleware";
import { APPWRITE_DATABASE_ID } from "@/integrations/appwrite/client.server";
import { Query, ID } from "node-appwrite";
import { mapDocuments, ensureMember } from "@/integrations/appwrite/helpers.server";

const roleEnum = z.enum(["owner", "manager", "cashier", "staff"]);

export const listTeam = createServerFn({ method: "GET" })
  .middleware([requireAppwriteAuth])
  .inputValidator((data: unknown) => z.object({ shop_id: z.string() }).parse(data))
  .handler(async ({ data, context }) => {
    // Verify caller is a member of the shop
    await ensureMember(context.databases, context.userId, data.shop_id);

    const response = await context.databases.listDocuments(
      APPWRITE_DATABASE_ID,
      "shop_members",
      [
        Query.equal("shop_id", data.shop_id),
        Query.orderAsc("$createdAt"),
        Query.limit(100),
      ]
    );

    const members = mapDocuments(response.documents);
    const userIds = [...new Set(members.map((m: any) => m.user_id).filter(Boolean) as string[])];
    
    let profiles: Record<string, { full_name: string | null; avatar_url: string | null; subscription_status: string | null }> = {};
    if (userIds.length > 0) {
      const profsRes = await context.databases.listDocuments(
        APPWRITE_DATABASE_ID,
        "profiles",
        [
          Query.equal("$id", userIds),
          Query.limit(100),
        ]
      );
      const profs = mapDocuments(profsRes.documents);
      profiles = Object.fromEntries(
        profs.map((p: any) => [p.id, { 
          full_name: p.full_name, 
          avatar_url: p.avatar_url,
          subscription_status: p.subscription_status || "inactive"
        }]),
      );
    }

    return members.map((m: any) => ({
      ...m,
      profile: m.user_id ? profiles[m.user_id] ?? null : null,
    }));
  });

export const inviteMember = createServerFn({ method: "POST" })
  .middleware([requireAppwriteAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        shop_id: z.string(),
        email: z.string().trim().email().max(255),
        role: roleEnum,
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    // Verify caller is owner or manager of the shop
    const callerRole = await ensureMember(context.databases, context.userId, data.shop_id);
    if (callerRole !== "owner" && callerRole !== "manager") {
      throw new Error("Unauthorized: Only owners and managers can invite team members.");
    }

    await context.databases.createDocument(
      APPWRITE_DATABASE_ID,
      "shop_members",
      ID.unique(),
      {
        shop_id: data.shop_id,
        invited_email: data.email.toLowerCase(),
        role: data.role,
        status: "invited",
      }
    );
    return { ok: true };
  });

export const updateMemberRole = createServerFn({ method: "POST" })
  .middleware([requireAppwriteAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string(), role: roleEnum }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const targetMember = await context.databases.getDocument(
      APPWRITE_DATABASE_ID,
      "shop_members",
      data.id
    );

    // Verify caller is owner or manager of the shop
    const callerRole = await ensureMember(context.databases, context.userId, targetMember.shop_id);
    if (callerRole !== "owner" && callerRole !== "manager") {
      throw new Error("Unauthorized: Only owners and managers can modify roles.");
    }

    // Only owners can grant/revoke owner role
    if ((data.role === "owner" || targetMember.role === "owner") && callerRole !== "owner") {
      throw new Error("Unauthorized: Only the shop owner can modify ownership privileges.");
    }

    await context.databases.updateDocument(
      APPWRITE_DATABASE_ID,
      "shop_members",
      data.id,
      {
        role: data.role,
      }
    );
    return { ok: true };
  });

export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireAppwriteAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data, context }) => {
    const targetMember = await context.databases.getDocument(
      APPWRITE_DATABASE_ID,
      "shop_members",
      data.id
    );

    // Verify caller is owner or manager of the shop
    const callerRole = await ensureMember(context.databases, context.userId, targetMember.shop_id);
    if (callerRole !== "owner" && callerRole !== "manager") {
      throw new Error("Unauthorized: Only owners and managers can remove members.");
    }

    // Prevent managers from removing owners
    if (targetMember.role === "owner" && callerRole !== "owner") {
      throw new Error("Unauthorized: Only the shop owner can remove another owner.");
    }

    await context.databases.deleteDocument(
      APPWRITE_DATABASE_ID,
      "shop_members",
      data.id
    );
    return { ok: true };
  });

export const toggleMemberSubscription = createServerFn({ method: "POST" })
  .middleware([requireAppwriteAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        shop_id: z.string(),
        target_user_id: z.string(),
        status: z.enum(["active", "inactive"]),
      })
      .parse(data)
  )
  .handler(async ({ data, context }) => {
    // 1. Verify caller is the owner of the shop
    const callerMemberRes = await context.databases.listDocuments(
      APPWRITE_DATABASE_ID,
      "shop_members",
      [
        Query.equal("shop_id", data.shop_id),
        Query.equal("user_id", context.userId),
        Query.equal("role", "owner"),
        Query.equal("status", "active"),
      ]
    );

    if (callerMemberRes.documents.length === 0) {
      throw new Error("Only the shop owner can manage member subscriptions.");
    }

    // 2. Verify target user is a member of the shop
    const targetMemberRes = await context.databases.listDocuments(
      APPWRITE_DATABASE_ID,
      "shop_members",
      [
        Query.equal("shop_id", data.shop_id),
        Query.equal("user_id", data.target_user_id),
        Query.equal("status", "active"),
      ]
    );

    if (targetMemberRes.documents.length === 0) {
      throw new Error("Target user is not an active member of this shop.");
    }

    // 3. Update subscription status in profiles collection
    try {
      await context.databases.updateDocument(
        APPWRITE_DATABASE_ID,
        "profiles",
        data.target_user_id,
        {
          subscription_status: data.status,
        }
      );
    } catch (err: any) {
      if (err.code === 404) {
        // Create profile if it doesn't exist
        await context.databases.createDocument(
          APPWRITE_DATABASE_ID,
          "profiles",
          data.target_user_id,
          {
            subscription_status: data.status,
          }
        );
      } else {
        throw new Error(err.message || "Failed to update subscription status");
      }
    }

    return { ok: true };
  });
