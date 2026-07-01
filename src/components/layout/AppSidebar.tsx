import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { account, authEvents } from "@/integrations/appwrite/client";
import {
  LayoutDashboard,
  Package,
  ScanLine,
  BarChart3,
  Settings,
  Store,
  Truck,
  Users,
  LogOut,
} from "lucide-react";
import { toast } from "sonner";

const nav = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Point of Sale", url: "/pos", icon: ScanLine },
  { title: "Inventory", url: "/inventory", icon: Package },
  { title: "Purchases", url: "/purchases", icon: Truck },
  { title: "Customers", url: "/customers", icon: Users },
  { title: "Reports", url: "/reports", icon: BarChart3 },
];

const settings = [{ title: "Settings", url: "/settings/shop", icon: Settings }];

export function AppSidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();
  
  const isActive = (url: string) => path === url || path.startsWith(url + "/");

  async function handleSignOut() {
    try {
      await qc.cancelQueries();
      qc.clear();
      await account.deleteSession("current");
      authEvents.notify();
      toast.success("Signed out successfully");
      navigate({ to: "/auth", replace: true });
    } catch (err: any) {
      console.error("Sign out failed:", err);
      // Even if session delete fails (e.g. offline), clean local state & redirect
      authEvents.notify();
      navigate({ to: "/auth", replace: true });
    }
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="h-7 w-7 rounded-md bg-primary grid place-items-center shrink-0">
            <Store className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
            ShopOS
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {settings.map((item) => (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                <Link to={item.url}>
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
          <SidebarMenuItem>
            <SidebarMenuButton 
              onClick={handleSignOut} 
              tooltip="Sign out"
              className="text-destructive hover:text-destructive hover:bg-destructive/10 focus:text-destructive focus:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
