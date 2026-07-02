import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Route as AuthRoute } from "./route";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getMyProfile, listMyShops } from "@/lib/shops.functions";
import { dashboardOverview, todaysSoldProducts } from "@/lib/reports.functions";
import { AiInsightsCard } from "@/components/AiInsightsCard";
import {
  TrendingUp,
  TrendingDown,
  Package,
  ShoppingCart,
  IndianRupee,
  AlertTriangle,
  Plus,
  PackageX,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [{ title: "Dashboard — ShopOS" }],
  }),
  component: Dashboard,
});

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n || 0);
}

function Dashboard() {
  const { user } = AuthRoute.useRouteContext();
  const navigate = useNavigate();
  const profileFn = useServerFn(getMyProfile);
  const listFn = useServerFn(listMyShops);
  const overviewFn = useServerFn(dashboardOverview);

  const [showTodaySold, setShowTodaySold] = useState(false);

  const shops = useQuery({ queryKey: ["my-shops"], queryFn: () => listFn() });
  const profile = useQuery({ queryKey: ["my-profile"], queryFn: () => profileFn() });

  useEffect(() => {
    if (shops.isSuccess && !shops.isFetching && (shops.data?.length ?? 0) === 0) {
      navigate({ to: "/onboarding", replace: true });
    }
  }, [shops.isSuccess, shops.isFetching, shops.data, navigate]);

  const activeShop =
    shops.data?.find((s) => s.id === profile.data?.active_shop_id) ?? shops.data?.[0];

  const overview = useQuery({
    queryKey: ["dashboard-overview", activeShop?.id],
    queryFn: () => overviewFn({ data: { shop_id: activeShop!.id } }),
    enabled: !!activeShop?.id,
  });

  const data = overview.data;
  const trend = useMemo(() => {
    if (!data) return 0;
    if (!data.yesterday_sales) return data.today_sales > 0 ? 100 : 0;
    return ((data.today_sales - data.yesterday_sales) / data.yesterday_sales) * 100;
  }, [data]);

  return (
    <AppShell userEmail={user?.email}>
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto w-full">
        <div className="flex items-end justify-between flex-wrap gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {greeting()}, {profile.data?.full_name?.split(" ")[0] ?? "there"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {activeShop
                ? `Here's what's happening at ${activeShop.name}.`
                : "Set up your shop to get started."}
            </p>
          </div>
          <Button onClick={() => navigate({ to: "/pos" })}>
            <Plus className="h-4 w-4" /> New sale
          </Button>
        </div>

        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Today's sales"
            value={fmt(data?.today_sales ?? 0)}
            icon={IndianRupee}
            hint={
              data
                ? `${trend >= 0 ? "+" : ""}${trend.toFixed(1)}% vs yesterday`
                : "—"
            }
            trendUp={trend >= 0}
          />
          <KpiCard
            label="Today's orders"
            value={String(data?.today_orders ?? 0)}
            icon={ShoppingCart}
            hint={data ? `${data.week_orders} this week` : "—"}
            onClick={() => setShowTodaySold(true)}
          />
          <KpiCard
            label="Inventory value"
            value={fmt(data?.inventory_value ?? 0)}
            icon={Package}
            hint={data ? `${data.product_count} products` : "—"}
          />
          <KpiCard
            label="Low / Out"
            value={`${data?.low_stock ?? 0} / ${data?.out_of_stock ?? 0}`}
            icon={AlertTriangle}
            hint="Items to restock"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-3 mt-6">
          <Card className="lg:col-span-2 border-border/60 shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold">
                Sales last 7 days
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate({ to: "/scanner" })}
              >
                View scanner
              </Button>
            </CardHeader>
            <CardContent>
              <div className="h-56">
                {data && data.series.some((d) => d.sales > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.series}>
                      <defs>
                        <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(v) =>
                          new Date(v).toLocaleDateString("en-IN", {
                            weekday: "short",
                          })
                        }
                        tick={{ fontSize: 12 }}
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        stroke="hsl(var(--muted-foreground))"
                        tickFormatter={(v) =>
                          v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v
                        }
                      />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        formatter={(v: number) => fmt(v)}
                        labelFormatter={(v) =>
                          new Date(v).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                          })
                        }
                      />
                      <Area
                        type="monotone"
                        dataKey="sales"
                        stroke="hsl(var(--primary))"
                        fill="url(#g1)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full rounded-md border border-dashed border-border grid place-items-center text-sm text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Record your first sale to see the chart.
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-soft">
            <CardHeader>
              <CardTitle className="text-base font-semibold">At a glance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <StatRow
                icon={Wallet}
                label="Unpaid credit"
                value={fmt(data?.unpaid_credit ?? 0)}
              />
              <StatRow
                icon={TrendingUp}
                label="This week"
                value={fmt(data?.week_sales ?? 0)}
              />
              <StatRow
                icon={TrendingDown}
                label="This month"
                value={fmt(data?.month_sales ?? 0)}
              />
              <StatRow
                icon={PackageX}
                label="Out of stock"
                value={String(data?.out_of_stock ?? 0)}
              />
              <div className="pt-2 border-t border-border space-y-2">
                <QuickItem
                  title="Open POS"
                  description="Start a sale"
                  onClick={() => navigate({ to: "/pos" })}
                />
                <QuickItem
                  title="Manage inventory"
                  description="Add or restock"
                  onClick={() => navigate({ to: "/inventory" })}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {activeShop && (
          <div className="mt-6">
            <AiInsightsCard shopId={activeShop.id} />
          </div>
        )}

        {activeShop && (
          <TodaySoldDialog
            open={showTodaySold}
            onClose={() => setShowTodaySold(false)}
            shopId={activeShop.id}
          />
        )}
      </div>
    </AppShell>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  hint,
  trendUp,
  onClick,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
  trendUp?: boolean;
  onClick?: () => void;
}) {
  return (
    <Card
      className={`border-border/60 shadow-soft${
        onClick ? " cursor-pointer hover:bg-accent/40 transition-colors" : ""
      }`}
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="mt-3 text-2xl font-semibold tracking-tight">{value}</div>
        {hint && (
          <p
            className={`text-xs mt-1 ${
              trendUp === undefined
                ? "text-muted-foreground"
                : trendUp
                  ? "text-emerald-600 dark:text-emerald-500"
                  : "text-red-600 dark:text-red-500"
            }`}
          >
            {hint}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function StatRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}

function QuickItem({
  title,
  description,
  onClick,
}: {
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-md border border-border bg-surface hover:bg-surface-muted transition-colors p-3"
    >
      <div className="text-sm font-medium">{title}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
    </button>
  );
}

function TodaySoldDialog({
  open,
  onClose,
  shopId,
}: {
  open: boolean;
  onClose: () => void;
  shopId: string;
}) {
  const fetchSold = useServerFn(todaysSoldProducts);
  const q = useQuery({
    queryKey: ["todays-sold-products", shopId],
    queryFn: () => fetchSold({ data: { shop_id: shopId } }),
    enabled: open,
  });

  const totalQty = (q.data || []).reduce((a: number, b: any) => a + b.qty, 0);
  const totalRevenue = (q.data || []).reduce((a: number, b: any) => a + b.revenue, 0);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Today's Sold Products</DialogTitle>
        </DialogHeader>
        {q.isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading…</div>
        ) : !q.data?.length ? (
          <div className="text-center py-8 text-muted-foreground">
            No products sold today yet.
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-center">Qty</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.data.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-center">
                      {p.qty} {p.unit}
                    </TableCell>
                    <TableCell className="text-right">{fmt(p.revenue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex justify-between items-center pt-3 border-t text-sm font-semibold">
              <span>Total: {totalQty} items</span>
              <span>{fmt(totalRevenue)}</span>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
