import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAppwriteAuth } from "@/integrations/appwrite/auth-middleware";
import { APPWRITE_DATABASE_ID } from "@/integrations/appwrite/client.server";
import { Query, ID } from "node-appwrite";
import { mapDocuments } from "@/integrations/appwrite/helpers.server";

const roleEnum = z.enum(["owner", "manager", "cashier", "staff"]);

export const listTeam = createServerFn({ method: "GET" })
  .middleware([requireAppwriteAuth])
  .inputValidator((data: unknown) => z.object({ shop_id: z.string() }).parse(data))
  .handler(async ({ data, context }) => {
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
    
    let profiles: Record<string, { full_name: string | null; avatar_url: string | null }> = {};
    if (userIds.length > 0) {
      // Appwrite's Query.equal supports passing an array, acting like SQL IN operator
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
        profs.map((p: any) => [p.id, { full_name: p.full_name, avatar_url: p.avatar_url }]),
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
    await context.databases.deleteDocument(
      APPWRITE_DATABASE_ID,
      "shop_members",
      data.id
    );
    return { ok: true };
  });
