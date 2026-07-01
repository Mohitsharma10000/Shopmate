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

// Helper function to programmatically create missing attributes in the profiles collection
async function ensureProfilesAttributesExist(databases: any) {
  try {
    await databases.createStringAttribute(
      APPWRITE_DATABASE_ID,
      "profiles",
      "subscription_status",
      20,
      false, // required
      "inactive" // default value
    );
    console.log("[Self-Healing] Requested creation of subscription_status attribute.");
  } catch (err: any) {
    if (!err.message?.includes("already exists") && !err.message?.includes("duplicated")) {
      console.error("[Self-Healing] Failed to create subscription_status attribute:", err);
    }
  }

  try {
    await databases.createStringAttribute(
      APPWRITE_DATABASE_ID,
      "profiles",
      "razorpay_payment_id",
      100,
      false, // required
      null // default value
    );
    console.log("[Self-Healing] Requested creation of razorpay_payment_id attribute.");
  } catch (err: any) {
    if (!err.message?.includes("already exists") && !err.message?.includes("duplicated")) {
      console.error("[Self-Healing] Failed to create razorpay_payment_id attribute:", err);
    }
  }
}

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
      console.log(`[Admin Sub Toggle] Attempting to update profile for user: ${data.target_user_id} to status: ${data.status}`);
      await admin.databases.updateDocument(
        APPWRITE_DATABASE_ID,
        "profiles",
        data.target_user_id,
        {
          subscription_status: data.status,
        }
      );
    } catch (err: any) {
      console.error("[Admin Sub Toggle] Update failed. Error details:", err);
      
      const isUnknownAttribute = 
        String(err.message || "").toLowerCase().includes("unknown attribute") ||
        String(err.message || "").toLowerCase().includes("attribute not found") ||
        String(err.message || "").toLowerCase().includes("invalid document structure");

      if (isUnknownAttribute) {
        console.log("[Admin Sub Toggle] Unknown attribute detected. Initiating self-healing...");
        await ensureProfilesAttributesExist(admin.databases);
        // Wait 3 seconds for Appwrite to create and activate the attribute
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Retry the update
        try {
          await admin.databases.updateDocument(
            APPWRITE_DATABASE_ID,
            "profiles",
            data.target_user_id,
            {
              subscription_status: data.status,
            }
          );
          return { ok: true };
        } catch (retryErr: any) {
          console.error("[Admin Sub Toggle] Retry failed:", retryErr);
          throw new Error("Missing 'subscription_status' attribute in Appwrite database profiles collection. We tried to create it, but Appwrite is still processing. Please wait 10 seconds and try again, or create 'subscription_status' (String, Size 20, default 'inactive') manually in the Appwrite Console.");
        }
      }

      const isNotFound = 
        err.code === 404 || 
        err.status === 404 || 
        String(err.message || "").toLowerCase().includes("not found") ||
        String(err.type || "").toLowerCase().includes("not_found");

      if (isNotFound) {
        console.log(`[Admin Sub Toggle] Profile not found. Creating new profile for user: ${data.target_user_id}`);
        let fullName = null;
        try {
          const userDetails = await admin.users.get(data.target_user_id);
          fullName = userDetails.name || null;
        } catch (userErr) {
          console.error("[Admin Sub Toggle] Failed to fetch user details from Appwrite Auth:", userErr);
        }

        try {
          await admin.databases.createDocument(
            APPWRITE_DATABASE_ID,
            "profiles",
            data.target_user_id,
            {
              full_name: fullName,
              subscription_status: data.status,
              avatar_url: null,
              phone: null,
              active_shop_id: null,
            }
          );
        } catch (createErr: any) {
          const isCreateUnknown = String(createErr.message || "").toLowerCase().includes("unknown attribute") || String(createErr.message || "").toLowerCase().includes("invalid document structure");
          if (isCreateUnknown) {
            await ensureProfilesAttributesExist(admin.databases);
            throw new Error("Appwrite profiles collection lacks the 'subscription_status' attribute. We initiated auto-creation. Please wait 10 seconds and try again.");
          }
          throw createErr;
        }
      } else {
        throw new Error(err.message || "Failed to update user subscription status");
      }
    }

    return { ok: true };
  });
