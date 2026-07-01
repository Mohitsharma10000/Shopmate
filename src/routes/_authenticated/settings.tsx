import { createFileRoute, Outlet, Link, useRouterState, redirect } from "@tanstack/react-router";
import { Route as AuthRoute } from "./route";
import { AppShell } from "@/components/layout/AppShell";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — ShopOS" }] }),
  beforeLoad: ({ location }) => {
    if (location.pathname === "/settings") {
      throw redirect({ to: "/settings/shop" });
    }
  },
  component: SettingsLayout,
});

const tabs = [
  { to: "/settings/shop", label: "Shop" },
  { to: "/settings/team", label: "Team" },
] as const;

function SettingsLayout() {
  const { user } = AuthRoute.useRouteContext();
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <AppShell userEmail={user?.email}>
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-4xl mx-auto w-full">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure your shop and team.
        </p>
        <div className="mt-6 border-b border-border flex gap-1">
          {tabs.map((t) => {
            const active = path === t.to;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`relative px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
                {active && (
                  <span className="absolute inset-x-0 -bottom-px h-0.5 bg-accent" />
                )}
              </Link>
            );
          })}
        </div>
        <div className="mt-6">
          <Outlet />
        </div>
      </div>
    </AppShell>
  );
}
