import { createFileRoute, redirect } from "@tanstack/react-router";
import { account } from "@/integrations/appwrite/client";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    try {
      await account.get();
      throw redirect({ to: "/dashboard" });
    } catch {
      throw redirect({ to: "/auth" });
    }
  },
  component: () => null,
});
