import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Trash2,
  Plus,
  Minus,
  ScanLine,
  IndianRupee,
  Camera,
  Loader2,
  ShoppingCart,
} from "lucide-react";
import { Route as AuthRoute } from "./route";
import { AppShell } from "@/components/layout/AppShell";
import { InlineScanner } from "@/components/BarcodeScanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getMyProfile, listMyShops } from "@/lib/shops.functions";
import { listProducts } from "@/lib/inventory.functions";
import {
  createSale,
  lookupProductByCode,
  salesSummary,
} from "@/lib/sales.functions";

export const Route = createFileRoute("/_authenticated/scanner")({
  head: () => ({ meta: [{ title: "Scanner — ShopOS" }] }),
  component: ScannerPage,
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

function ScannerPage() {
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
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <Camera className="h-6 w-6 text-primary" />
              Barcode Scanner
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Scan products with your camera to add them to cart and bill instantly.
            </p>
          </div>
        </div>
        {!shopId ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center text-muted-foreground">
              Set up a shop first to start scanning.
            </CardContent>
          </Card>
        ) : (
          <ScannerRegister shopId={shopId} />
        )}
      </div>
    </AppShell>
  );
}

function ScannerRegister({ shopId }: { shopId: string }) {
  const qc = useQueryClient();
  const lookup = useServerFn(lookupProductByCode);
  const create = useServerFn(createSale);
  const summaryFn = useServerFn(salesSummary);
  const shopsListFn = useServerFn(listMyShops);
  const profileFn = useServerFn(getMyProfile);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [paid, setPaid] = useState<string>("");
  const [method, setMethod] = useState<"cash" | "card" | "upi">("cash");
  const [manualCode, setManualCode] = useState("");
  const [lastScanned, setLastScanned] = useState<string | null>(null);

  const sumQ = useQuery({
    queryKey: ["sales-summary", shopId],
    queryFn: () => summaryFn({ data: { shop_id: shopId } }),
  });

  // Get active shop name
  const profileQ = useQuery({ queryKey: ["my-profile"], queryFn: () => profileFn() });
  const shopsQ = useQuery({
    queryKey: ["my-shops"],
    queryFn: () => shopsListFn(),
    enabled: !!profileQ.data,
  });
  const activeShopName = useMemo(() => {
    const sid = profileQ.data?.active_shop_id;
    if (!sid || !shopsQ.data) return "Shop";
    const found = (shopsQ.data as any[]).find((s: any) => s.id === sid);
    return found?.name || "Shop";
  }, [profileQ.data, shopsQ.data]);

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

  const addToCart = useCallback((p: Product) => {
    setCart((prev) => {
      const ex = prev.find((c) => c.product_id === p.id);
      if (ex)
        return prev.map((c) =>
          c.product_id === p.id ? { ...c, quantity: c.quantity + 1 } : c
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
  }, []);

  const updateQty = (id: string, q: number) => {
    if (q <= 0) return setCart((p) => p.filter((c) => c.product_id !== id));
    setCart((p) =>
      p.map((c) => (c.product_id === id ? { ...c, quantity: q } : c))
    );
  };

  const handleBarcodeScan = useCallback(
    async (code: string) => {
      setLastScanned(code);
      try {
        const p = (await lookup({
          data: { shop_id: shopId, code },
        })) as Product | null;
        if (!p) {
          toast.error(`No product found for: ${code}`);
          return;
        }
        addToCart(p);
        toast.success(`${p.name} added`);
      } catch (err: any) {
        toast.error("Could not find product for this barcode");
      }
    },
    [shopId, lookup, addToCart]
  );

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = manualCode.trim();
    if (code) {
      handleBarcodeScan(code);
      setManualCode("");
    }
  };

  const checkout = useMutation({
    mutationFn: () =>
      create({
        data: {
          shop_id: shopId,
          customer_id: null,
          customer_name: null,
          customer_phone: null,
          discount: discount || 0,
          round_off: 0,
          amount_paid: Number(paid) || totals.total,
          payment_method: method,
          notes: "Scanned sale",
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
      toast.success(`Sale ${sale.invoice_number} recorded!`);
      setCart([]);
      setDiscount(0);
      setPaid("");
      setMethod("cash");
      setLastScanned(null);
      qc.invalidateQueries({ queryKey: ["pos-products"] });
      qc.invalidateQueries({ queryKey: ["sales-summary"] });
      qc.invalidateQueries({ queryKey: ["sales-list"] });
    },
    onError: (e: any) => toast.error(e?.message || "Could not save sale"),
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">
      {/* Left: Scanner + manual entry */}
      <div className="space-y-4">
        {/* Camera scanner */}
        <InlineScanner onScan={handleBarcodeScan} active={true} />

        {/* Manual barcode entry */}
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Enter barcode or SKU manually..."
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="secondary">
            Add
          </Button>
        </form>

        {lastScanned && (
          <div className="text-xs text-muted-foreground text-center">
            Last scanned:{" "}
            <span className="font-mono font-medium text-foreground">
              {lastScanned}
            </span>
          </div>
        )}
      </div>

      {/* Right: Cart + Checkout */}
      <Card className="h-fit">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <ShoppingCart className="h-4 w-4" /> Cart
            </h3>
            <Badge variant="secondary">{cart.length} items</Badge>
          </div>

          {cart.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Camera className="h-8 w-8 mx-auto mb-2 opacity-40" />
              Scan a product barcode to add it here
            </div>
          ) : (
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-2">
                {cart.map((item) => (
                  <div
                    key={item.product_id}
                    className="flex items-center gap-2 rounded-md border p-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {item.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {fmt(item.unit_price)} × {item.quantity}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-6 w-6"
                        onClick={() =>
                          updateQty(item.product_id, item.quantity - 1)
                        }
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-6 text-center text-sm font-medium">
                        {item.quantity}
                      </span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-6 w-6"
                        onClick={() =>
                          updateQty(item.product_id, item.quantity + 1)
                        }
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-destructive"
                        onClick={() => updateQty(item.product_id, 0)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="text-sm font-medium w-16 text-right">
                      {fmt(item.quantity * item.unit_price)}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {cart.length > 0 && (
            <>
              <div className="border-t pt-3 space-y-1.5 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="text-foreground">{fmt(totals.sub)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax</span>
                  <span className="text-foreground">{fmt(totals.tax)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Discount</span>
                    <span className="text-foreground">-{fmt(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-semibold pt-1 border-t">
                  <span>Total</span>
                  <span className="text-primary">{fmt(totals.total)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-1">
                  <Label className="text-xs">Payment</Label>
                  <Select
                    value={method}
                    onValueChange={(v) =>
                      setMethod(v as "cash" | "card" | "upi")
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="upi">UPI</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Discount</Label>
                  <Input
                    type="number"
                    className="h-8 text-xs"
                    value={discount || ""}
                    onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                    placeholder="0"
                  />
                </div>
              </div>

              <Button
                className="w-full h-11"
                disabled={cart.length === 0 || checkout.isPending}
                onClick={() => checkout.mutate()}
              >
                {checkout.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1" /> Saving…
                  </>
                ) : (
                  <>
                    <IndianRupee className="h-4 w-4 mr-1" /> Charge{" "}
                    {fmt(totals.total)}
                  </>
                )}
              </Button>
            </>
          )}

          {sumQ.data && (
            <div className="text-xs text-muted-foreground text-center pt-1 border-t">
              Today: {sumQ.data.today_count} sales ·{" "}
              {fmt(Number(sumQ.data.today_value))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
