
# ShopOS — Grocery Shop Management (Web + PWA)

Clean, Linear/Shopify-inspired UI. Mobile-first, responsive to desktop. Built on TanStack Start (React) + Lovable Cloud (Postgres, Auth, Storage). Installable as a PWA.

I'll ship in 4 phases. Each phase is fully working, tested, and deployable before moving on. Today I'll build Phase 1 end-to-end; later phases happen in follow-up turns.

---

## Phase 1 — Foundation: Auth, Roles, Shops (this turn)

**Auth**
- Email/password + Google sign-in (Lovable Cloud managed)
- `/auth` public page; everything else under `_authenticated/`

**Roles** (in a dedicated `user_roles` table — never on profiles)
- `owner`, `manager`, `cashier`, `staff`
- `has_role()` security-definer function for RLS
- Permission helpers in client + server middleware

**Shops (multi-shop)**
- Owner can create multiple shops; one "active shop" at a time (stored in profile + URL context)
- `shop_members` table links users → shops with a role per shop
- Shop switcher in the top bar

**Profiles**
- Auto-created on signup via trigger (name, avatar, phone, active_shop_id)

**UI**
- App shell: sidebar nav (collapsible on mobile → bottom nav), top bar with shop switcher + user menu
- Empty "Dashboard", "Inventory", "POS", "Reports" placeholder routes wired up with role-gated nav
- Onboarding flow: first login → "Create your shop" → land on dashboard
- Settings → Team (invite by email, assign role) — owner/manager only

**Design system**
- Neutral palette (near-black ink on warm white, single accent), Inter font, generous spacing, subtle borders, no gradients
- Defined as tokens in `src/styles.css`; shadcn components themed via variants

## Phase 2 — Inventory (next turn)

Products (name, SKU, barcode, category, brand, unit, purchase/sell/MRP price, GST%, stock, min stock, batch, expiry, image), categories, stock adjustments, barcode scan/generate, CSV import/export, low-stock & expiry views. Scoped per shop via RLS.

## Phase 3 — POS / Billing

Fast keyboard+barcode POS, cart, discounts, GST, split payments (cash/UPI/card), invoice PDF, hold/resume bills, returns, thermal-printer-friendly receipt, WhatsApp share link. Writes `sales`, `sale_items`, decrements stock atomically (Postgres function).

## Phase 4 — Dashboard + Reports

KPI cards (today/MTD sales, profit, orders, low stock, expiring), sales/profit/category charts, top products/customers. Reports: sales, inventory, GST, profit; export CSV/PDF.

---

## Technical details

**Stack**
- TanStack Start + React 19, Tailwind v4, shadcn/ui, TanStack Query
- Lovable Cloud: Postgres, Auth (email + Google), Storage (product images, invoice PDFs)
- PWA: manifest + icons (installable). Service-worker offline added in Phase 3 only if needed.

**Phase-1 schema (Postgres)**

```text
profiles(id pk → auth.users, full_name, phone, avatar_url, active_shop_id, created_at)
app_role enum('owner','manager','cashier','staff')
shops(id, owner_id → auth.users, name, business_type, gstin, address, phone,
      currency, timezone, logo_url, created_at)
shop_members(id, shop_id → shops, user_id → auth.users, role app_role,
             invited_email, status, created_at, unique(shop_id, user_id))
user_roles(id, user_id, role app_role, unique(user_id, role))   -- global roles (rare)
has_role(_user_id, _role) returns bool   -- security definer
is_shop_member(_user_id, _shop_id, _min_role) returns bool   -- security definer
```

All `public` tables: explicit `GRANT` to `authenticated` + `service_role`, RLS enabled, policies scoped to `auth.uid()` and shop membership.

**Folder layout (feature-based)**

```text
src/
  routes/
    __root.tsx
    index.tsx                  → redirects to /dashboard or /auth
    auth.tsx                   public
    _authenticated/
      route.tsx                managed gate
      dashboard.tsx
      inventory.tsx            (Phase 2)
      pos.tsx                  (Phase 3)
      reports.tsx              (Phase 4)
      settings.tsx             layout
      settings.shop.tsx
      settings.team.tsx
      onboarding.tsx           create-first-shop
  features/
    auth/                      hooks, components
    shops/                     queries, switcher, onboarding
    team/                      invites, role mgmt
  components/
    layout/AppShell.tsx, Sidebar.tsx, Topbar.tsx, ShopSwitcher.tsx
    ui/...                     shadcn
  lib/
    *.functions.ts             server fns (createServerFn)
  integrations/supabase/...    (auto-managed)
```

**Security**
- RLS everywhere; no client-side role checks for authorization (UI-only)
- All mutations through `createServerFn` with `requireSupabaseAuth`
- Shop-scoped policies via `is_shop_member()` helper

**Not in Phase 1** (deferred so we ship a working slice): AI features, subscriptions/billing, SMS OTP, biometric/PIN lock, thermal printer integration, real offline write queue. I'll flag these in the UI as "coming soon" where relevant.

---

Reply "go" and I'll build Phase 1. Or tell me what to adjust (e.g. skip Google login, change role names, drop multi-shop for now).
