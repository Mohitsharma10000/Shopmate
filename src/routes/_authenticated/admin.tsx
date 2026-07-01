import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getAdminOverview, adminToggleUserSubscription } from "@/lib/admin.functions";
import {
  Users,
  Store,
  CreditCard,
  Search,
  CheckCircle,
  XCircle,
  Calendar,
  Phone,
  Mail,
  Shield,
  Loader2,
} from "lucide-react";
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [{ title: "Platform Admin Panel — ShopOS" }],
  }),
  beforeLoad: async ({ context }) => {
    // Block non-owners at routing layer
    if (context.user?.email?.toLowerCase() !== "mohitsharma14651@gmail.com") {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: AdminDashboard,
});

function AdminDashboard() {
  const qc = useQueryClient();
  const getOverviewFn = useServerFn(getAdminOverview);
  const toggleSubFn = useServerFn(adminToggleUserSubscription);

  const [userQuery, setUserQuery] = useState("");
  const [shopQuery, setShopQuery] = useState("");

  const overview = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => getOverviewFn(),
  });

  const toggleSub = useMutation({
    mutationFn: ({ target_user_id, status }: { target_user_id: string; status: "active" | "inactive" }) =>
      toggleSubFn({ data: { target_user_id, status } }),
    onSuccess: () => {
      toast.success("User subscription updated successfully");
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to toggle subscription");
    },
  });

  // Filters
  const filteredUsers = useMemo(() => {
    const data = overview.data?.users || [];
    if (!userQuery.trim()) return data;
    const q = userQuery.toLowerCase();
    return data.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.phone && u.phone.includes(q))
    );
  }, [overview.data?.users, userQuery]);

  const filteredShops = useMemo(() => {
    const data = overview.data?.shops || [];
    if (!shopQuery.trim()) return data;
    const q = shopQuery.toLowerCase();
    return data.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.ownerEmail.toLowerCase().includes(q) ||
        s.businessType.toLowerCase().includes(q)
    );
  }, [overview.data?.shops, shopQuery]);

  if (overview.isLoading) {
    return (
      <AppShell userEmail="mohitsharma14651@gmail.com">
        <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-6xl mx-auto w-full space-y-6">
          <Skeleton className="h-20 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </AppShell>
    );
  }

  const stats = overview.data?.stats || { totalUsers: 0, totalShops: 0, activeSubscriptions: 0 };

  return (
    <AppShell userEmail="mohitsharma14651@gmail.com">
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-6xl mx-auto w-full space-y-8">
        
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 grid place-items-center">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg sm:text-2xl font-semibold tracking-tight text-foreground">
              Platform Admin Dashboard
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Manage users, shops, and subscriptions for ShopOS.
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
          <Card className="border-border/60 shadow-soft">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-violet-500/10 grid place-items-center">
                <Users className="h-6 w-6 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Total Registered Users</p>
                <h3 className="text-2xl font-bold tracking-tight mt-1">{stats.totalUsers}</h3>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-soft">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-amber-500/10 grid place-items-center">
                <Store className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Total Shops Created</p>
                <h3 className="text-2xl font-bold tracking-tight mt-1">{stats.totalShops}</h3>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-soft">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-emerald-500/10 grid place-items-center">
                <CreditCard className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Active paid Subscriptions</p>
                <h3 className="text-2xl font-bold tracking-tight mt-1">
                  {stats.activeSubscriptions}
                </h3>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Users Management Section */}
        <Card className="border-border/60 shadow-soft">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/40">
            <div>
              <CardTitle className="text-base font-semibold">User Profiles & Subscriptions</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Activate or deactivate users instantly.</p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search email, name or phone..."
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground font-medium">
                    <th className="p-4">Name</th>
                    <th className="p-4">Email</th>
                    <th className="p-4">Phone</th>
                    <th className="p-4">Joined Date</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 text-sm">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-muted/10 transition-colors">
                      <td className="p-4 font-medium text-foreground">{u.name}</td>
                      <td className="p-4 text-muted-foreground font-mono text-xs">{u.email}</td>
                      <td className="p-4 text-muted-foreground text-xs">{u.phone}</td>
                      <td className="p-4 text-muted-foreground text-xs">
                        {new Date(u.createdAt).toLocaleDateString("en-IN", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="p-4">
                        <Badge
                          variant={u.subscriptionStatus === "active" ? "default" : "secondary"}
                          className={`text-[10px] font-medium px-2.5 py-0.5 rounded-full ${
                            u.subscriptionStatus === "active"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          }`}
                        >
                          {u.subscriptionStatus === "active" ? "Paid" : "Unpaid"}
                        </Badge>
                      </td>
                      <td className="p-4 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={toggleSub.isPending}
                          className="h-8 text-xs gap-1.5"
                          onClick={() =>
                            toggleSub.mutate({
                              target_user_id: u.id,
                              status: u.subscriptionStatus === "active" ? "inactive" : "active",
                            })
                          }
                        >
                          <CreditCard className="h-3.5 w-3.5" />
                          {u.subscriptionStatus === "active" ? "Deactivate" : "Activate"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-xs text-muted-foreground">
                        No registered users found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View */}
            <div className="block md:hidden divide-y divide-border/60">
              {filteredUsers.map((u) => (
                <div key={u.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-foreground">{u.name}</span>
                    <Badge
                      variant={u.subscriptionStatus === "active" ? "default" : "secondary"}
                      className={`text-[9px] font-medium px-2 py-0.5 rounded-full ${
                        u.subscriptionStatus === "active"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      }`}
                    >
                      {u.subscriptionStatus === "active" ? "Paid" : "Unpaid"}
                    </Badge>
                  </div>
                  
                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground/75" />
                      <span className="font-mono text-[11px] truncate max-w-[240px]">{u.email}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground/75" />
                      <span>{u.phone || "—"}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground/75" />
                      <span>
                        Joined:{" "}
                        {new Date(u.createdAt).toLocaleDateString("en-IN", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                  
                  <div className="pt-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={toggleSub.isPending}
                      className="h-8 text-xs gap-1.5 w-full flex justify-center items-center"
                      onClick={() =>
                        toggleSub.mutate({
                          target_user_id: u.id,
                          status: u.subscriptionStatus === "active" ? "inactive" : "active",
                        })
                      }
                    >
                      {toggleSub.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CreditCard className="h-3.5 w-3.5" />
                      )}
                      {u.subscriptionStatus === "active" ? "Deactivate Account" : "Activate Account"}
                    </Button>
                  </div>
                </div>
              ))}
              {filteredUsers.length === 0 && (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  No registered users found.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Shops Management Section */}
        <Card className="border-border/60 shadow-soft">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/40">
            <div>
              <CardTitle className="text-base font-semibold">Active Shops</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">List of all created stores on the platform.</p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search shop name, owner, type..."
                value={shopQuery}
                onChange={(e) => setShopQuery(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground font-medium">
                    <th className="p-4">Shop Name</th>
                    <th className="p-4">Owner Email</th>
                    <th className="p-4">Business Type</th>
                    <th className="p-4">Created Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 text-sm">
                  {filteredShops.map((s) => (
                    <tr key={s.id} className="hover:bg-muted/10 transition-colors">
                      <td className="p-4 font-medium text-foreground">{s.name}</td>
                      <td className="p-4 text-muted-foreground font-mono text-xs">{s.ownerEmail}</td>
                      <td className="p-4 text-muted-foreground text-xs capitalize">{s.businessType}</td>
                      <td className="p-4 text-muted-foreground text-xs">
                        {new Date(s.createdAt).toLocaleDateString("en-IN", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                    </tr>
                  ))}
                  {filteredShops.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-xs text-muted-foreground">
                        No shops found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View */}
            <div className="block md:hidden divide-y divide-border/60">
              {filteredShops.map((s) => (
                <div key={s.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-foreground">{s.name}</span>
                    <Badge variant="outline" className="text-[9px] px-2 py-0.5 capitalize">
                      {s.businessType}
                    </Badge>
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground/75" />
                      <span className="font-mono text-[11px] truncate max-w-[240px]">{s.ownerEmail}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground/75" />
                      <span>
                        Created:{" "}
                        {new Date(s.createdAt).toLocaleDateString("en-IN", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {filteredShops.length === 0 && (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  No shops found.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
