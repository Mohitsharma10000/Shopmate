import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { account, databases, APPWRITE_DATABASE_ID } from "@/integrations/appwrite/client";

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

    // Check subscription status from profile
    try {
      const profile = await databases.getDocument(
        APPWRITE_DATABASE_ID,
        "profiles",
        user.$id
      );
      if (profile.subscription_status !== "active") {
        throw redirect({ to: "/subscribe" });
      }
    } catch (err: any) {
      // If it's already a redirect, rethrow it
      if (err?.to || err?.redirect) throw err;
      
      console.error("Subscription check failed, redirecting to subscribe:", err);
      throw redirect({ to: "/subscribe" });
    }

    return { user };
  },
  component: () => <Outlet />,
});
