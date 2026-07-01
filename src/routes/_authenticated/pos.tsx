import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Search,
  Trash2,
  Plus,
  Minus,
  ScanLine,
  Receipt,
  IndianRupee,
  Printer,
  X,
  Download,
  Send,
  Loader2,
} from "lucide-react";
import { Route as AuthRoute } from "./route";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getMyProfile, listMyShops } from "@/lib/shops.functions";
import { listProducts } from "@/lib/inventory.functions";
import {
  createSale,
  getSale,
  listSales,
  lookupProductByCode,
  salesSummary,
} from "@/lib/sales.functions";
import { listCustomers, upsertCustomer } from "@/lib/customers.functions";
import { User, UserPlus } from "lucide-react";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/pos")({
  head: () => ({ meta: [{ title: "Point of Sale — ShopOS" }] }),
  component: PosPage,
});

type Product = {
  id: string;
  name: string;
  unit: string;
  sale_price: number | string;
  tax_rate: number | string;
  stock_qty: number | string;
  track_stock: boolean;
  barcode?: string | null;
  sku?: string | null;
};

type CartItem = {
  product_id: string;
  name: string;
  unit: string;
  unit_price: number;
  tax_rate: number;
  quantity: number;
  discount: number;
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n || 0);
}

function PosPage() {
  const { user } = AuthRoute.useRouteContext();
  const getProfile = useServerFn(getMyProfile);
  const profileQ = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => getProfile(),
  });
  const shopId = profileQ.data?.active_shop_id ?? null;

  return (
    <AppShell userEmail={user?.email}>
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1400px] mx-auto w-full">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Point of Sale</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Scan, add to cart, take payment, print invoice.
            </p>
          </div>
        </div>
        {!shopId ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center text-muted-foreground">
              Set up a shop first to start selling.
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="register">
            <TabsList>
              <TabsTrigger value="register">Register</TabsTrigger>
              <TabsTrigger value="invoices">Invoices</TabsTrigger>
            </TabsList>
            <TabsContent value="register" className="mt-4">
              <Register shopId={shopId} />
            </TabsContent>
            <TabsContent value="invoices" className="mt-4">
              <Invoices shopId={shopId} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppShell>
  );
}

