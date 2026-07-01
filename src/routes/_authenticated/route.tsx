import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { toast } from "sonner";
import { account } from "@/integrations/appwrite/client";
import { getSubscriptionStatus } from "@/lib/subscription.functions";

const OWNER_EMAIL = "mohitsharma14651@gmail.com";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    let user;
    try {
      user = await account.get();
    } catch {
      throw redirect({ to: "/auth" });
    }

    const isOwner = user.email.toLowerCase() === OWNER_EMAIL;

    // Skip subscription check for the platform owner — always allowed
    if (isOwner) {
      return { user, subscriptionStatus: "active" as const, isOwner: true };
    }

    if (location.pathname === "/subscribe") {
      return { user, subscriptionStatus: "unknown" as const, isOwner: false };
    }

    // Check subscription status with retry logic for transient server/network errors
    let res;
    let attempts = 0;
    while (attempts < 2) {
      try {
        res = await getSubscriptionStatus();
        break;
      } catch (err: any) {
        if (err?.to || err?.redirect) throw err;
        attempts++;
        if (attempts >= 2) {
          console.error("[Auth Guard] Failed to check subscription status after 2 attempts:", err);
          // Instead of paywalling, throw a generic error to show errorComponent
          throw new Error("Temporary Connection Error: We are having trouble verifying your subscription. Please refresh or try again shortly.");
        }
        // Wait 1 second before retrying
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    if (res && res.status !== "active") {
      throw redirect({ to: "/subscribe" });
    }

    return { user, subscriptionStatus: (res?.status || "active") as string, isOwner: false };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const { user, subscriptionStatus, isOwner } = Route.useRouteContext();
  const statusFn = useServerFn(getSubscriptionStatus);

  // Periodic subscription polling to detect deactivation mid-session
  // Skip for platform owner — they are always allowed
  const subStatus = useQuery({
    queryKey: ["subscription-status"],
    queryFn: () => statusFn(),
    // Seed initial data from beforeLoad so there is NEVER a flash of stale/undefined data
    initialData: subscriptionStatus === "active"
      ? { status: "active" as const, payment_id: null }
      : undefined,
    refetchInterval: isOwner ? false : 30000, // Check every 30 seconds (skip for owner)
    refetchOnWindowFocus: !isOwner,
    enabled: !isOwner, // Don't poll at all for the platform owner
  });

  useEffect(() => {
    // Skip for the platform owner
    if (isOwner) return;

    // If user subscription becomes inactive, immediately boot them out to paywall
    if (subStatus.data?.status === "inactive") {
      toast.error("Your subscription is no longer active. Redirecting to paywall page.");
      navigate({ to: "/subscribe", replace: true });
    }
  }, [subStatus.data?.status, navigate, isOwner]);

  return <Outlet />;
}
