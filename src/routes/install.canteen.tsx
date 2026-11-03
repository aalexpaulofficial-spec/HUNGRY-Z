import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ArrowDown, ArrowLeft, ChartNoAxesColumnIncreasing, ClipboardList, Utensils } from "lucide-react";
import {
  clearDeferredInstallPrompt,
  getDeferredInstallPrompt,
  getInstallFallback,
  getPendingInstallApp,
  isAppInstalled,
  markAppInstalled,
  setPendingInstallApp,
  subscribeToInstallPrompt,
} from "@/lib/pwa-install";

export const Route = createFileRoute("/install/canteen")({
  head: () => ({
    links: [
      { rel: "manifest", href: "/manifest-canteen.webmanifest" },
      { rel: "icon", href: "/HUNGRY%20Z%20CANTEEN%20DAHSBOARD%20LOGO.png", type: "image/png", sizes: "1254x1254" },
    ],
    meta: [
      { title: "Install HUNGRY Z Canteen Dashboard" },
      { name: "description", content: "Install HUNGRY Z Canteen Dashboard to manage your canteen." },
      { name: "theme-color", content: "#050505" },
    ],
  }),
  component: CanteenInstallPage,
});

export function CanteenInstallPage() {
  const [installed, setInstalled] = useState(false);
  const [status, setStatus] = useState("");
  const [installing, setInstalling] = useState(false);
  const [installAvailability, setInstallAvailability] = useState<"checking" | "native" | "guide">("checking");
  const installInProgress = useRef(false);
  const checkRevision = useRef(0);

  useEffect(() => {
    let active = true;
    let promptFallbackTimer: number | undefined;
    const checkInstalled = () => {
      const revision = ++checkRevision.current;
      void isAppInstalled("canteen").then((result) => {
        if (!active || revision !== checkRevision.current) return;
        setInstalled(result);
        if (result && getPendingInstallApp() === "canteen") {
          setPendingInstallApp(null);
          clearDeferredInstallPrompt(undefined, "canteen");
          installInProgress.current = false;
          setInstalling(false);
          setStatus("");
        }
      });
    };
    const onAppInstalled = () => {
      if (getPendingInstallApp() !== "canteen") return;
      checkRevision.current += 1;
      setPendingInstallApp(null);
      clearDeferredInstallPrompt(undefined, "canteen");
      markAppInstalled("canteen", true);
      installInProgress.current = false;
      setInstalling(false);
      setInstalled(true);
      setStatus("");
    };
    const checkPrompt = () => {
      if (!getDeferredInstallPrompt("canteen")) return;
      if (promptFallbackTimer !== undefined) window.clearTimeout(promptFallbackTimer);
      setInstallAvailability("native");
      setStatus("");
    };
    const unsubscribe = subscribeToInstallPrompt(checkPrompt);
    const checkWhenVisible = () => {
      if (document.visibilityState === "visible") checkInstalled();
    };

    checkInstalled();
    checkPrompt();
    const activeManifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')?.href ?? "";
    if (getDeferredInstallPrompt("canteen")) {
      setInstallAvailability("native");
    } else if (!window.isSecureContext || !activeManifest.includes("manifest-canteen") || !("serviceWorker" in navigator)) {
      setInstallAvailability("guide");
    } else {
      // The capture script registers the worker early. Wait for it to become active,
      // then allow Chrome time to dispatch beforeinstallprompt before offering guidance.
      promptFallbackTimer = window.setTimeout(() => setInstallAvailability("guide"), 15000);
      void navigator.serviceWorker.ready.then(() => {
        if (!active || getDeferredInstallPrompt("canteen")) return;
        if (promptFallbackTimer !== undefined) window.clearTimeout(promptFallbackTimer);
        promptFallbackTimer = window.setTimeout(() => setInstallAvailability("guide"), 5000);
      }).catch(() => {
        if (active && !getDeferredInstallPrompt("canteen")) setInstallAvailability("guide");
      });
    }
    window.addEventListener("pageshow", checkInstalled);
    window.addEventListener("focus", checkInstalled);
    window.addEventListener("appinstalled", onAppInstalled);
    document.addEventListener("visibilitychange", checkWhenVisible);
    return () => {
      active = false;
      if (promptFallbackTimer !== undefined) window.clearTimeout(promptFallbackTimer);
      unsubscribe();
      window.removeEventListener("pageshow", checkInstalled);
      window.removeEventListener("focus", checkInstalled);
      window.removeEventListener("appinstalled", onAppInstalled);
      document.removeEventListener("visibilitychange", checkWhenVisible);
    };
  }, []);

  async function handleInstall() {
    if (installed || installInProgress.current) return;
    const promptEvent = getDeferredInstallPrompt("canteen");
    if (!promptEvent) {
      if (installAvailability === "checking") return;
      setStatus(getInstallFallback("canteen"));
      return;
    }

    installInProgress.current = true;
    setInstalling(true);
    setStatus("");
    setPendingInstallApp("canteen");
    try {
      if (promptEvent) {
        const promptResult = promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        clearDeferredInstallPrompt(promptEvent, "canteen");
        if (choice.outcome === "dismissed") {
          setPendingInstallApp(null);
          installInProgress.current = false;
          setInstalling(false);
          setInstallAvailability("guide");
          return;
        }
        await promptResult;
      }

      if (await isAppInstalled("canteen")) {
        markAppInstalled("canteen", true);
        setInstalled(true);
        setPendingInstallApp(null);
        installInProgress.current = false;
        setInstalling(false);
      } else {
        installInProgress.current = false;
        setInstalling(false);
        setInstallAvailability("guide");
        setStatus("Waiting for Chrome to confirm installation…");
      }
    } catch {
      setPendingInstallApp(null);
      installInProgress.current = false;
      setInstalling(false);
      if (promptEvent) clearDeferredInstallPrompt(promptEvent, "canteen");
      setInstallAvailability("guide");
      setStatus(getInstallFallback("canteen"));
    }
  }

  return (
    <main className="hungry-install-page relative flex min-h-[100dvh] items-center overflow-hidden bg-[#050505] px-4 py-7 text-white sm:px-7 sm:py-10 lg:px-10">
      <ThemeToggle className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_4%,rgba(190,0,18,0.27),transparent_48%),radial-gradient(ellipse_at_6%_85%,rgba(130,0,12,0.14),transparent_42%)]" />
      <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full opacity-70" preserveAspectRatio="none" viewBox="0 0 1440 900">
        <defs>
          <filter height="180%" id="install-red-glow" width="180%" x="-40%" y="-40%">
            <feGaussianBlur result="blur" stdDeviation="7" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <path d="M-80 700 C220 510 340 850 650 665 S1070 490 1520 680" fill="none" filter="url(#install-red-glow)" stroke="rgba(230,0,18,.18)" strokeWidth="2" />
        <path d="M-40 760 C250 600 420 880 740 715 S1120 570 1490 760" fill="none" stroke="rgba(255,255,255,.045)" strokeWidth="1" />
      </svg>
      <div className="relative mx-auto w-full max-w-5xl">
        <nav className="mb-5 sm:mb-7">
          <a className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/25 px-4 py-2.5 text-sm font-medium text-white/70 transition hover:border-primary/45 hover:text-white" href="/">
            <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Back to HUNGRY Z Website
          </a>
        </nav>
        <section className="hungry-install-card relative overflow-hidden rounded-[1.6rem] border border-primary/35 bg-[linear-gradient(140deg,rgba(25,10,11,0.95),rgba(7,7,7,0.98)_54%,rgba(18,7,8,0.96))] px-5 py-7 shadow-[0_24px_90px_rgba(0,0,0,0.5),0_0_55px_rgba(230,0,18,0.13)] sm:rounded-[2rem] sm:px-10 sm:py-10 lg:px-14 lg:py-12">
          <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-primary/10 blur-[90px]" />
          <div className="relative mx-auto max-w-3xl text-center">
            <img src="/HUNGRY%20Z%20CANTEEN%20DAHSBOARD%20LOGO.png" alt="HUNGRY Z Canteen Dashboard" className="mx-auto mb-5 h-24 w-24 rounded-full object-contain sm:h-28 sm:w-28" />
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.24em] text-primary-bright sm:text-xs">ARE YOU A CANTEEN OWNER?</p>
            <h1 className="display text-[clamp(2.1rem,7vw,4.25rem)] font-extrabold leading-[1.02] tracking-[-0.055em]">
              <span className="block text-white">HUNGRY Z</span>
              <span className="mt-1 block bg-gradient-to-r from-white via-white to-primary-bright bg-clip-text text-transparent">Canteen Dashboard</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-white/65 sm:mt-5 sm:text-base">Manage your canteen menu, orders and daily operations with HUNGRY Z.</p>

            <div className="mt-7 grid grid-cols-3 gap-2.5 text-left sm:mt-9 sm:gap-4">
              <div className="min-w-0 rounded-2xl border border-white/10 bg-black/25 px-2.5 py-3.5 sm:px-4 sm:py-4">
                <Utensils aria-hidden="true" className="mx-auto mb-2 h-5 w-5 text-primary-bright sm:mx-0 sm:mb-3 sm:h-6 sm:w-6" strokeWidth={1.7} />
                <h2 className="text-center text-xs font-semibold text-white sm:text-left sm:text-sm">Manage Menu</h2>
              </div>
              <div className="min-w-0 rounded-2xl border border-white/10 bg-black/25 px-2.5 py-3.5 sm:px-4 sm:py-4">
                <ClipboardList aria-hidden="true" className="mx-auto mb-2 h-5 w-5 text-primary-bright sm:mx-0 sm:mb-3 sm:h-6 sm:w-6" strokeWidth={1.7} />
                <h2 className="text-center text-xs font-semibold text-white sm:text-left sm:text-sm">Track Orders</h2>
              </div>
              <div className="min-w-0 rounded-2xl border border-white/10 bg-black/25 px-2.5 py-3.5 sm:px-4 sm:py-4">
                <ChartNoAxesColumnIncreasing aria-hidden="true" className="mx-auto mb-2 h-5 w-5 text-primary-bright sm:mx-0 sm:mb-3 sm:h-6 sm:w-6" strokeWidth={1.7} />
                <h2 className="text-center text-xs font-semibold text-white sm:text-left sm:text-sm">Canteen Insights</h2>
              </div>
            </div>

            <button
              className="mt-6 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-4 text-sm font-bold text-white shadow-[0_8px_26px_rgba(230,0,18,0.28)] transition hover:bg-primary-bright disabled:cursor-default disabled:opacity-80 sm:mt-8 sm:text-base"
              disabled={installed || installing || installAvailability === "checking"}
              onClick={() => void handleInstall()}
              type="button"
            >
              {installed ? "Already Installed" : installing ? "Opening install prompt…" : installAvailability === "checking" ? "Preparing install prompt…" : "Install Canteen Dashboard"}
              {!installed && <ArrowDown aria-hidden="true" className="h-5 w-5" />}
            </button>
            {status && <p className="mt-4 text-center text-sm leading-relaxed text-white/60" role="status">{status}</p>}
            <p className="mt-5 text-center text-xs leading-relaxed text-white/45">After installation, open Register Canteen / Login Canteen from your home screen.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
