import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Route as AuthRoute } from "./route";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createShop } from "@/lib/shops.functions";
import { Loader2, Store } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Create your shop — ShopOS" }] }),
  component: Onboarding,
});

function Onboarding() {
  const { user } = AuthRoute.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const createFn = useServerFn(createShop);

  const [form, setForm] = useState({
    name: "",
    business_type: "grocery",
    gstin: "",
    address: "",
    phone: "",
    currency: "INR",
    timezone: "Asia/Kolkata",
  });

  const mut = useMutation({
    mutationFn: () => createFn({ data: form }),
    onSuccess: async (newShop: any) => {
      toast.success("Shop created");
      try {
        // Optimistically set the shops list cache so the dashboard guard
        // never sees an empty array during the refetch window
        qc.setQueryData(["my-shops"], (old: any[] | undefined) => [
          ...(old ?? []),
          {
            id: newShop.id,
            name: newShop.name,
            business_type: form.business_type,
            currency: form.currency,
            logo_url: null,
            created_at: new Date().toISOString(),
            role: "owner" as const,
          },
        ]);

        // Refetch in the background to get the real server data
        qc.invalidateQueries({ queryKey: ["my-shops"] });
        qc.invalidateQueries({ queryKey: ["my-profile"] });

        // Navigate — the dashboard guard will see the optimistic data immediately
        navigate({ to: "/dashboard" });
      } catch (err) {
        console.error("Post-creation setup failed:", err);
        toast.error("Shop created but navigation failed. Please refresh.");
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to create shop"),
  });

  return (
    <AppShell userEmail={user?.email}>
      <div className="px-4 sm:px-6 lg:px-8 py-10 max-w-2xl mx-auto w-full">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-lg bg-primary grid place-items-center">
            <Store className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Create your shop</h1>
            <p className="text-sm text-muted-foreground">
              Add your shop details. You can edit them later in settings.
            </p>
          </div>
        </div>

        <Card className="border-border/60 shadow-soft">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Shop details</CardTitle>
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
                <Label htmlFor="name">Shop name *</Label>
                <Input
                  id="name"
                  required
                  maxLength={120}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Sharma Kirana Store"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Business type</Label>
                  <Select
                    value={form.business_type}
                    onValueChange={(v) => setForm({ ...form, business_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="grocery">Grocery / Supermarket</SelectItem>
                      <SelectItem value="pharmacy">Pharmacy</SelectItem>
                      <SelectItem value="clothing">Clothing</SelectItem>
                      <SelectItem value="electronics">Electronics</SelectItem>
                      <SelectItem value="hardware">Hardware</SelectItem>
                      <SelectItem value="stationery">Stationery</SelectItem>
                      <SelectItem value="restaurant">Restaurant</SelectItem>
                      <SelectItem value="other">Other retail</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Currency</Label>
                  <Select
                    value={form.currency}
                    onValueChange={(v) => setForm({ ...form, currency: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INR">INR — Indian Rupee</SelectItem>
                      <SelectItem value="USD">USD — US Dollar</SelectItem>
                      <SelectItem value="EUR">EUR — Euro</SelectItem>
                      <SelectItem value="GBP">GBP — British Pound</SelectItem>
                      <SelectItem value="AED">AED — UAE Dirham</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="gstin">GSTIN (optional)</Label>
                  <Input
                    id="gstin"
                    maxLength={20}
                    value={form.gstin}
                    onChange={(e) => setForm({ ...form, gstin: e.target.value })}
                    placeholder="22AAAAA0000A1Z5"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Contact phone</Label>
                  <Input
                    id="phone"
                    maxLength={40}
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  maxLength={500}
                  rows={3}
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="123, Main Bazaar, City"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={mut.isPending || !form.name.trim()}>
                  {mut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create shop
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => navigate({ to: "/dashboard" })}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
