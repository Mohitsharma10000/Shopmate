import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Phone,
  Wallet,
  IndianRupee,
  TriangleAlert,
  Users,
  Trash2,
  History,
  MessageCircle,
} from "lucide-react";
import { Route as AuthRoute } from "./route";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { getMyProfile } from "@/lib/shops.functions";
import {
  listCustomers,
  upsertCustomer,
  deleteCustomer,
  getCustomer,
  recordPayment,
  khataSummary,
} from "@/lib/customers.functions";

export const Route = createFileRoute("/_authenticated/customers")({
  head: () => ({ meta: [{ title: "Customers (Khata) — ShopOS" }] }),
  component: CustomersPage,
});

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n || 0);
}

function CustomersPage() {
  const { user } = AuthRoute.useRouteContext();
  const profileFn = useServerFn(getMyProfile);
  const profile = useQuery({ queryKey: ["my-profile"], queryFn: () => profileFn() });
  const shopId = profile.data?.active_shop_id ?? null;

  return (
    <AppShell userEmail={user?.email}>
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1400px] mx-auto w-full">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Customers & Khata</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage customer credit, payments, and balance history.
            </p>
          </div>
        </div>
        {!shopId ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center text-muted-foreground">
              Set up a shop first.
            </CardContent>
          </Card>
        ) : (
          <CustomersInner shopId={shopId} />
        )}
      </div>
    </AppShell>
  );
}

