import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { account } from "@/integrations/appwrite/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    try {
      const user = await account.get();
      return { user };
    } catch {
      throw redirect({ to: "/auth" });
    }
  },
  component: () => <Outlet />,
});