function Register({ shopId }: { shopId: string }) {
  const qc = useQueryClient();
  const list = useServerFn(listProducts);
  const lookup = useServerFn(lookupProductByCode);
  const create = useServerFn(createSale);
  const summary = useServerFn(salesSummary);

  const [search, setSearch] = useState("");
  const [scan, setScan] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [paid, setPaid] = useState<string>("");
  const [method, setMethod] = useState<"cash" | "card" | "upi" | "credit">("cash");
  const [customer, setCustomer] = useState<{ id: string | null; name: string; phone: string; balance: number; credit_limit: number }>({ id: null, name: "", phone: "", balance: 0, credit_limit: 0 });
  const [custOpen, setCustOpen] = useState(false);
  const [receipt, setReceipt] = useState<any | null>(null);
  const scanRef = useRef<HTMLInputElement>(null);

  const productsQ = useQuery({
    queryKey: ["pos-products", shopId, search],
    queryFn: () =>
      list({ data: { shop_id: shopId, search: search || null, limit: 60 } }),
  });
  const sumQ = useQuery({
    queryKey: ["sales-summary", shopId],
    queryFn: () => summary({ data: { shop_id: shopId } }),
  });

  const totals = useMemo(() => {
    let sub = 0;
    let tax = 0;
    cart.forEach((it) => {
      const gross = it.quantity * it.unit_price - (it.discount || 0);
      sub += gross;
      tax += (gross * (it.tax_rate || 0)) / 100;
    });
    const total = Math.max(0, sub + tax - (discount || 0));
    return { sub, tax, total };
  }, [cart, discount]);

  const addToCart = (p: Product) => {
    setCart((prev) => {
      const ex = prev.find((c) => c.product_id === p.id);
      if (ex)
        return prev.map((c) =>
          c.product_id === p.id ? { ...c, quantity: c.quantity + 1 } : c,
        );
      return [
        ...prev,
        {
          product_id: p.id,
          name: p.name,
          unit: p.unit,
          unit_price: Number(p.sale_price) || 0,
          tax_rate: Number(p.tax_rate) || 0,
          quantity: 1,
          discount: 0,
        },
      ];
    });
  };

  const updateQty = (id: string, q: number) => {
    if (q <= 0) return setCart((p) => p.filter((c) => c.product_id !== id));
    setCart((p) => p.map((c) => (c.product_id === id ? { ...c, quantity: q } : c)));
  };

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = scan.trim();
    if (!code) return;
    setScan("");
    try {
      const p = (await lookup({ data: { shop_id: shopId, code } })) as Product | null;
      if (!p) {
        toast.error("No product found for that code");
        return;
      }
      addToCart(p);
    } catch (err: any) {
      toast.error(err?.message || "Lookup failed");
    }
  };

  const checkout = useMutation({
    mutationFn: () =>
      create({
        data: {
          shop_id: shopId,
          customer_id: customer.id || null,
          customer_name: customer.name || null,
          customer_phone: customer.phone || null,
          discount: discount || 0,
          round_off: 0,
          amount_paid: Number(paid) || (method === "credit" ? 0 : totals.total),
          payment_method: method,
          notes: null,
          items: cart.map((c) => ({
            product_id: c.product_id,
            quantity: c.quantity,
            unit_price: c.unit_price,
            tax_rate: c.tax_rate,
            discount: c.discount || 0,
          })),
        },
      }),
    onSuccess: (sale: any) => {
      toast.success(`Sale ${sale.invoice_number} recorded`);
      setReceipt({ ...sale, items: cart, totals });
      setCart([]);
      setDiscount(0);
      setPaid("");
      setCustomer({ id: null, name: "", phone: "", balance: 0, credit_limit: 0 });
      setMethod("cash");
      qc.invalidateQueries({ queryKey: ["pos-products"] });
      qc.invalidateQueries({ queryKey: ["sales-summary"] });
      qc.invalidateQueries({ queryKey: ["sales-list"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["khata-summary"] });
      setTimeout(() => scanRef.current?.focus(), 100);
    },
    onError: (e: any) => toast.error(e?.message || "Could not save sale"),
  });

  // Hotkeys: F2 = focus scan, F9 = charge, Esc = clear cart
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        scanRef.current?.focus();
      } else if (e.key === "F9" && cart.length > 0 && !checkout.isPending) {
        e.preventDefault();
        checkout.mutate();
      } else if (e.key === "Escape" && cart.length > 0) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag !== "INPUT" && tag !== "TEXTAREA") setCart([]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cart, checkout]);

  // Credit limit warning
  const projectedBalance = customer.id
    ? customer.balance +
      Math.max(
        0,
        totals.total -
          (Number(paid) || (method === "credit" ? 0 : totals.total)),
      )
    : 0;
  const overLimit =
    customer.id &&
    customer.credit_limit > 0 &&
    projectedBalance > customer.credit_limit;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-4">
      {/* Left: products */}
      <div className="space-y-3">
        <form onSubmit={handleScan} className="flex gap-2">
          <div className="relative flex-1">
            <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={scanRef}
              autoFocus
              value={scan}
              onChange={(e) => setScan(e.target.value)}
              placeholder="Scan barcode or SKU · F2 to focus · F9 to charge"
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="secondary">Add</Button>
        </form>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products by name…"
            className="pl-9"
          />
        </div>
        <ScrollArea className="h-[calc(100vh-320px)] min-h-[400px] rounded-md border">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 p-2">
            {productsQ.isLoading ? (
              <div className="col-span-full text-center text-muted-foreground py-10">
                Loading…
              </div>
            ) : (productsQ.data ?? []).length === 0 ? (
              <div className="col-span-full text-center text-muted-foreground py-10">
                No products
              </div>
            ) : (
              (productsQ.data as Product[]).map((p) => {
                const out = p.track_stock && Number(p.stock_qty) <= 0;
                return (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    disabled={out}
                    className="text-left rounded-md border bg-card hover:bg-accent transition p-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="text-sm font-medium line-clamp-2">{p.name}</div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-sm font-semibold">
                        {fmt(Number(p.sale_price))}
                      </span>
                      {p.track_stock && (
                        <Badge variant={out ? "destructive" : "secondary"} className="text-[10px]">
                          {Number(p.stock_qty)} {p.unit}
                        </Badge>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right: cart */}
      <Card className="flex flex-col">
        <CardContent className="p-4 flex flex-col gap-3 flex-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-medium">
              <Receipt className="h-4 w-4" /> Current sale
            </div>
            {cart.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setCart([])}
                className="text-muted-foreground"
              >
                <X className="h-4 w-4 mr-1" /> Clear
              </Button>
            )}
          </div>

          <ScrollArea className="flex-1 min-h-[200px] -mx-1 px-1">
            {cart.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-10">
                Cart is empty — scan or tap a product
              </div>
            ) : (
              <div className="space-y-2">
                {cart.map((c) => (
                  <div
                    key={c.product_id}
                    className="rounded-md border p-2 flex flex-wrap items-center gap-2"
                  >
                    {/* Row 1 on mobile: product info + delete */}
                    <div className="flex-1 min-w-0 basis-[calc(100%-40px)] sm:basis-0">
                      <div className="text-sm font-medium truncate">{c.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {fmt(c.unit_price)} / {c.unit}
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground sm:order-last"
                      onClick={() => updateQty(c.product_id, 0)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    {/* Row 2 on mobile: qty controls + line total */}
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7"
                        onClick={() => updateQty(c.product_id, c.quantity - 1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <Input
                        value={c.quantity}
                        onChange={(e) =>
                          updateQty(c.product_id, Number(e.target.value) || 0)
                        }
                        className="h-7 w-12 text-center px-1"
                      />
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7"
                        onClick={() => updateQty(c.product_id, c.quantity + 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="ml-auto text-right text-sm font-medium">
                      {fmt(c.quantity * c.unit_price)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <div className="border-t pt-3 space-y-1.5 text-sm">
            <Row label="Subtotal" value={fmt(totals.sub)} />
            <Row label="Tax" value={fmt(totals.tax)} />
            <div className="flex items-center justify-between">
              <Label className="text-muted-foreground">Discount</Label>
              <Input
                type="number"
                value={discount || ""}
                onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                className="h-7 w-24 text-right"
              />
            </div>
            <div className="flex items-center justify-between text-base font-semibold pt-1">
              <span>Total</span>
              <span>{fmt(totals.total)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Payment</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as any)}>
                <SelectTrigger className="h-9 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="credit">Credit (unpaid)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Amount received</Label>
              <div className="relative mt-1">
                <IndianRupee className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="number"
                  value={paid}
                  placeholder={String(totals.total.toFixed(2))}
                  onChange={(e) => setPaid(e.target.value)}
                  className="h-9 pl-7"
                />
              </div>
            </div>
          </div>

          <CustomerPicker
            shopId={shopId}
            value={customer}
            onChange={setCustomer}
            open={custOpen}
            setOpen={setCustOpen}
          />

          {overLimit && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 text-destructive text-xs px-2 py-1.5">
              Warning: this sale will exceed credit limit ({fmt(customer.credit_limit)}). New balance: {fmt(projectedBalance)}.
            </div>
          )}

          <Button
            disabled={cart.length === 0 || checkout.isPending}
            onClick={() => checkout.mutate()}
            className="h-11 text-base"
          >
            {checkout.isPending ? "Saving…" : `Charge ${fmt(totals.total)} · F9`}
          </Button>

          {sumQ.data && (
            <div className="text-xs text-muted-foreground text-center pt-1">
              Today: {sumQ.data.today_count} sales · {fmt(Number(sumQ.data.today_value))}
            </div>
          )}
        </CardContent>
      </Card>


      <ReceiptDialog
        open={!!receipt}
        onClose={() => setReceipt(null)}
        sale={receipt}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

type CustState = { id: string | null; name: string; phone: string; balance: number; credit_limit: number };

function CustomerPicker({
  shopId,
  value,
  onChange,
  open,
  setOpen,
}: {
  shopId: string;
  value: CustState;
  onChange: (v: CustState) => void;
  open: boolean;
  setOpen: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listCustomers);
  const upsertFn = useServerFn(upsertCustomer);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [newCust, setNewCust] = useState({ name: "", phone: "", credit_limit: 0 });

  const list = useQuery({
    queryKey: ["pos-customers", shopId, q],
    queryFn: () => listFn({ data: { shop_id: shopId, search: q || null } }),
    enabled: open,
  });

  const create = useMutation({
    mutationFn: () =>
      upsertFn({
        data: {
          shop_id: shopId,
          name: newCust.name,
          phone: newCust.phone || null,
          credit_limit: Number(newCust.credit_limit) || 0,
        },
      }),
    onSuccess: (c: any) => {
      toast.success("Customer added");
      onChange({
        id: c.id,
        name: c.name,
        phone: c.phone || "",
        balance: Number(c.balance || 0),
        credit_limit: Number(c.credit_limit || 0),
      });
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["pos-customers"] });
      setCreating(false);
      setNewCust({ name: "", phone: "", credit_limit: 0 });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1 justify-start h-9 font-normal"
          onClick={() => setOpen(true)}
        >
          <User className="h-3.5 w-3.5" />
          {value.id ? (
            <span className="truncate">
              {value.name}
              {value.balance > 0 && (
                <span className="ml-2 text-xs text-destructive">
                  due {fmt(value.balance)}
                </span>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground">Walk-in customer</span>
          )}
        </Button>
        {value.id && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-9 w-9"
            onClick={() =>
              onChange({ id: null, name: "", phone: "", balance: 0, credit_limit: 0 })
            }
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Select customer</DialogTitle>
          </DialogHeader>
          {creating ? (
            <div className="space-y-3">
              <div>
                <Label>Name *</Label>
                <Input
                  autoFocus
                  value={newCust.name}
                  onChange={(e) => setNewCust({ ...newCust, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Phone</Label>
                  <Input
                    value={newCust.phone}
                    onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Credit limit</Label>
                  <Input
                    type="number"
                    value={newCust.credit_limit || ""}
                    onChange={(e) =>
                      setNewCust({ ...newCust, credit_limit: Number(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setCreating(false)}>
                  Back
                </Button>
                <Button
                  onClick={() => create.mutate()}
                  disabled={!newCust.name || create.isPending}
                >
                  {create.isPending ? "Saving…" : "Add & select"}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search by name…"
                  className="pl-9"
                />
              </div>
              <ScrollArea className="max-h-[320px] -mx-2 px-2">
                <div className="space-y-1">
                  {(list.data ?? []).length === 0 ? (
                    <div className="text-center text-sm text-muted-foreground py-6">
                      No customers found
                    </div>
                  ) : (
                    (list.data as any[]).map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          onChange({
                            id: c.id,
                            name: c.name,
                            phone: c.phone || "",
                            balance: Number(c.balance || 0),
                            credit_limit: Number(c.credit_limit || 0),
                          });
                          setOpen(false);
                        }}
                        className="w-full flex items-center justify-between rounded-md border p-2 hover:bg-accent text-left"
                      >
                        <div>
                          <div className="text-sm font-medium">{c.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {c.phone || "—"}
                          </div>
                        </div>
                        {Number(c.balance) > 0 && (
                          <Badge variant="destructive">{fmt(Number(c.balance))}</Badge>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreating(true)}>
                  <UserPlus className="h-4 w-4" /> New customer
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}


async function generateReceiptPDF(sale: any, shopName: string) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: [80, 200] }); // 80mm thermal receipt width
  const w = 80;
  const margin = 5;
  const pw = w - margin * 2; // printable width
  let y = 8;

  const fmtAmt = (n: number) => `₹${n.toFixed(2)}`;

  // Shop name
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(shopName.toUpperCase(), w / 2, y, { align: "center" });
  y += 5;

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("Retail Invoice", w / 2, y, { align: "center" });
  y += 4;

  // Dashed separator
  doc.setLineDashPattern([1, 1], 0);
  doc.setLineWidth(0.2);
  doc.line(margin, y, w - margin, y);
  y += 4;

  // Invoice number & date
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(`INVOICE ${sale.invoice_number}`, w / 2, y, { align: "center" });
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  const dateStr = new Date(sale.invoice_date || Date.now()).toLocaleString("en-IN", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
  doc.text(dateStr, w / 2, y, { align: "center" });
  y += 3;

  if (sale.customer_name) {
    y += 1;
    doc.setFontSize(7);
    doc.text(`Customer: ${sale.customer_name}`, margin, y);
    y += 3;
  }

  // Separator
  y += 1;
  doc.line(margin, y, w - margin, y);
  y += 4;

  // Items header
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("Item", margin, y);
  doc.text("Amt", w - margin, y, { align: "right" });
  y += 3;
  doc.setFont("helvetica", "normal");

  // Items
  (sale.items || []).forEach((it: any) => {
    const name = it.name || it.product?.name || "Product";
    const qty = it.quantity;
    const price = Number(it.unit_price);
    const lineTotal = qty * price;

    // Item name (truncate if too long)
    const displayName = name.length > 28 ? name.substring(0, 26) + "…" : name;
    doc.text(displayName, margin, y);
    doc.text(fmtAmt(lineTotal), w - margin, y, { align: "right" });
    y += 3;

    // Qty x Price detail
    doc.setFontSize(6);
    doc.text(`  ${qty} × ${fmtAmt(price)}`, margin, y);
    y += 3.5;
    doc.setFontSize(7);

    // Add page if needed
    if (y > 185) {
      doc.addPage([80, 200]);
      y = 8;
    }
  });

  // Separator
  doc.line(margin, y, w - margin, y);
  y += 4;

  // Totals
  const addRow = (label: string, value: string, bold = false) => {
    if (bold) doc.setFont("helvetica", "bold");
    doc.text(label, margin, y);
    doc.text(value, w - margin, y, { align: "right" });
    if (bold) doc.setFont("helvetica", "normal");
    y += 3.5;
  };

  doc.setFontSize(7);
  addRow("Subtotal", fmtAmt(Number(sale.subtotal)));
  addRow("Tax", fmtAmt(Number(sale.tax_total)));
  if (Number(sale.discount) > 0) {
    addRow("Discount", `-${fmtAmt(Number(sale.discount))}`);
  }
  y += 1;
  doc.setFontSize(9);
  addRow("TOTAL", fmtAmt(Number(sale.total)), true);
  doc.setFontSize(7);
  addRow(`Paid (${sale.payment_method})`, fmtAmt(Number(sale.amount_paid)));
  if (Number(sale.change_due) > 0) {
    addRow("Change", fmtAmt(Number(sale.change_due)));
  }

  // Footer separator
  y += 2;
  doc.line(margin, y, w - margin, y);
  y += 4;

  doc.setFontSize(7);
  doc.text("Thank you!", w / 2, y, { align: "center" });

  // Save
  doc.save(`Invoice_${sale.invoice_number}.pdf`);
}

function ReceiptDialog({
  open,
  onClose,
  sale,
}: {
  open: boolean;
  onClose: () => void;
  sale: any | null;
}) {
  const printRef = useRef<HTMLDivElement>(null);
  const getProfile = useServerFn(getMyProfile);
  const listShops = useServerFn(listMyShops);

  const profileQ = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => getProfile(),
    enabled: open,
  });

  const shopsQ = useQuery({
    queryKey: ["my-shops"],
    queryFn: () => listShops(),
    enabled: open,
  });

  const activeShopName = useMemo(() => {
    const activeShopId = profileQ.data?.active_shop_id;
    const shop = shopsQ.data?.find((s) => s.id === activeShopId);
    return shop?.name || "My Shop";
  }, [profileQ.data?.active_shop_id, shopsQ.data]);

  const [downloading, setDownloading] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState("");

  // Sync whatsapp phone state when sale changes
  useEffect(() => {
    if (sale?.customer_phone) {
      const clean = sale.customer_phone.replace(/\D/g, "");
      setWhatsappPhone(clean);
    } else {
      setWhatsappPhone("");
    }
  }, [sale]);

  if (!sale) return null;

  const handlePrint = () => {
    const w = window.open("", "_blank", "width=380,height=600");
    if (!w || !printRef.current) return;
    w.document.write(`<html><head><title>${sale.invoice_number}</title>
      <style>
        body{font-family:ui-monospace,Menlo,monospace;font-size:12px;padding:12px;color:#000}
        h1{font-size:14px;margin:0 0 4px;text-align:center}
        table{width:100%;border-collapse:collapse;margin-top:8px}
        td{padding:2px 0}
        .right{text-align:right}
        .sep{border-top:1px dashed #999;margin:8px 0}
      </style></head><body>${printRef.current.innerHTML}</body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      await generateReceiptPDF(sale, activeShopName);
      toast.success("PDF downloaded successfully");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PDF");
    } finally {
      setDownloading(false);
    }
  };

  const handleWhatsAppShare = () => {
    let phoneNum = whatsappPhone.trim().replace(/\D/g, "");
    if (!phoneNum) {
      toast.error("Please enter a valid phone number");
      return;
    }
    
    if (phoneNum.length === 10) {
      phoneNum = "91" + phoneNum;
    }

    const itemsText = (sale.items || []).map((it: any) => {
      const name = it.name || it.product?.name || "Product";
      const qty = it.quantity;
      const price = Number(it.unit_price);
      const total = qty * price;
      return `• ${name}\n  ${qty} × ₹${price.toFixed(2)} = ₹${total.toFixed(2)}`;
    }).join("\n");

    const taxStr = Number(sale.tax_total) > 0 ? `\n*Tax*: ₹${Number(sale.tax_total).toFixed(2)}` : "";
    const discountStr = Number(sale.discount) > 0 ? `\n*Discount*: -₹${Number(sale.discount).toFixed(2)}` : "";

    const messageText = 
`*${activeShopName}* 🛍️
*Invoice*: ${sale.invoice_number}
*Date*: ${new Date(sale.invoice_date).toLocaleDateString("en-IN")}

--------------------------------
${itemsText}
--------------------------------
*Subtotal*: ₹${Number(sale.subtotal).toFixed(2)}${taxStr}${discountStr}
*Total*: *₹${Number(sale.total).toFixed(2)}*
*Paid (${sale.payment_method})*: ₹${Number(sale.amount_paid).toFixed(2)}

*Thank you for shopping with us!* 🙏`;

    const url = `https://api.whatsapp.com/send?phone=${phoneNum}&text=${encodeURIComponent(messageText)}`;
    window.open(url, "_blank");
    toast.success("Opening WhatsApp chat...");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sale complete</DialogTitle>
        </DialogHeader>
        <div
          ref={printRef}
          className="rounded-md border bg-white text-black p-6 font-mono text-xs shadow-sm"
        >
          {/* Shop Header */}
          <div className="text-center" style={{ marginBottom: 12 }}>
            <div style={{ fontSize: "16px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "1px" }}>
              {activeShopName}
            </div>
            <div style={{ fontSize: "10px", color: "#666", marginTop: "2px" }}>
              Retail Invoice
            </div>
          </div>

          <h1 style={{ textAlign: "center", fontWeight: 600, fontSize: "12px", borderTop: "1px dashed #ccc", borderBottom: "1px dashed #ccc", padding: "4px 0", margin: "8px 0" }}>
            INVOICE {sale.invoice_number}
          </h1>
          <div className="text-center" style={{ color: "#555", fontSize: "10px" }}>
            {new Date(sale.invoice_date || Date.now()).toLocaleString("en-IN", {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit"
            })}
          </div>
          {sale.customer_name && (
            <div className="mt-2" style={{ fontWeight: 500 }}>Customer: {sale.customer_name}</div>
          )}
          <div className="sep" style={{ borderTop: "1px dashed #999", margin: "8px 0" }} />
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {(sale.items || []).map((it: any, i: number) => (
                <tr key={i}>
                  <td style={{ padding: "4px 0" }}>
                    <div style={{ fontWeight: 500 }}>{it.name || it.product?.name}</div>
                    <div style={{ color: "#666", fontSize: "10px" }}>
                      {it.quantity} × {fmt(Number(it.unit_price))}
                    </div>
                  </td>
                  <td className="right" style={{ textAlign: "right", padding: "4px 0", fontWeight: 500 }}>
                    {fmt(it.quantity * Number(it.unit_price))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="sep" style={{ borderTop: "1px dashed #999", margin: "8px 0" }} />
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              <tr>
                <td style={{ padding: "2px 0" }}>Subtotal</td>
                <td className="right" style={{ textAlign: "right", padding: "2px 0" }}>
                  {fmt(Number(sale.subtotal))}
                </td>
              </tr>
              <tr>
                <td style={{ padding: "2px 0" }}>Tax</td>
                <td className="right" style={{ textAlign: "right", padding: "2px 0" }}>
                  {fmt(Number(sale.tax_total))}
                </td>
              </tr>
              {Number(sale.discount) > 0 && (
                <tr>
                  <td style={{ padding: "2px 0" }}>Discount</td>
                  <td className="right" style={{ textAlign: "right", padding: "2px 0" }}>
                    -{fmt(Number(sale.discount))}
                  </td>
                </tr>
              )}
              <tr style={{ fontWeight: 700, fontSize: "13px" }}>
                <td style={{ padding: "4px 0" }}>Total</td>
                <td className="right" style={{ textAlign: "right", padding: "4px 0" }}>
                  {fmt(Number(sale.total))}
                </td>
              </tr>
              <tr>
                <td style={{ padding: "2px 0" }}>Paid ({sale.payment_method})</td>
                <td className="right" style={{ textAlign: "right", padding: "2px 0" }}>
                  {fmt(Number(sale.amount_paid))}
                </td>
              </tr>
              {Number(sale.change_due) > 0 && (
                <tr>
                  <td style={{ padding: "2px 0" }}>Change</td>
                  <td className="right" style={{ textAlign: "right", padding: "2px 0" }}>
                    {fmt(Number(sale.change_due))}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="text-center" style={{ marginTop: 14, fontStyle: "italic", borderTop: "1px dashed #ccc", paddingTop: "8px" }}>
            Thank you!
          </div>
        </div>
        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-2">
          {/* WhatsApp share widget */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto mr-auto">
            <span className="text-xs text-muted-foreground font-medium">WhatsApp:</span>
            <Input
              type="text"
              placeholder="Phone number"
              value={whatsappPhone}
              onChange={(e) => setWhatsappPhone(e.target.value)}
              className="h-8 text-xs w-28"
            />
            <Button size="sm" variant="outline" className="h-8 gap-1 text-xs border-emerald-500/30 hover:bg-emerald-50/50 hover:text-emerald-600 dark:hover:bg-emerald-950/20" onClick={handleWhatsAppShare}>
              <Send className="h-3 w-3 text-emerald-500 fill-emerald-500/20" /> Share
            </Button>
          </div>

          <div className="flex gap-2 w-full sm:w-auto justify-end">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onClose}>
              New sale
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handlePrint}>
              <Printer className="h-3.5 w-3.5 mr-1" /> Print
            </Button>
            <Button size="sm" className="h-8 text-xs gap-1" disabled={downloading} onClick={handleDownloadPDF}>
              {downloading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Download PDF
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Invoices({ shopId }: { shopId: string }) {
  const list = useServerFn(listSales);
  const get = useServerFn(getSale);
  const [openId, setOpenId] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["sales-list", shopId],
    queryFn: () => list({ data: { shop_id: shopId } }),
  });
  const detailQ = useQuery({
    queryKey: ["sale-detail", openId],
    queryFn: () => get({ data: { id: openId!, shop_id: shopId } }),
    enabled: !!openId,
  });

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                  Loading…
                </TableCell>
              </TableRow>
            ) : (q.data ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                  No sales yet
                </TableCell>
              </TableRow>
            ) : (
              (q.data as any[]).map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.invoice_number}</TableCell>
                  <TableCell>{new Date(s.invoice_date).toLocaleString()}</TableCell>
                  <TableCell>{s.customer_name || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={s.payment_status === "paid" ? "secondary" : "outline"}>
                      {s.payment_method} · {s.payment_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{fmt(Number(s.total))}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => setOpenId(s.id)}>
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
      <ReceiptDialog
        open={!!openId}
        onClose={() => setOpenId(null)}
        sale={detailQ.data ?? null}
      />
    </Card>
  );
}
