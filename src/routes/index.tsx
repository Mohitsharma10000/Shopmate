import { createFileRoute, redirect } from "@tanstack/react-router";
import { account } from "@/integrations/appwrite/client";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    try {
      const user = await account.get();
      if (user.email.toLowerCase() === "mohitsharma14651@gmail.com") {
        throw redirect({ to: "/admin" });
      }
      throw redirect({ to: "/dashboard" });
    } catch (err: any) {
      if (err?.to || err?.redirect) throw err;
      throw redirect({ to: "/auth" });
    }
  },
  component: () => null,
});
