import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Topbar } from "./Topbar";
import type { ReactNode } from "react";

export function AppShell({
  userEmail,
  children,
}: {
  userEmail: string | undefined;
  children: ReactNode;
}) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-background">
        <Topbar userEmail={userEmail} />
        <main className="flex-1 min-w-0">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
