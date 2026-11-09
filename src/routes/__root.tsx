import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  useLocation,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { BackProvider, BackButton } from "../lib/back-nav";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { isStandaloneApp, markAppInstalled } from "../lib/pwa-install";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
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
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
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
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "HUNGRY Z — Smart Campus Food Ordering" },
      {
        name: "description",
        content:
          "HUNGRY Z — smart campus food ordering with ₹0 platform fee on every order.",
      },
      { name: "author", content: "HUNGRY Z" },
      { name: "theme-color", content: "#050505" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Noto+Sans+Devanagari:wght@400;500;600;700;800&family=Noto+Sans+Kannada:wght@400;500;600;700;800&family=Sora:wght@400;600;700;800&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/HUNGRY%20Z%20Q%20LOGO.png", type: "image/png", sizes: "1254x1254" },
      { rel: "apple-touch-icon", href: "/HUNGRY%20Z%20Q%20LOGO.png" },
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script>{`try { var hungryTheme = localStorage.getItem("hungry-theme"); if (hungryTheme === "light" || hungryTheme === "dark") document.documentElement.dataset.theme = hungryTheme; else if (/^\\/(?:app|canteen)(?:\\/|$)/.test(location.pathname)) document.documentElement.dataset.theme = "light"; } catch {}`}</script>
        {/* Capture Chrome's one-shot install event before the hydrated app bundle loads. */}
        <script src="/pwa-install-capture.js" />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const { pathname, searchStr } = useLocation();
  const appFromUrl = new URLSearchParams(searchStr).get("hungry_app");
  const hasAppLaunchMarker = appFromUrl === "student" || appFromUrl === "canteen";
  const [standaloneApp, setStandaloneApp] = useState(hasAppLaunchMarker);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    const standalone = isStandaloneApp();
    setStandaloneApp(standalone || hasAppLaunchMarker);
    const app = appFromUrl;
    if (standalone && (app === "student" || app === "canteen")) {
      markAppInstalled(app, true);
      const themeColor = app === "student" ? "#e60012" : "#050505";
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", themeColor);
    }
  }, [appFromUrl, hasAppLaunchMarker]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <BackProvider disabled={standaloneApp && pathname !== "/privacy" && pathname !== "/terms"}>
        {pathname !== "/canteen" && <BackButton />}
        <Outlet />
      </BackProvider>
    </QueryClientProvider>
  );
}
