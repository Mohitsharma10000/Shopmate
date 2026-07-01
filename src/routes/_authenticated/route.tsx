import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { toast } from "sonner";
import { account } from "@/integrations/appwrite/client";
import { getSubscriptionStatus } from "@/lib/subscription.functions";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    let user;
    try {
      user = await account.get();
    } catch {
      throw redirect({ to: "/auth" });
    }

    // Skip subscription check if we're already heading to /subscribe or if it is the owner
    if (user.email.toLowerCase() === "mohitsharma14651@gmail.com") {
      return { user };
    }

    if (location.pathname === "/subscribe") {
      return { user };
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

    return { user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const statusFn = useServerFn(getSubscriptionStatus);

  // Periodic subscription polling to detect deactivation mid-session
  const subStatus = useQuery({
    queryKey: ["subscription-status"],
    queryFn: () => statusFn(),
    refetchInterval: 30000, // Check every 30 seconds
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    // If user subscription becomes inactive, immediately boot them out to paywall
    if (subStatus.data?.status === "inactive") {
      toast.error("Your subscription is no longer active. Redirecting to paywall page.");
      navigate({ to: "/subscribe", replace: true });
    }
  }, [subStatus.data?.status, navigate]);

  return <Outlet />;
}
