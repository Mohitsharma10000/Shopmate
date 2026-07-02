import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { authEvents } from "@/integrations/appwrite/client";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold tracking-tight text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. Try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent/10"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "ShopOS — Modern Shop Management" },
      {
        name: "description",
        content:
          "Run your shop end-to-end: inventory, billing, customers, and reports. Built for grocery and retail.",
      },
      { name: "theme-color", content: "#fbfaf6" },
      { property: "og:title", content: "ShopOS — Modern Shop Management" },
      {
        property: "og:description",
        content:
          "Run your shop end-to-end: inventory, billing, customers, and reports. Built for grocery and retail.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <style dangerouslySetInnerHTML={{ __html: `
          html, body { background: #fbfaf6; margin: 0; }
          #app-splash {
            position: fixed; inset: 0; z-index: 99999;
            display: flex; align-items: center; justify-content: center;
            background: #fbfaf6;
            transition: opacity 0.3s ease;
          }
          #app-splash .spinner {
            width: 36px; height: 36px;
            border: 3px solid #e5e2db; border-top-color: #1B4332;
            border-radius: 50%; animation: spin 0.7s linear infinite;
          }
          @keyframes spin { to { transform: rotate(360deg); } }
          [data-hydrated] #app-splash { opacity: 0; pointer-events: none; }
        `}} />
      </head>
      <body>
        <div id="app-splash"><div className="spinner" style={{ width: 36, height: 36, border: '3px solid #e5e2db', borderTopColor: '#1B4332', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /></div>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function AuthSync() {
  const router = useRouter();
  const qc = useQueryClient();
  useEffect(() => {
    return authEvents.subscribe(() => {
      router.invalidate();
      qc.invalidateQueries();
    });
  }, [router, qc]);
  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    // Mark body as hydrated to fade out the CSS splash
    document.body.setAttribute("data-hydrated", "true");
    // Remove splash div from DOM after fade transition
    const splash = document.getElementById("app-splash");
    if (splash) {
      setTimeout(() => splash.remove(), 400);
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthSync />
      <Outlet />
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