function CustomersInner({ shopId }: { shopId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listCustomers);
  const sumFn = useServerFn(khataSummary);
  const delFn = useServerFn(deleteCustomer);

  const [search, setSearch] = useState("");
  const [duesOnly, setDuesOnly] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const list = useQuery({
    queryKey: ["customers", shopId, search, duesOnly],
    queryFn: () =>
      listFn({ data: { shop_id: shopId, search: search || null, with_balance_only: duesOnly } }),
  });
  const sum = useQuery({
    queryKey: ["khata-summary", shopId],
    queryFn: () => sumFn({ data: { shop_id: shopId } }),
  });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id, shop_id: shopId } }),
    onSuccess: () => {
      toast.success("Customer deleted");
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["khata-summary"] });
    },
    onError: (e: any) => toast.error(e?.message || "Delete failed"),
  });

  return (
    <>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-4">
        <Kpi label="Total customers" value={String(sum.data?.total_customers ?? 0)} icon={Users} />
        <Kpi label="With dues" value={String(sum.data?.with_dues ?? 0)} icon={Wallet} />
        <Kpi label="Total receivable" value={fmt(sum.data?.total_due ?? 0)} icon={IndianRupee} />
        <Kpi
          label="Over limit"
          value={String(sum.data?.over_limit ?? 0)}
          icon={TriangleAlert}
          danger={Boolean(sum.data?.over_limit)}
        />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name…"
                className="pl-9"
              />
            </div>
            <Button
              variant={duesOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setDuesOnly((v) => !v)}
            >
              Dues only
            </Button>
            <div className="flex-1" />
            <Button
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Add customer
            </Button>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-right">Credit limit</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="w-[140px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : (list.data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                      No customers yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  (list.data as any[]).map((c) => {
                    const bal = Number(c.balance || 0);
                    const lim = Number(c.credit_limit || 0);
                    const over = lim > 0 && bal > lim;
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {c.phone ? (
                            <span className="flex items-center gap-1.5">
                              <Phone className="h-3 w-3" /> {c.phone}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {lim > 0 ? fmt(lim) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant={over ? "destructive" : bal > 0 ? "secondary" : "outline"}
                          >
                            {fmt(bal)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDetailId(c.id)}
                            >
                              <History className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditing(c);
                                setOpen(true);
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (confirm(`Delete ${c.name}?`)) del.mutate(c.id);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
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

      <CustomerDialog
        open={open}
        onClose={() => setOpen(false)}
        shopId={shopId}
        editing={editing}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["customers"] });
          qc.invalidateQueries({ queryKey: ["khata-summary"] });
        }}
      />
      <CustomerDetail
        id={detailId}
        shopId={shopId}
        onClose={() => setDetailId(null)}
      />
    </>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
  danger,
}: {
  label: string;
  value: string;
  icon: any;
  danger?: boolean;
}) {
  return (
    <Card className="border-border/60 shadow-soft">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
          <Icon className={`h-4 w-4 ${danger ? "text-destructive" : "text-muted-foreground"}`} />
        </div>
        <div
          className={`mt-3 text-2xl font-semibold tracking-tight ${danger ? "text-destructive" : ""}`}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function CustomerDialog({
  open,
  onClose,
  shopId,
  editing,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  shopId: string;
  editing: any | null;
  onSaved: () => void;
}) {
  const fn = useServerFn(upsertCustomer);
  const [form, setForm] = useState<any>({});

  useMemo(() => {
    setForm(
      editing
        ? {
            name: editing.name || "",
            phone: editing.phone || "",
            email: editing.email || "",
            address: editing.address || "",
            credit_limit: editing.credit_limit || 0,
            notes: editing.notes || "",
          }
        : { name: "", phone: "", email: "", address: "", credit_limit: 0, notes: "" },
    );
  }, [editing, open]);

  const save = useMutation({
    mutationFn: () =>
      fn({
        data: {
          ...(editing ? { id: editing.id } : {}),
          shop_id: shopId,
          name: form.name,
          phone: form.phone || null,
          email: form.email || null,
          address: form.address || null,
          credit_limit: Number(form.credit_limit) || 0,
          notes: form.notes || null,
        },
      }),
    onSuccess: () => {
      toast.success(editing ? "Customer updated" : "Customer added");
      onSaved();
      onClose();
    },
    onError: (e: any) => toast.error(e?.message || "Save failed"),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit customer" : "Add customer"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Name *</Label>
            <Input
              value={form.name || ""}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Phone</Label>
              <Input
                value={form.phone || ""}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div>
              <Label>Credit limit</Label>
              <Input
                type="number"
                value={form.credit_limit || ""}
                onChange={(e) => setForm({ ...form, credit_limit: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label>Email</Label>
            <Input
              value={form.email || ""}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <Label>Address</Label>
            <Input
              value={form.address || ""}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
          <div>
            <Label>Notes</Label>
            <Input
              value={form.notes || ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={!form.name || save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CustomerDetail({
  id,
  shopId,
  onClose,
}: {
  id: string | null;
  shopId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const fn = useServerFn(getCustomer);
  const payFn = useServerFn(recordPayment);

  const q = useQuery({
    queryKey: ["customer", id],
    queryFn: () => fn({ data: { id: id!, shop_id: shopId } }),
    enabled: !!id,
  });

  const [amt, setAmt] = useState("");
  const [method, setMethod] = useState<"cash" | "card" | "upi" | "bank">("cash");

  const pay = useMutation({
    mutationFn: () =>
      payFn({
        data: {
          shop_id: shopId,
          customer_id: id!,
          amount: Number(amt) || 0,
          payment_method: method,
          note: null,
        },
      }),
    onSuccess: () => {
      toast.success("Payment recorded");
      setAmt("");
      qc.invalidateQueries({ queryKey: ["customer", id] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["khata-summary"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });

  const c = q.data as any;
  const bal = Number(c?.balance || 0);
  const phone = c?.phone?.replace(/\D/g, "");
  const waLink = phone
    ? `https://wa.me/${phone.startsWith("91") || phone.length > 10 ? phone : "91" + phone}?text=${encodeURIComponent(
        `Namaste ${c?.name}, aapka pending balance hai ${fmt(bal)}. Kripya jaldi clear karein. Dhanyavaad.`,
      )}`
    : null;

  return (
    <Dialog open={!!id} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {c?.name || "Customer"}
            <Badge variant={bal > 0 ? "destructive" : "outline"}>
              Balance: {fmt(bal)}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="grid sm:grid-cols-[1fr_280px] gap-4">
          <div className="rounded-md border max-h-[400px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(c?.ledger ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No activity yet
                    </TableCell>
                  </TableRow>
                ) : (
                  (c?.ledger ?? []).map((l: any) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs">
                        {new Date(l.created_at).toLocaleString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={l.type === "payment" ? "outline" : "secondary"}
                          className="capitalize"
                        >
                          {l.type.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {l.reference || l.note || "—"}
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium ${l.type === "payment" ? "text-emerald-600" : ""}`}
                      >
                        {l.type === "payment" ? "−" : "+"}
                        {fmt(Number(l.amount))}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3">
            <div className="rounded-md border p-3 space-y-2">
              <div className="text-sm font-medium">Record payment</div>
              <Input
                type="number"
                placeholder="Amount"
                value={amt}
                onChange={(e) => setAmt(e.target.value)}
              />
              <Select value={method} onValueChange={(v) => setMethod(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="bank">Bank</SelectItem>
                </SelectContent>
              </Select>
              <Button
                className="w-full"
                onClick={() => pay.mutate()}
                disabled={!Number(amt) || pay.isPending}
              >
                {pay.isPending ? "Saving…" : "Record payment"}
              </Button>
            </div>
            {waLink && bal > 0 && (
              <Button asChild variant="outline" className="w-full">
                <a href={waLink} target="_blank" rel="noreferrer">
                  <MessageCircle className="h-4 w-4" /> Send WhatsApp reminder
                </a>
              </Button>
            )}
            {c && (
              <div className="text-xs text-muted-foreground space-y-1">
                {c.phone && (
                  <div>
                    <Phone className="h-3 w-3 inline mr-1" />
                    {c.phone}
                  </div>
                )}
                {c.credit_limit > 0 && <div>Credit limit: {fmt(Number(c.credit_limit))}</div>}
                {c.address && <div>{c.address}</div>}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
