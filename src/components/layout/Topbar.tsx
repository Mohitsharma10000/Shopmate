import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { account, authEvents } from "@/integrations/appwrite/client";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { ShopSwitcher } from "./ShopSwitcher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, Settings as SettingsIcon, Users } from "lucide-react";
import { toast } from "sonner";

export function Topbar({ userEmail }: { userEmail: string | undefined }) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await account.deleteSession("current");
    authEvents.notify();
    toast.success("Signed out");
    navigate({ to: "/auth", replace: true });
  }

  const initials = (userEmail ?? "?")
    .split("@")[0]
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="h-14 border-b border-border bg-surface/80 backdrop-blur sticky top-0 z-20 flex items-center gap-3 px-3 sm:px-4">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-5" />
      <ShopSwitcher />
      <div className="ml-auto flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="rounded-full focus:outline-none focus:ring-2 focus:ring-ring">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col">
                <span className="text-sm font-medium">{userEmail}</span>
                <span className="text-xs text-muted-foreground">Signed in</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate({ to: "/settings/shop" })}>
              <SettingsIcon className="h-4 w-4" /> Shop settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate({ to: "/settings/team" })}>
              <Users className="h-4 w-4" /> Team
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
              <LogOut className="h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
