import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAppwriteAuth } from "@/integrations/appwrite/auth-middleware";
import { APPWRITE_DATABASE_ID } from "@/integrations/appwrite/client.server";

/**
 * Verify a Razorpay payment and activate the user's subscription.
 * Called from the client after Razorpay Checkout succeeds.
 */
export const verifySubscription = createServerFn({ method: "POST" })
  .middleware([requireAppwriteAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        razorpay_payment_id: z.string().min(1),
      })
      .parse(data)
  )
  .handler(async ({ data, context }) => {
    // Update the user's profile document with subscription info
    try {
      await context.databases.updateDocument(
        APPWRITE_DATABASE_ID,
        "profiles",
        context.userId,
        {
          subscription_status: "active",
          razorpay_payment_id: data.razorpay_payment_id,
        }
      );
    } catch (err: any) {
      // Profile may not exist yet (e.g. OAuth user) — create it
      if (err.code === 404) {
        const { ID } = await import("node-appwrite");
        await context.databases.createDocument(
          APPWRITE_DATABASE_ID,
          "profiles",
          context.userId,
          {
            full_name: context.user?.name || null,
            subscription_status: "active",
            razorpay_payment_id: data.razorpay_payment_id,
          }
        );
      } else {
        throw new Error(err.message || "Failed to activate subscription");
      }
    }

    return { ok: true, status: "active" as const };
  });

/**
 * Check whether the current user has an active subscription.
 */
export const getSubscriptionStatus = createServerFn({ method: "GET" })
  .middleware([requireAppwriteAuth])
  .handler(async ({ context }) => {
    try {
      const doc = await context.databases.getDocument(
        APPWRITE_DATABASE_ID,
        "profiles",
        context.userId
      );
      return {
        status: (doc.subscription_status as string) || "inactive",
        payment_id: (doc.razorpay_payment_id as string) || null,
      };
    } catch (err: any) {
      if (err.code === 404) {
        return { status: "inactive" as const, payment_id: null };
      }
      throw new Error(err.message || String(err));
    }
  });
