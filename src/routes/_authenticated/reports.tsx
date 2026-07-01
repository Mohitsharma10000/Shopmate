import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Route as AuthRoute } from "./route";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { getMyProfile, listMyShops } from "@/lib/shops.functions";
import {
  salesTimeseries,
  topProducts,
  lowStockReport,
} from "@/lib/reports.functions";
import {
  profitTimeseries,
  topProfitProducts,
  slowMovers,
} from "@/lib/analytics.functions";
import { Download, BarChart3, AlertTriangle, TrendingUp, PackageX } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports — ShopOS" }] }),
  component: ReportsPage,
});

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n || 0);

const PIE_COLORS = [
  "hsl(var(--primary))",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
];

function downloadCsv(filename: string, rows: Array<Record<string, any>>) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((r) =>
      headers
        .map((h) => {
          const v = r[h];
          const s = v == null ? "" : String(v);
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(","),
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ReportsPage() {
  const { user } = AuthRoute.useRouteContext();
  const navigate = useNavigate();
  const profileFn = useServerFn(getMyProfile);
  const listFn = useServerFn(listMyShops);
  const seriesFn = useServerFn(salesTimeseries);
  const topFn = useServerFn(topProducts);
  const lowFn = useServerFn(lowStockReport);
  const profitFn = useServerFn(profitTimeseries);
  const topProfitFn = useServerFn(topProfitProducts);
  const slowFn = useServerFn(slowMovers);

  const [days, setDays] = useState(30);

  const shops = useQuery({ queryKey: ["my-shops"], queryFn: () => listFn() });
  const profile = useQuery({ queryKey: ["my-profile"], queryFn: () => profileFn() });
  const activeShop =
    shops.data?.find((s) => s.id === profile.data?.active_shop_id) ?? shops.data?.[0];

  const series = useQuery({
    queryKey: ["reports-series", activeShop?.id, days],
    queryFn: () => seriesFn({ data: { shop_id: activeShop!.id, days } }),
    enabled: !!activeShop?.id,
  });
  const top = useQuery({
    queryKey: ["reports-top", activeShop?.id, days],
    queryFn: () => topFn({ data: { shop_id: activeShop!.id, days } }),
    enabled: !!activeShop?.id,
  });
  const low = useQuery({
    queryKey: ["reports-low", activeShop?.id],
    queryFn: () => lowFn({ data: { shop_id: activeShop!.id } }),
    enabled: !!activeShop?.id,
  });
  const profit = useQuery({
    queryKey: ["reports-profit", activeShop?.id, days],
    queryFn: () => profitFn({ data: { shop_id: activeShop!.id, days } }),
    enabled: !!activeShop?.id,
  });
  const topProfit = useQuery({
    queryKey: ["reports-top-profit", activeShop?.id, days],
    queryFn: () => topProfitFn({ data: { shop_id: activeShop!.id, days } }),
    enabled: !!activeShop?.id,
  });
  const slow = useQuery({
    queryKey: ["reports-slow", activeShop?.id, days],
    queryFn: () => slowFn({ data: { shop_id: activeShop!.id, days } }),
    enabled: !!activeShop?.id,
  });

  const avgOrder = useMemo(() => {
    const t = series.data?.totals;
    if (!t || !t.orders) return 0;
    return t.sales / t.orders;
  }, [series.data]);

  if (!activeShop) {
    return (
      <AppShell userEmail={user?.email}>
        <div className="px-6 py-10 max-w-7xl mx-auto">
          <Card className="border-dashed">
            <CardContent className="py-16 text-center text-sm text-muted-foreground">
              Create a shop first to view reports.
              <div className="mt-4">
                <Button onClick={() => navigate({ to: "/onboarding" })}>
                  Create shop
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell userEmail={user?.email}>
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto w-full">
        <div className="flex items-end justify-between flex-wrap gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Sales, products and stock insights — exportable to CSV.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {[7, 30, 90].map((d) => (
              <Button
                key={d}
                size="sm"
                variant={days === d ? "default" : "outline"}
                onClick={() => setDays(d)}
              >
                {d}d
              </Button>
            ))}
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
          <Kpi label="Revenue" value={fmt(series.data?.totals.sales ?? 0)} />
          <Kpi
            label="Orders"
            value={String(series.data?.totals.orders ?? 0)}
          />
          <Kpi label="Avg. order" value={fmt(avgOrder)} />
          <Kpi label="Tax collected" value={fmt(series.data?.totals.tax ?? 0)} />
        </div>

        <Tabs defaultValue="sales" className="w-full">
          <div className="overflow-x-auto w-full scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0 mb-4">
            <TabsList className="inline-flex w-max sm:w-full bg-muted/60 p-1 rounded-lg">
              <TabsTrigger value="sales" className="text-xs sm:text-sm">Sales</TabsTrigger>
              <TabsTrigger value="profit" className="text-xs sm:text-sm">Profit</TabsTrigger>
              <TabsTrigger value="products" className="text-xs sm:text-sm">Top products</TabsTrigger>
              <TabsTrigger value="payments" className="text-xs sm:text-sm">Payments</TabsTrigger>
              <TabsTrigger value="stock" className="text-xs sm:text-sm">Stock alerts</TabsTrigger>
              <TabsTrigger value="slow" className="text-xs sm:text-sm">Slow movers</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="profit" className="mt-4 space-y-4">
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
              <Kpi label="Revenue" value={fmt(profit.data?.totals.revenue ?? 0)} />
              <Kpi label="Cost" value={fmt(profit.data?.totals.cost ?? 0)} />
              <Kpi label="Gross profit" value={fmt(profit.data?.totals.profit ?? 0)} />
              <Kpi
                label="Margin"
                value={`${(profit.data?.totals.margin ?? 0).toFixed(1)}%`}
              />
            </div>
            <Card className="border-border/60 shadow-soft">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> Profit trend
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    downloadCsv(
                      `profit-${days}d.csv`,
                      profit.data?.series ?? [],
                    )
                  }
                >
                  <Download className="h-4 w-4" /> CSV
                </Button>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  {profit.data && profit.data.series.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={profit.data.series}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 12 }}
                          stroke="hsl(var(--muted-foreground))"
                          tickFormatter={(v) =>
                            new Date(v).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                            })
                          }
                        />
                        <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                        <Tooltip
                          contentStyle={{
                            background: "hsl(var(--popover))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                          formatter={(v: number) => fmt(v)}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="cost" stroke="#f59e0b" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full grid place-items-center text-sm text-muted-foreground">
                      No data
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60 shadow-soft">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Most profitable products</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    downloadCsv(`top-profit-${days}d.csv`, topProfit.data ?? [])
                  }
                >
                  <Download className="h-4 w-4" /> CSV
                </Button>
              </CardHeader>
              <CardContent className="p-0 sm:p-6">
                <div className="overflow-x-auto w-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[150px]">Product</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">Cost</TableHead>
                        <TableHead className="text-right">Profit</TableHead>
                        <TableHead className="text-right">Margin</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(topProfit.data ?? []).map((p: any) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium truncate max-w-[180px]">{p.name}</TableCell>
                          <TableCell className="text-right">{p.qty}</TableCell>
                          <TableCell className="text-right">{fmt(p.revenue)}</TableCell>
                          <TableCell className="text-right">{fmt(p.cost)}</TableCell>
                          <TableCell className="text-right text-emerald-600 font-medium">
                            {fmt(p.profit)}
                          </TableCell>
                          <TableCell className="text-right">
                            {p.revenue > 0
                              ? `${((p.profit / p.revenue) * 100).toFixed(1)}%`
                              : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                      {(topProfit.data ?? []).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                            No data
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="slow" className="mt-4">
            <Card className="border-border/60 shadow-soft">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <PackageX className="h-4 w-4" /> Slow movers / dead stock
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadCsv(`slow-${days}d.csv`, slow.data ?? [])}
                >
                  <Download className="h-4 w-4" /> CSV
                </Button>
              </CardHeader>
              <CardContent className="p-0 sm:p-6">
                <p className="text-xs text-muted-foreground mb-4 px-4 sm:px-0">
                  Products with stock but no sales in the last {days} days.
                </p>
                <div className="overflow-x-auto w-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[150px]">Product</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead className="text-right">Stock</TableHead>
                        <TableHead className="text-right">Cost</TableHead>
                        <TableHead className="text-right">Stuck value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(slow.data ?? []).map((p: any) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium truncate max-w-[180px]">{p.name}</TableCell>
                          <TableCell className="text-muted-foreground">{p.sku || "—"}</TableCell>
                          <TableCell className="text-right">{p.stock_qty} {p.unit}</TableCell>
                          <TableCell className="text-right">{fmt(Number(p.cost_price || 0))}</TableCell>
                          <TableCell className="text-right font-medium">{fmt(p.stock_value)}</TableCell>
                        </TableRow>
                      ))}
                      {(slow.data ?? []).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                            No slow-moving items 🎉
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>


          <TabsContent value="sales" className="mt-4">
            <Card className="border-border/60 shadow-soft">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Daily revenue</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    downloadCsv(
                      `sales-${days}d.csv`,
                      series.data?.series ?? [],
                    )
                  }
                >
                  <Download className="h-4 w-4" /> CSV
                </Button>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  {series.data && series.data.series.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={series.data.series}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 12 }}
                          stroke="hsl(var(--muted-foreground))"
                          tickFormatter={(v) =>
                            new Date(v).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                            })
                          }
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
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line
                          type="monotone"
                          dataKey="sales"
                          name="Revenue"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <Empty message="No sales in this period." />
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="products" className="mt-4">
            <Card className="border-border/60 shadow-soft">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Top selling products</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    downloadCsv(`top-products-${days}d.csv`, top.data ?? [])
                  }
                >
                  <Download className="h-4 w-4" /> CSV
                </Button>
              </CardHeader>
              <CardContent>
                {top.data && top.data.length ? (
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={top.data.slice(0, 6)} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis
                            type="number"
                            tick={{ fontSize: 12 }}
                            stroke="hsl(var(--muted-foreground))"
                            tickFormatter={(v) =>
                              v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v
                            }
                          />
                          <YAxis
                            type="category"
                            dataKey="name"
                            tick={{ fontSize: 12 }}
                            width={100}
                            stroke="hsl(var(--muted-foreground))"
                          />
                          <Tooltip
                            contentStyle={{
                              background: "hsl(var(--popover))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: 8,
                              fontSize: 12,
                            }}
                            formatter={(v: number) => fmt(v)}
                          />
                          <Bar
                            dataKey="revenue"
                            fill="hsl(var(--primary))"
                            radius={[0, 4, 4, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="overflow-x-auto w-full">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[150px]">Product</TableHead>
                            <TableHead className="text-right">Qty</TableHead>
                            <TableHead className="text-right">Revenue</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {top.data.map((p) => (
                            <TableRow key={p.id}>
                              <TableCell className="font-medium truncate max-w-[180px]">{p.name}</TableCell>
                              <TableCell className="text-right">
                                {p.qty} {p.unit}
                              </TableCell>
                              <TableCell className="text-right">
                                {fmt(p.revenue)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : (
                  <Empty message="No product sales in this period." />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments" className="mt-4">
            <Card className="border-border/60 shadow-soft">
              <CardHeader>
                <CardTitle className="text-base">Payment methods</CardTitle>
              </CardHeader>
              <CardContent>
                {series.data?.payment_breakdown.length ? (
                  <div className="grid md:grid-cols-2 gap-6 items-center">
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={series.data.payment_breakdown}
                            dataKey="total"
                            nameKey="method"
                            innerRadius={50}
                            outerRadius={90}
                            paddingAngle={2}
                          >
                            {series.data.payment_breakdown.map((_, i) => (
                              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              background: "hsl(var(--popover))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: 8,
                              fontSize: 12,
                            }}
                            formatter={(v: number) => fmt(v)}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-2">
                      {series.data.payment_breakdown.map((p, i) => (
                        <div
                          key={p.method}
                          className="flex items-center justify-between p-3 rounded-md border border-border"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="h-3 w-3 rounded-sm"
                              style={{
                                background: PIE_COLORS[i % PIE_COLORS.length],
                              }}
                            />
                            <span className="capitalize text-sm font-medium">
                              {p.method}
                            </span>
                          </div>
                          <span className="text-sm">{fmt(p.total)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <Empty message="No payments recorded yet." />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stock" className="mt-4">
            <Card className="border-border/60 shadow-soft">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Low / Out of stock
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadCsv(`low-stock.csv`, low.data ?? [])}
                >
                  <Download className="h-4 w-4" /> CSV
                </Button>
              </CardHeader>
              <CardContent className="p-0 sm:p-6">
                {low.data && low.data.length ? (
                  <div className="overflow-x-auto w-full">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[150px]">Product</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead className="text-right">Stock</TableHead>
                          <TableHead className="text-right">Reorder at</TableHead>
                          <TableHead className="text-right">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {low.data.map((p: any) => (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium truncate max-w-[180px]">{p.name}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {p.sku || "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              {p.stock_qty} {p.unit}
                            </TableCell>
                            <TableCell className="text-right">
                              {p.reorder_level || 0}
                            </TableCell>
                            <TableCell className="text-right">
                              {Number(p.stock_qty) <= 0 ? (
                                <Badge variant="destructive">Out</Badge>
                              ) : (
                                <Badge variant="secondary">Low</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="p-6">
                    <Empty message="All products are above reorder level." />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card className="border-border/60 shadow-soft">
      <CardContent className="p-4 sm:p-5">
        <div className="text-[10px] sm:text-xs font-medium uppercase tracking-wide text-muted-foreground truncate">
          {label}
        </div>
        <div className="mt-1 sm:mt-2 text-lg sm:text-2xl font-bold tracking-tight truncate">{value}</div>
      </CardContent>
    </Card>
  );
}

function Empty({ message }: { message: string }) {
  return (
    <div className="h-64 rounded-md border border-dashed border-border grid place-items-center text-sm text-muted-foreground">
      <div className="flex flex-col items-center gap-2">
        <BarChart3 className="h-5 w-5" />
        {message}
      </div>
    </div>
  );
}
