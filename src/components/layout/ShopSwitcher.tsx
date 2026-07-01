import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { listMyShops, getMyProfile, setActiveShop } from "@/lib/shops.functions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown, Plus, Store } from "lucide-react";
import { toast } from "sonner";

export function ShopSwitcher() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const listFn = useServerFn(listMyShops);
  const profileFn = useServerFn(getMyProfile);
  const setActiveFn = useServerFn(setActiveShop);

  const shops = useQuery({ queryKey: ["my-shops"], queryFn: () => listFn() });
  const profile = useQuery({ queryKey: ["my-profile"], queryFn: () => profileFn() });

  const setActive = useMutation({
    mutationFn: (shop_id: string) => setActiveFn({ data: { shop_id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-profile"] });
      qc.invalidateQueries();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to switch shop"),
  });

  const activeId = profile.data?.active_shop_id ?? null;
  const active = shops.data?.find((s) => s.id === activeId) ?? shops.data?.[0];

  if (shops.isLoading) {
    return <div className="h-9 w-40 rounded-md bg-muted animate-pulse" />;
  }

  if (!shops.data || shops.data.length === 0) {
    return (
      <Button size="sm" variant="outline" onClick={() => navigate({ to: "/onboarding" })}>
        <Plus className="h-4 w-4" /> Create shop
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 min-w-[160px] justify-between">
          <span className="flex items-center gap-2 truncate">
            <Store className="h-4 w-4 text-muted-foreground" />
            <span className="truncate">{active?.name ?? "Select shop"}</span>
          </span>
          <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Your shops</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {shops.data.map((s) => (
          <DropdownMenuItem
            key={s.id}
            onClick={() => s.id !== activeId && setActive.mutate(s.id)}
            className="flex items-center justify-between"
          >
            <span className="flex flex-col">
              <span className="font-medium">{s.name}</span>
              <span className="text-xs text-muted-foreground capitalize">{s.role}</span>
            </span>
            {s.id === activeId && <Check className="h-4 w-4 text-accent" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate({ to: "/onboarding" })}>
          <Plus className="h-4 w-4" /> New shop
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
