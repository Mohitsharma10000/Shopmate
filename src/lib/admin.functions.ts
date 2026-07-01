import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAppwriteAuth } from "@/integrations/appwrite/auth-middleware";
import { APPWRITE_DATABASE_ID, createAdminClient } from "@/integrations/appwrite/client.server";
import { Query } from "node-appwrite";
import { mapDocument, mapDocuments } from "@/integrations/appwrite/helpers.server";

// Helper function to assert caller is the platform owner
function requirePlatformOwner(email: string) {
  if (email.toLowerCase() !== "mohitsharma14651@gmail.com") {
    throw new Error("Access Denied: You are not authorized to view this page.");
  }
}

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireAppwriteAuth])
  .handler(async ({ context }) => {
    requirePlatformOwner(context.user.email);

    const admin = createAdminClient();

    // 1. Fetch registered users from Appwrite Auth
    const usersRes = await admin.users.list();
    const users = usersRes.users.map((u: any) => ({
      id: u.$id,
      name: u.name || "Unnamed User",
      email: u.email,
      phone: u.phone || null,
      createdAt: u.registration,
    }));

    // 2. Fetch profiles from database (contains subscription info)
    const profilesRes = await admin.databases.listDocuments(
      APPWRITE_DATABASE_ID,
      "profiles",
      [Query.limit(100)]
    );
    const profiles = mapDocuments(profilesRes.documents);
    const profileMap = new Map(profiles.map((p: any) => [p.id, p]));

    // 3. Fetch all shops from database
    const shopsRes = await admin.databases.listDocuments(
      APPWRITE_DATABASE_ID,
      "shops",
      [Query.limit(100), Query.orderDesc("$createdAt")]
    );
    const shops = mapDocuments(shopsRes.documents);

    // Combine user details with profile subscription details
    const userOverviewList = users.map((u) => {
      const prof = profileMap.get(u.id);
      return {
        ...u,
        phone: u.phone || (prof?.phone as string) || "—",
        subscriptionStatus: (prof?.subscription_status as string) || "inactive",
        razorpayPaymentId: (prof?.razorpay_payment_id as string) || "—",
      };
    });

    // Map shops with owner details (email if found)
    const shopOverviewList = shops.map((s: any) => {
      const owner = users.find((u) => u.id === s.owner_id);
      return {
        id: s.id,
        name: s.name,
        businessType: s.business_type,
        ownerEmail: owner?.email || "—",
        createdAt: s.created_at,
      };
    });

    const activeSubscriptionsCount = userOverviewList.filter(
      (u) => u.subscriptionStatus === "active"
    ).length;

    return {
      stats: {
        totalUsers: users.length,
        totalShops: shops.length,
        activeSubscriptions: activeSubscriptionsCount,
      },
      users: userOverviewList,
      shops: shopOverviewList,
    };
  });

export const adminToggleUserSubscription = createServerFn({ method: "POST" })
  .middleware([requireAppwriteAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        target_user_id: z.string(),
        status: z.enum(["active", "inactive"]),
      })
      .parse(data)
  )
  .handler(async ({ data, context }) => {
    requirePlatformOwner(context.user.email);

    const admin = createAdminClient();

    try {
      await admin.databases.updateDocument(
        APPWRITE_DATABASE_ID,
        "profiles",
        data.target_user_id,
        {
          subscription_status: data.status,
        }
      );
    } catch (err: any) {
      if (err.code === 404) {
        // Fetch user from auth to get name
        const userDetails = await admin.users.get(data.target_user_id);
        // Create profile if missing
        await admin.databases.createDocument(
          APPWRITE_DATABASE_ID,
          "profiles",
          data.target_user_id,
          {
            full_name: userDetails.name || null,
            subscription_status: data.status,
          }
        );
      } else {
        throw new Error(err.message || "Failed to update user subscription status");
      }
    }

    return { ok: true };
  });
