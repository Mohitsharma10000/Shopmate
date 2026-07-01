import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Package,
  AlertTriangle,
  IndianRupee,
  Boxes,
  Tag,
  MoreHorizontal,
  Pencil,
  Trash2,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { Route as AuthRoute } from "./route";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DropdownMenuSeparator,
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
import {
  adjustStock,
  createCategory,
  createProduct,
  deleteCategory,
  deleteProduct,
  inventorySummary,
  listCategories,
  listProducts,
  updateProduct,
} from "@/lib/inventory.functions";

export const Route = createFileRoute("/_authenticated/inventory")({
  head: () => ({ meta: [{ title: "Inventory — ShopOS" }] }),
  component: InventoryPage,
});

type ProductRow = {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  unit: string;
  mrp: number | string;
  sale_price: number | string;
  cost_price: number | string;
  tax_rate: number | string;
  hsn_code: string | null;
  image_url: string | null;
  track_stock: boolean;
  stock_qty: number | string;
  reorder_level: number | string;
  is_active: boolean;
  category_id: string | null;
  category?: { id: string; name: string; color: string | null } | null;
};

const UNITS = ["pcs", "kg", "g", "ltr", "ml", "box", "pkt", "dozen"];

function InventoryPage() {
  const { user } = AuthRoute.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const profileFn = useServerFn(getMyProfile);
  const shopsFn = useServerFn(listMyShops);
  const summaryFn = useServerFn(inventorySummary);
  const productsFn = useServerFn(listProducts);
  const categoriesFn = useServerFn(listCategories);

  const profile = useQuery({ queryKey: ["my-profile"], queryFn: () => profileFn() });
  const shops = useQuery({ queryKey: ["my-shops"], queryFn: () => shopsFn() });

  const shopId =
    profile.data?.active_shop_id ||
    shops.data?.[0]?.id ||
    null;

  useEffect(() => {
    if (shops.isSuccess && (shops.data?.length ?? 0) === 0) {
      navigate({ to: "/onboarding", replace: true });
    }
  }, [shops.isSuccess, shops.data, navigate]);

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"all" | "low" | "out">("all");
  const [categoryId, setCategoryId] = useState<string>("all");

  const summary = useQuery({
    queryKey: ["inv-summary", shopId],
    queryFn: () => summaryFn({ data: { shop_id: shopId! } }),
    enabled: !!shopId,
  });

  const products = useQuery({
    queryKey: ["products", shopId, search, categoryId, tab],
    queryFn: () =>
      productsFn({
        data: {
          shop_id: shopId!,
          search: search || null,
          category_id: categoryId === "all" ? null : categoryId,
          only_low: tab === "low",
          limit: 200,
        },
      }),
    enabled: !!shopId,
  });

  const categories = useQuery({
    queryKey: ["categories", shopId],
    queryFn: () => categoriesFn({ data: { shop_id: shopId! } }),
    enabled: !!shopId,
  });

  const visible = useMemo<ProductRow[]>(() => {
    const list = (products.data ?? []) as ProductRow[];
    if (tab === "out") return list.filter((p) => p.track_stock && Number(p.stock_qty) <= 0);
    return list;
  }, [products.data, tab]);

  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [showCategoriesDialog, setShowCategoriesDialog] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState<ProductRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ProductRow | null>(null);

  const deleteFn = useServerFn(deleteProduct);
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Product deleted");
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["inv-summary"] });
      setConfirmDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const currency = shops.data?.find((s) => s.id === shopId)?.currency ?? "INR";
  const fmt = (n: number | string) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(Number(n) || 0);

  return (
    <AppShell userEmail={user?.email}>
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage products, categories, stock, and pricing.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowCategoriesDialog(true)}>
              <Tag className="h-4 w-4" /> Categories
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                setShowProductDialog(true);
              }}
              disabled={!shopId}
            >
              <Plus className="h-4 w-4" /> Add product
            </Button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mt-6">
          <SummaryCard
            label="Active SKUs"
            value={summary.data ? `${summary.data.activeSkus}` : "—"}
            icon={Boxes}
            hint={summary.data ? `${summary.data.totalSkus} total` : ""}
          />
          <SummaryCard
            label="Inventory cost"
            value={summary.data ? fmt(summary.data.inventoryCost) : "—"}
            icon={IndianRupee}
            hint="At cost price"
          />
          <SummaryCard
            label="Inventory retail"
            value={summary.data ? fmt(summary.data.inventoryRetail) : "—"}
            icon={Package}
            hint="At sale price"
          />
          <SummaryCard
            label="Low / Out"
            value={
              summary.data ? `${summary.data.lowStock} / ${summary.data.outOfStock}` : "—"
            }
            icon={AlertTriangle}
            hint="Needs attention"
            tone={
              summary.data && (summary.data.lowStock + summary.data.outOfStock > 0)
                ? "warn"
                : "default"
            }
          />
        </div>

        {/* Filters */}
        <div className="mt-6 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, SKU, or barcode"
              className="pl-9"
            />
          </div>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {(categories.data ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="ml-auto">
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="low">Low stock</TabsTrigger>
              <TabsTrigger value="out">Out</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Products table */}
        <Card className="mt-4 border-border/60 shadow-soft">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-surface-muted/40">
                    <TableHead className="w-[34%]">Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                        Loading products…
                      </TableCell>
                    </TableRow>
                  ) : visible.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Package className="h-6 w-6" />
                          <div className="text-sm">No products yet</div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2"
                            onClick={() => {
                              setEditing(null);
                              setShowProductDialog(true);
                            }}
                          >
                            <Plus className="h-4 w-4" /> Add your first product
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    visible.map((p) => {
                      const qty = Number(p.stock_qty) || 0;
                      const reorder = Number(p.reorder_level) || 0;
                      const low = p.track_stock && qty > 0 && qty <= reorder;
                      const out = p.track_stock && qty <= 0;
                      return (
                        <TableRow key={p.id} className="hover:bg-surface-muted/30">
                          <TableCell>
                            <div className="font-medium">{p.name}</div>
                            <div className="text-xs text-muted-foreground mt-0.5 flex gap-2 flex-wrap">
                              {p.sku && <span>SKU: {p.sku}</span>}
                              {p.barcode && <span>· {p.barcode}</span>}
                              {!p.is_active && (
                                <Badge variant="outline" className="h-4 px-1 text-[10px]">
                                  inactive
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {p.category ? (
                              <Badge
                                variant="outline"
                                className="font-normal"
                                style={
                                  p.category.color
                                    ? {
                                        borderColor: p.category.color + "55",
                                        color: p.category.color,
                                        background: p.category.color + "12",
                                      }
                                    : undefined
                                }
                              >
                                {p.category.name}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {fmt(p.sale_price)}
                            {Number(p.mrp) > Number(p.sale_price) && (
                              <div className="text-[11px] text-muted-foreground line-through">
                                {fmt(p.mrp)}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {p.track_stock ? (
                              <div className="inline-flex items-center gap-1">
                                <span
                                  className={
                                    out
                                      ? "text-destructive font-medium"
                                      : low
                                        ? "text-amber-600 font-medium"
                                        : ""
                                  }
                                >
                                  {qty} {p.unit}
                                </span>
                                {(low || out) && (
                                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">Not tracked</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground text-sm">
                            {fmt(qty * (Number(p.cost_price) || 0))}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setEditing(p);
                                    setShowProductDialog(true);
                                  }}
                                >
                                  <Pencil className="h-4 w-4" /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setAdjustTarget(p)}>
                                  <TrendingUp className="h-4 w-4" /> Adjust stock
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => setConfirmDelete(p)}
                                >
                                  <Trash2 className="h-4 w-4" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      {shopId && (
        <ProductDialog
          open={showProductDialog}
          onOpenChange={setShowProductDialog}
          shopId={shopId}
          editing={editing}
          categories={categories.data ?? []}
        />
      )}
      {shopId && (
        <CategoriesDialog
          open={showCategoriesDialog}
          onOpenChange={setShowCategoriesDialog}
          shopId={shopId}
        />
      )}
      {shopId && adjustTarget && (
        <AdjustStockDialog
          shopId={shopId}
          product={adjustTarget}
          onClose={() => setAdjustTarget(null)}
        />
      )}
      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this product?</AlertDialogTitle>
            <AlertDialogDescription>
              "{confirmDelete?.name}" and its stock history will be permanently removed. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDelete && deleteMut.mutate(confirmDelete.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
  tone?: "default" | "warn";
}) {
  return (
    <Card className="border-border/60 shadow-soft">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
          <Icon
            className={
              tone === "warn"
                ? "h-4 w-4 text-amber-500"
                : "h-4 w-4 text-muted-foreground"
            }
          />
        </div>
        <div className="mt-3 text-2xl font-semibold tracking-tight">{value}</div>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

// ---------- Product dialog ----------
type CategoryRow = { id: string; name: string; slug: string; color: string | null; parent_id: string | null; sort_order: number };

function ProductDialog({
  open,
  onOpenChange,
  shopId,
  editing,
  categories,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  shopId: string;
  editing: ProductRow | null;
  categories: CategoryRow[];
}) {
  const qc = useQueryClient();
  const createFn = useServerFn(createProduct);
  const updateFn = useServerFn(updateProduct);

  const empty = {
    name: "",
    sku: "",
    barcode: "",
    unit: "pcs",
    category_id: "none",
    mrp: "0",
    sale_price: "0",
    cost_price: "0",
    tax_rate: "0",
    hsn_code: "",
    reorder_level: "0",
    opening_stock: "0",
    description: "",
    track_stock: true,
    is_active: true,
  };
  const [form, setForm] = useState(empty);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        name: editing.name,
        sku: editing.sku ?? "",
        barcode: editing.barcode ?? "",
        unit: editing.unit,
        category_id: editing.category_id ?? "none",
        mrp: String(editing.mrp ?? "0"),
        sale_price: String(editing.sale_price ?? "0"),
        cost_price: String(editing.cost_price ?? "0"),
        tax_rate: String(editing.tax_rate ?? "0"),
        hsn_code: editing.hsn_code ?? "",
        reorder_level: String(editing.reorder_level ?? "0"),
        opening_stock: "0",
        description: "",
        track_stock: editing.track_stock,
        is_active: editing.is_active,
      });
    } else {
      setForm(empty);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const setField = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        shop_id: shopId,
        name: form.name.trim(),
        sku: form.sku.trim() || null,
        barcode: form.barcode.trim() || null,
        unit: form.unit,
        category_id: form.category_id === "none" ? null : form.category_id,
        mrp: Number(form.mrp) || 0,
        sale_price: Number(form.sale_price) || 0,
        cost_price: Number(form.cost_price) || 0,
        tax_rate: Number(form.tax_rate) || 0,
        hsn_code: form.hsn_code.trim() || null,
        reorder_level: Number(form.reorder_level) || 0,
        description: form.description.trim() || null,
        track_stock: form.track_stock,
        is_active: form.is_active,
      };
      if (editing) {
        await updateFn({ data: { id: editing.id, ...payload } });
      } else {
        await createFn({
          data: { ...payload, opening_stock: Number(form.opening_stock) || 0 },
        });
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Product updated" : "Product created");
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["inv-summary"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit product" : "Add product"}</DialogTitle>
          <DialogDescription>
            {editing ? "Update details below." : "Fill in the basics — you can edit anything later."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="p-name">Name *</Label>
            <Input
              id="p-name"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="e.g. Aashirvaad Atta 5kg"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="p-sku">SKU</Label>
              <Input
                id="p-sku"
                value={form.sku}
                onChange={(e) => setField("sku", e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="p-barcode">Barcode</Label>
              <Input
                id="p-barcode"
                value={form.barcode}
                onChange={(e) => setField("barcode", e.target.value)}
                placeholder="EAN / UPC"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Category</Label>
              <Select
                value={form.category_id}
                onValueChange={(v) => setField("category_id", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Uncategorised" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Uncategorised</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Unit</Label>
              <Select value={form.unit} onValueChange={(v) => setField("unit", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <NumberField
              label="MRP"
              value={form.mrp}
              onChange={(v) => setField("mrp", v)}
            />
            <NumberField
              label="Sale price *"
              value={form.sale_price}
              onChange={(v) => setField("sale_price", v)}
            />
            <NumberField
              label="Cost price"
              value={form.cost_price}
              onChange={(v) => setField("cost_price", v)}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <NumberField
              label="Tax %"
              value={form.tax_rate}
              onChange={(v) => setField("tax_rate", v)}
            />
            <div className="grid gap-1.5">
              <Label>HSN code</Label>
              <Input
                value={form.hsn_code}
                onChange={(e) => setField("hsn_code", e.target.value)}
                placeholder="Optional"
              />
            </div>
            <NumberField
              label="Reorder level"
              value={form.reorder_level}
              onChange={(v) => setField("reorder_level", v)}
            />
          </div>

          {!editing && (
            <NumberField
              label={`Opening stock (${form.unit})`}
              value={form.opening_stock}
              onChange={(v) => setField("opening_stock", v)}
            />
          )}

          <div className="grid gap-1.5">
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
              placeholder="Optional notes shown only to staff"
              rows={2}
            />
          </div>

          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <div className="text-sm font-medium">Track stock</div>
              <p className="text-xs text-muted-foreground">
                Disable for services or items you don't count.
              </p>
            </div>
            <Switch
              checked={form.track_stock}
              onCheckedChange={(v) => setField("track_stock", v)}
            />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <div className="text-sm font-medium">Active</div>
              <p className="text-xs text-muted-foreground">
                Inactive products are hidden from POS.
              </p>
            </div>
            <Switch
              checked={form.is_active}
              onCheckedChange={(v) => setField("is_active", v)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={mutation.isPending || !form.name.trim()}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Saving…" : editing ? "Save changes" : "Create product"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <Input
        type="number"
        inputMode="decimal"
        step="0.01"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// ---------- Categories dialog ----------
function CategoriesDialog({
  open,
  onOpenChange,
  shopId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  shopId: string;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listCategories);
  const createFn = useServerFn(createCategory);
  const deleteFn = useServerFn(deleteCategory);

  const cats = useQuery({
    queryKey: ["categories", shopId],
    queryFn: () => listFn({ data: { shop_id: shopId } }),
    enabled: open && !!shopId,
  });

  const [name, setName] = useState("");
  const [color, setColor] = useState("#6366f1");

  const createMut = useMutation({
    mutationFn: () => createFn({ data: { shop_id: shopId, name: name.trim(), color } }),
    onSuccess: () => {
      toast.success("Category added");
      setName("");
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Category removed");
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Categories</DialogTitle>
          <DialogDescription>Group products to filter and report faster.</DialogDescription>
        </DialogHeader>

        <div className="flex items-end gap-2">
          <div className="grid gap-1.5 flex-1">
            <Label htmlFor="cat-name">New category</Label>
            <Input
              id="cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Beverages"
            />
          </div>
          <Input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-12 h-10 p-1"
            aria-label="Category color"
          />
          <Button
            onClick={() => createMut.mutate()}
            disabled={!name.trim() || createMut.isPending}
          >
            Add
          </Button>
        </div>

        <div className="mt-2 max-h-72 overflow-y-auto rounded-md border border-border divide-y divide-border">
          {cats.isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">Loading…</div>
          ) : (cats.data?.length ?? 0) === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No categories yet.</div>
          ) : (
            cats.data!.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full border border-border"
                    style={{ background: c.color ?? "transparent" }}
                  />
                  <span className="text-sm">{c.name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteMut.mutate(c.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Adjust stock dialog ----------
function AdjustStockDialog({
  shopId,
  product,
  onClose,
}: {
  shopId: string;
  product: ProductRow;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const adjustFn = useServerFn(adjustStock);

  const [direction, setDirection] = useState<"in" | "out">("in");
  const [qty, setQty] = useState("1");
  const [note, setNote] = useState("");
  const [type, setType] = useState<"purchase" | "adjustment" | "wastage" | "return_in" | "return_out">(
    "purchase",
  );

  useEffect(() => {
    if (direction === "in") setType("purchase");
    else setType("wastage");
  }, [direction]);

  const mutation = useMutation({
    mutationFn: () => {
      const q = Number(qty) || 0;
      const signed = direction === "in" ? q : type === "adjustment" ? -q : q;
      return adjustFn({
        data: {
          shop_id: shopId,
          product_id: product.id,
          type,
          quantity: signed,
          note: note.trim() || null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Stock updated");
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["inv-summary"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const current = Number(product.stock_qty) || 0;
  const delta = (Number(qty) || 0) * (direction === "in" ? 1 : -1);
  const projected = current + delta;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust stock</DialogTitle>
          <DialogDescription>{product.name}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-1">
          <Tabs value={direction} onValueChange={(v) => setDirection(v as "in" | "out")}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="in">
                <TrendingUp className="h-4 w-4" /> Stock in
              </TabsTrigger>
              <TabsTrigger value="out">
                <TrendingDown className="h-4 w-4" /> Stock out
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Quantity ({product.unit})</Label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Reason</Label>
              <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {direction === "in" ? (
                    <>
                      <SelectItem value="purchase">Purchase</SelectItem>
                      <SelectItem value="return_in">Customer return</SelectItem>
                      <SelectItem value="adjustment">Adjustment</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="wastage">Wastage / damage</SelectItem>
                      <SelectItem value="return_out">Return to supplier</SelectItem>
                      <SelectItem value="adjustment">Adjustment</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Note</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div className="rounded-md bg-surface-muted/60 border border-border px-3 py-2 text-sm flex items-center justify-between">
            <span className="text-muted-foreground">Current → New</span>
            <span className="tabular-nums font-medium">
              {current} → <span className={projected < 0 ? "text-destructive" : ""}>{projected}</span>
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!Number(qty) || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Saving…" : "Apply"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
