import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { getMyProfile, listMyShops, updateShop } from "@/lib/shops.functions";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings/shop")({
  component: ShopSettings,
});

function ShopSettings() {
  const qc = useQueryClient();
  const profileFn = useServerFn(getMyProfile);
  const listFn = useServerFn(listMyShops);
  const updateFn = useServerFn(updateShop);

  const profile = useQuery({ queryKey: ["my-profile"], queryFn: () => profileFn() });
  const shops = useQuery({ queryKey: ["my-shops"], queryFn: () => listFn() });

  const activeId = profile.data?.active_shop_id ?? shops.data?.[0]?.id ?? null;
  const active = shops.data?.find((s) => s.id === activeId);

  const [form, setForm] = useState({
    name: "",
    gstin: "",
    address: "",
    phone: "",
    email: "",
  });

  useEffect(() => {
    if (active) {
      setForm({
        name: active.name,
        gstin: "",
        address: "",
        phone: "",
        email: "",
      });
    }
  }, [active?.id, active?.name]);

  const mut = useMutation({
    mutationFn: () => {
      if (!activeId) throw new Error("No active shop");
      return updateFn({ data: { id: activeId, ...form } });
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["my-shops"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to save"),
  });

  if (profile.isLoading || shops.isLoading) {
    return <Skeleton className="h-64" />;
  }

  if (!activeId) {
    return (
      <Card className="border-border/60">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No active shop. Create one from the top bar.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/60 shadow-soft">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Shop profile</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            mut.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="name">Shop name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="gstin">GSTIN</Label>
              <Input
                id="gstin"
                value={form.gstin}
                onChange={(e) => setForm({ ...form, gstin: e.target.value })}
                placeholder="22AAAAA0000A1Z5"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              rows={3}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
          <div>
            <Button type="submit" disabled={mut.isPending}>
              {mut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
