import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Truck,
  Receipt,
  IndianRupee,
  Eye,
  Pencil,
  MoreHorizontal,
} from "lucide-react";
import { Route as AuthRoute } from "./route";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getMyProfile, listMyShops } from "@/lib/shops.functions";
import { listProducts } from "@/lib/inventory.functions";
import {
  createPurchase,
  createSupplier,
  deletePurchase,
  deleteSupplier,
  getPurchase,
  listPurchases,
  listSuppliers,
  purchaseSummary,
  updateSupplier,
} from "@/lib/purchases.functions";

export const Route = createFileRoute("/_authenticated/purchases")({
  head: () => ({ meta: [{ title: "Purchases — ShopOS" }] }),
  component: PurchasesPage,
});

type Supplier = {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  gstin: string | null;
  notes: string | null;
  is_active: boolean;
};

type PurchaseRow = {
  id: string;
  invoice_number: string | null;
  invoice_date: string;
  total: number | string;
  amount_paid: number | string;
  payment_status: string;
  supplier?: { id: string; name: string } | null;
};

type ProductLite = {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  cost_price: number | string;
  tax_rate: number | string;
};

function PurchasesPage() {
  const { user } = AuthRoute.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const profileFn = useServerFn(getMyProfile);
  const shopsFn = useServerFn(listMyShops);
  const profile = useQuery({ queryKey: ["my-profile"], queryFn: () => profileFn() });
  const shops = useQuery({ queryKey: ["my-shops"], queryFn: () => shopsFn() });
  const shopId = profile.data?.active_shop_id || shops.data?.[0]?.id || null;

  useEffect(() => {
    if (shops.isSuccess && (shops.data?.length ?? 0) === 0) {
      navigate({ to: "/onboarding", replace: true });
    }
  }, [shops.isSuccess, shops.data, navigate]);

  const currency = shops.data?.find((s) => s.id === shopId)?.currency ?? "INR";
  const fmt = (n: number | string) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(Number(n) || 0);

  const summaryFn = useServerFn(purchaseSummary);
  const summary = useQuery({
    queryKey: ["purchase-summary", shopId],
    queryFn: () => summaryFn({ data: { shop_id: shopId! } }),
    enabled: !!shopId,
  });

  const [tab, setTab] = useState<"purchases" | "suppliers">("purchases");

  return (
    <AppShell userEmail={user?.email}>
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto w-full space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Purchases</h1>
            <p className="text-sm text-muted-foreground">
              Record purchase entries and manage suppliers
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <SummaryCard
            label="Total purchases"
            value={String(summary.data?.total_purchases ?? 0)}
            icon={<Receipt className="h-4 w-4" />}
          />
          <SummaryCard
            label="Purchase value"
            value={fmt(summary.data?.total_value ?? 0)}
            icon={<IndianRupee className="h-4 w-4" />}
          />
          <SummaryCard
            label="Paid"
            value={fmt(summary.data?.total_paid ?? 0)}
            icon={<IndianRupee className="h-4 w-4" />}
          />
          <SummaryCard
            label="Outstanding"
            value={fmt(summary.data?.total_due ?? 0)}
            icon={<IndianRupee className="h-4 w-4" />}
            accent
          />
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="purchases">Purchase entries</TabsTrigger>
            <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
          </TabsList>
          <TabsContent value="purchases" className="mt-4">
            {shopId && <PurchasesTab shopId={shopId} fmt={fmt} qc={qc} />}
          </TabsContent>
          <TabsContent value="suppliers" className="mt-4">
            {shopId && <SuppliersTab shopId={shopId} qc={qc} />}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs uppercase tracking-wide">{label}</span>
          {icon}
        </div>
        <div className={`mt-2 text-xl font-semibold ${accent ? "text-destructive" : ""}`}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------- Purchases tab ----------------
function PurchasesTab({
  shopId,
  fmt,
  qc,
}: {
  shopId: string;
  fmt: (n: number | string) => string;
  qc: ReturnType<typeof useQueryClient>;
}) {
  const listFn = useServerFn(listPurchases);
  const list = useQuery({
    queryKey: ["purchases", shopId],
    queryFn: () => listFn({ data: { shop_id: shopId } }),
  });
  const [showEntry, setShowEntry] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<PurchaseRow | null>(null);

  const delFn = useServerFn(deletePurchase);
  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id, shop_id: shopId } }),
    onSuccess: () => {
      toast.success("Purchase deleted, stock reversed");
      qc.invalidateQueries({ queryKey: ["purchases"] });
      qc.invalidateQueries({ queryKey: ["purchase-summary"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["inv-summary"] });
      setConfirmDel(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = (list.data ?? []) as PurchaseRow[];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowEntry(true)}>
          <Plus className="h-4 w-4 mr-1" /> New purchase
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Invoice #</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No purchases yet. Create your first purchase entry.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.invoice_date}</TableCell>
                    <TableCell className="font-medium">{r.invoice_number || "—"}</TableCell>
                    <TableCell>{r.supplier?.name || "—"}</TableCell>
                    <TableCell className="text-right">{fmt(r.total)}</TableCell>
                    <TableCell className="text-right">{fmt(r.amount_paid)}</TableCell>
                    <TableCell>
                      <Badge variant={r.payment_status === "paid" ? "default" : "secondary"}>
                        {r.payment_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setViewing(r.id)}>
                            <Eye className="h-4 w-4 mr-2" /> View details
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setConfirmDel(r)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {showEntry && (
        <PurchaseEntryDialog
          shopId={shopId}
          fmt={fmt}
          onClose={() => setShowEntry(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["purchases"] });
            qc.invalidateQueries({ queryKey: ["purchase-summary"] });
            qc.invalidateQueries({ queryKey: ["products"] });
            qc.invalidateQueries({ queryKey: ["inv-summary"] });
            setShowEntry(false);
          }}
        />
      )}

      {viewing && (
        <PurchaseViewDialog
          id={viewing}
          shopId={shopId}
          fmt={fmt}
          onClose={() => setViewing(null)}
        />
      )}

      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this purchase?</AlertDialogTitle>
            <AlertDialogDescription>
              Stock added by this purchase will be reversed via an adjustment entry. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDel && delMut.mutate(confirmDel.id)}
              disabled={delMut.isPending}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------- Purchase entry dialog ----------
type Line = {
  product_id: string;
  quantity: number;
  unit_cost: number;
  tax_rate: number;
  discount: number;
};

function PurchaseEntryDialog({
  shopId,
  fmt,
  onClose,
  onSaved,
}: {
  shopId: string;
  fmt: (n: number | string) => string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const productsFn = useServerFn(listProducts);
  const suppliersFn = useServerFn(listSuppliers);

  const products = useQuery({
    queryKey: ["products", shopId, "", "all", "all"],
    queryFn: () =>
      productsFn({
        data: { shop_id: shopId, search: null, category_id: null, only_low: false, limit: 500 },
      }),
  });
  const suppliers = useQuery({
    queryKey: ["suppliers", shopId],
    queryFn: () => suppliersFn({ data: { shop_id: shopId, search: null } }),
  });

  const [supplierId, setSupplierId] = useState<string>("none");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [otherCharges, setOtherCharges] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [amountPaid, setAmountPaid] = useState(0);
  const [lines, setLines] = useState<Line[]>([]);

  const productList = (products.data ?? []) as ProductLite[];

  const addLine = () => {
    setLines((ls) => [
      ...ls,
      { product_id: "", quantity: 1, unit_cost: 0, tax_rate: 0, discount: 0 },
    ]);
  };
  const removeLine = (i: number) => setLines((ls) => ls.filter((_, idx) => idx !== i));
  const updateLine = (i: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const onPickProduct = (i: number, pid: string) => {
    const p = productList.find((x) => x.id === pid);
    updateLine(i, {
      product_id: pid,
      unit_cost: p ? Number(p.cost_price) || 0 : 0,
      tax_rate: p ? Number(p.tax_rate) || 0 : 0,
    });
  };

  const totals = useMemo(() => {
    let subtotal = 0;
    let tax = 0;
    for (const l of lines) {
      const gross = l.quantity * l.unit_cost - (l.discount || 0);
      subtotal += gross;
      tax += (gross * (l.tax_rate || 0)) / 100;
    }
    const total = subtotal + tax + (otherCharges || 0) - (discount || 0);
    return { subtotal, tax, total };
  }, [lines, otherCharges, discount]);

  const paymentStatus: "unpaid" | "partial" | "paid" =
    amountPaid <= 0 ? "unpaid" : amountPaid >= totals.total ? "paid" : "partial";

  const createFn = useServerFn(createPurchase);
  const mut = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          shop_id: shopId,
          supplier_id: supplierId === "none" ? null : supplierId,
          invoice_number: invoiceNumber || null,
          invoice_date: invoiceDate,
          other_charges: otherCharges,
          discount,
          amount_paid: amountPaid,
          payment_status: paymentStatus,
          notes: notes || null,
          items: lines.map((l) => ({
            product_id: l.product_id,
            quantity: Number(l.quantity),
            unit_cost: Number(l.unit_cost),
            tax_rate: Number(l.tax_rate) || 0,
            discount: Number(l.discount) || 0,
          })),
        },
      }),
    onSuccess: () => {
      toast.success("Purchase recorded — stock updated");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSubmit =
    lines.length > 0 &&
    lines.every((l) => l.product_id && l.quantity > 0) &&
    !mut.isPending;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>New purchase entry</DialogTitle>
          <DialogDescription>
            Adding line items will increase product stock and record movement history.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <Label>Supplier</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None —</SelectItem>
                {(suppliers.data ?? []).map((s: Supplier) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Invoice #</Label>
            <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
          </div>
          <div>
            <Label>Invoice date</Label>
            <Input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Items</Label>
            <Button size="sm" variant="outline" onClick={addLine}>
              <Plus className="h-4 w-4 mr-1" /> Add item
            </Button>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="w-20">Qty</TableHead>
                  <TableHead className="w-28">Cost</TableHead>
                  <TableHead className="w-20">Tax %</TableHead>
                  <TableHead className="w-24">Discount</TableHead>
                  <TableHead className="w-28 text-right">Line total</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                      No items. Click “Add item”.
                    </TableCell>
                  </TableRow>
                ) : (
                  lines.map((l, i) => {
                    const gross = l.quantity * l.unit_cost - (l.discount || 0);
                    const lineTotal = gross + (gross * (l.tax_rate || 0)) / 100;
                    return (
                      <TableRow key={i}>
                        <TableCell>
                          <Select
                            value={l.product_id}
                            onValueChange={(v) => onPickProduct(i, v)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select product" />
                            </SelectTrigger>
                            <SelectContent>
                              {productList.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name}
                                  {p.sku ? ` · ${p.sku}` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            step="any"
                            value={l.quantity}
                            onChange={(e) =>
                              updateLine(i, { quantity: Number(e.target.value) })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            step="any"
                            value={l.unit_cost}
                            onChange={(e) =>
                              updateLine(i, { unit_cost: Number(e.target.value) })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            step="any"
                            value={l.tax_rate}
                            onChange={(e) =>
                              updateLine(i, { tax_rate: Number(e.target.value) })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            step="any"
                            value={l.discount}
                            onChange={(e) =>
                              updateLine(i, { discount: Number(e.target.value) })
                            }
                          />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fmt(lineTotal)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeLine(i)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
          </div>
          <div className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-2 items-center">
              <Label>Other charges</Label>
              <Input
                type="number"
                min={0}
                step="any"
                value={otherCharges}
                onChange={(e) => setOtherCharges(Number(e.target.value))}
              />
              <Label>Bill discount</Label>
              <Input
                type="number"
                min={0}
                step="any"
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value))}
              />
              <Label>Amount paid</Label>
              <Input
                type="number"
                min={0}
                step="any"
                value={amountPaid}
                onChange={(e) => setAmountPaid(Number(e.target.value))}
              />
            </div>
            <div className="rounded-md border p-3 space-y-1">
              <Row label="Subtotal" value={fmt(totals.subtotal)} />
              <Row label="Tax" value={fmt(totals.tax)} />
              <Row label="Other" value={fmt(otherCharges)} />
              <Row label="Discount" value={`-${fmt(discount)}`} />
              <div className="border-t pt-1 mt-1">
                <Row label="Grand total" value={fmt(totals.total)} bold />
              </div>
              <div className="text-xs text-muted-foreground">
                Status: <Badge variant="secondary">{paymentStatus}</Badge>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => mut.mutate()} disabled={!canSubmit}>
            {mut.isPending ? "Saving…" : "Save purchase"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${bold ? "font-semibold" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

// ---------- View purchase ----------
function PurchaseViewDialog({
  id,
  shopId,
  fmt,
  onClose,
}: {
  id: string;
  shopId: string;
  fmt: (n: number | string) => string;
  onClose: () => void;
}) {
  const getFn = useServerFn(getPurchase);
  const q = useQuery({
    queryKey: ["purchase", id],
    queryFn: () => getFn({ data: { id, shop_id: shopId } }),
  });
  const p: any = q.data;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Purchase {p?.invoice_number ? `#${p.invoice_number}` : ""}</DialogTitle>
          <DialogDescription>
            {p?.invoice_date} · {p?.supplier?.name ?? "No supplier"}
          </DialogDescription>
        </DialogHeader>

        {q.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !p ? (
          <p className="text-sm text-muted-foreground">Not found.</p>
        ) : (
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Tax</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {p.items.map((it: any) => (
                  <TableRow key={it.id}>
                    <TableCell>
                      {it.product?.name ?? "—"}
                      {it.product?.sku && (
                        <span className="text-xs text-muted-foreground">
                          {" "}
                          · {it.product.sku}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {it.quantity} {it.product?.unit ?? ""}
                    </TableCell>
                    <TableCell className="text-right">{fmt(it.unit_cost)}</TableCell>
                    <TableCell className="text-right">{Number(it.tax_rate)}%</TableCell>
                    <TableCell className="text-right">{fmt(it.line_total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                {p.notes && (
                  <p className="text-muted-foreground whitespace-pre-wrap">{p.notes}</p>
                )}
              </div>
              <div className="rounded-md border p-3 space-y-1">
                <Row label="Subtotal" value={fmt(p.subtotal)} />
                <Row label="Tax" value={fmt(p.tax_total)} />
                <Row label="Other" value={fmt(p.other_charges)} />
                <Row label="Discount" value={`-${fmt(p.discount)}`} />
                <div className="border-t pt-1 mt-1">
                  <Row label="Total" value={fmt(p.total)} bold />
                </div>
                <Row label="Paid" value={fmt(p.amount_paid)} />
                <Row
                  label="Due"
                  value={fmt(Number(p.total) - Number(p.amount_paid))}
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Suppliers tab ----------------
function SuppliersTab({
  shopId,
  qc,
}: {
  shopId: string;
  qc: ReturnType<typeof useQueryClient>;
}) {
  const listFn = useServerFn(listSuppliers);
  const list = useQuery({
    queryKey: ["suppliers", shopId],
    queryFn: () => listFn({ data: { shop_id: shopId, search: null } }),
  });

  const [editing, setEditing] = useState<Supplier | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [confirmDel, setConfirmDel] = useState<Supplier | null>(null);

  const delFn = useServerFn(deleteSupplier);
  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id, shop_id: shopId } }),
    onSuccess: () => {
      toast.success("Supplier deleted");
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      setConfirmDel(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = (list.data ?? []) as Supplier[];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setEditing(null);
            setShowDialog(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1" /> New supplier
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>GSTIN</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    <Truck className="h-6 w-6 mx-auto mb-2 opacity-50" />
                    No suppliers yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.contact_person || "—"}</TableCell>
                    <TableCell>{s.phone || "—"}</TableCell>
                    <TableCell>{s.email || "—"}</TableCell>
                    <TableCell>{s.gstin || "—"}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setEditing(s);
                              setShowDialog(true);
                            }}
                          >
                            <Pencil className="h-4 w-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setConfirmDel(s)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {showDialog && (
        <SupplierDialog
          shopId={shopId}
          supplier={editing}
          onClose={() => setShowDialog(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["suppliers"] });
            setShowDialog(false);
          }}
        />
      )}

      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete supplier?</AlertDialogTitle>
            <AlertDialogDescription>
              Past purchases linked to this supplier will be kept but the supplier reference
              cleared.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDel && delMut.mutate(confirmDel.id)}
              disabled={delMut.isPending}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SupplierDialog({
  shopId,
  supplier,
  onClose,
  onSaved,
}: {
  shopId: string;
  supplier: Supplier | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: supplier?.name ?? "",
    contact_person: supplier?.contact_person ?? "",
    phone: supplier?.phone ?? "",
    email: supplier?.email ?? "",
    gstin: supplier?.gstin ?? "",
    address: supplier?.address ?? "",
    notes: supplier?.notes ?? "",
  });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const createFn = useServerFn(createSupplier);
  const updateFn = useServerFn(updateSupplier);

  const mut = useMutation({
    mutationFn: async () => {
      const payload = { shop_id: shopId, ...form };
      if (supplier) return updateFn({ data: { id: supplier.id, ...payload } });
      return createFn({ data: payload });
    },
    onSuccess: () => {
      toast.success(supplier ? "Supplier updated" : "Supplier added");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{supplier ? "Edit supplier" : "New supplier"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>Name *</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div>
            <Label>Contact person</Label>
            <Input
              value={form.contact_person}
              onChange={(e) => set("contact_person", e.target.value)}
            />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </div>
          <div>
            <Label>GSTIN</Label>
            <Input value={form.gstin} onChange={(e) => set("gstin", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label>Address</Label>
            <Textarea
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              rows={2}
            />
          </div>
          <div className="md:col-span-2">
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => mut.mutate()}
            disabled={!form.name.trim() || mut.isPending}
          >
            {mut.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
