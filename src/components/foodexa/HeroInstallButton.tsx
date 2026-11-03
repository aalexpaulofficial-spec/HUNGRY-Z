import { useEffect, useRef, useState, type MouseEvent } from "react";
import { ArrowRight, Download } from "lucide-react";
import {
  clearDeferredInstallPrompt,
  getDeferredInstallPrompt,
  getPendingInstallApp,
  isAppInstalled,
  markAppInstalled,
  setPendingInstallApp,
  subscribeToInstallPrompt,
  type HungryApp,
} from "@/lib/pwa-install";
import { AlreadyInstalledDialog } from "@/components/foodexa/AlreadyInstalledDialog";
import { HungryInstallGuideDialog } from "@/components/foodexa/HungryInstallGuideDialog";

const copy = {
  student: {
    download: "Download HUNGRY",
    ariaLabel: "Download HUNGRY for Students, Faculty and Guests",
  },
  canteen: {
    download: "Download Canteen Dashboard",
    ariaLabel: "Download the Canteen Dashboard for Canteen Owners",
  },
} satisfies Record<HungryApp, { download: string; ariaLabel: string }>;

export function HeroInstallButton({ app }: { app: HungryApp; dedicatedInstallPage?: boolean }) {
  const [installed, setInstalled] = useState(false);
  const [showInstalledDialog, setShowInstalledDialog] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [installAvailability, setInstallAvailability] = useState<"checking" | "native" | "guide">("checking");
  const installCheckRevision = useRef(0);
  const label = copy[app];

  useEffect(() => {
    let active = true;
    const updateInstalled = () => {
      const revision = ++installCheckRevision.current;
      void isAppInstalled(app).then((result) => {
        if (!active || revision !== installCheckRevision.current) return;
        if (result) {
          setInstalled(true);
        } else if (
          app !== "student" ||
          typeof (navigator as Navigator & { getInstalledRelatedApps?: () => Promise<unknown[]> }).getInstalledRelatedApps === "function"
        ) {
          setInstalled(false);
        }
        if (result && getPendingInstallApp() === app) {
          setPendingInstallApp(null);
        }
      });
    };
    const updateWhenVisible = () => {
      if (document.visibilityState === "visible") updateInstalled();
    };
    let promptFallbackTimer: number | undefined;
    const onPromptAvailable = () => {
      updateInstalled();
      if (app === "student" && getDeferredInstallPrompt(app)) {
        if (promptFallbackTimer !== undefined) window.clearTimeout(promptFallbackTimer);
        setInstallAvailability("native");
      }
    };
    const unsubscribePrompt = subscribeToInstallPrompt(onPromptAvailable);
    const onAppInstalled = () => {
      if (getPendingInstallApp() !== app) return;
      installCheckRevision.current += 1;
      setPendingInstallApp(null);
      clearDeferredInstallPrompt(undefined, app);
      markAppInstalled(app, true);
      setInstalled(true);
    };
    updateInstalled();
    if (app === "student") {
      if (getDeferredInstallPrompt(app)) {
        setInstallAvailability("native");
      } else if (!window.isSecureContext || !("serviceWorker" in navigator)) {
        setInstallAvailability("guide");
      } else {
        // Wait for the active worker, then give Chrome time to assess this manifest.
        // If it never offers beforeinstallprompt, switch to an explicit guide instead of a no-op.
        promptFallbackTimer = window.setTimeout(() => setInstallAvailability("guide"), 15000);
        void navigator.serviceWorker.ready.then(() => {
          if (!active || getDeferredInstallPrompt(app)) return;
          if (promptFallbackTimer !== undefined) window.clearTimeout(promptFallbackTimer);
          promptFallbackTimer = window.setTimeout(() => setInstallAvailability("guide"), 5000);
        }).catch(() => {
          if (active && !getDeferredInstallPrompt(app)) setInstallAvailability("guide");
        });
      }
    }
    window.addEventListener("pageshow", updateInstalled);
    window.addEventListener("focus", updateInstalled);
    window.addEventListener("appinstalled", onAppInstalled);
    document.addEventListener("visibilitychange", updateWhenVisible);
    return () => {
      active = false;
      if (promptFallbackTimer !== undefined) window.clearTimeout(promptFallbackTimer);
      unsubscribePrompt();
      window.removeEventListener("pageshow", updateInstalled);
      window.removeEventListener("focus", updateInstalled);
      window.removeEventListener("appinstalled", onAppInstalled);
      document.removeEventListener("visibilitychange", updateWhenVisible);
    };
  }, [app]);

  async function handleDownload(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (app === "canteen") {
      if (installed) return;
      window.location.assign("/install/canteen");
      return;
    }

    if (installed) {
      setShowInstalledDialog(true);
      return;
    }

    const promptEvent = getDeferredInstallPrompt("student");
    if (!promptEvent) {
      setInstallAvailability("guide");
      setShowInstallGuide(true);
      return;
    }

    setPendingInstallApp("student");
    try {
      const promptResult = promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      clearDeferredInstallPrompt(promptEvent);
      if (choice.outcome === "dismissed") {
        setPendingInstallApp(null);
        setInstallAvailability("guide");
        return;
      }
      await promptResult;
      if (await isAppInstalled("student")) {
        setPendingInstallApp(null);
        setInstalled(true);
      } else {
        setInstallAvailability("guide");
      }
    } catch {
      setPendingInstallApp(null);
      clearDeferredInstallPrompt(promptEvent);
      setInstallAvailability("guide");
      setShowInstallGuide(true);
    }
  }

  return (
    <div className="flex min-w-0 flex-col items-start gap-2">
      {app === "canteen" && !installed ? (
        <a
          href="/install/canteen"
          aria-label={label.ariaLabel}
          className="group inline-flex min-w-0 max-w-full shrink items-center justify-center gap-2 whitespace-normal rounded-full border border-primary/60 bg-background px-4 py-3.5 text-center text-[13px] font-semibold leading-tight text-foreground transition-all duration-300 hover:scale-[1.03] hover:border-primary hover:shadow-[0_0_30px_-4px_var(--primary-bright)] sm:whitespace-nowrap sm:px-6 sm:text-sm"
        >
          <Download aria-hidden="true" className="h-4 w-4" /> {label.download}
        </a>
      ) : (
        <button
          type="button"
          aria-label={installed ? "Already Installed" : app === "student" && installAvailability === "checking" ? "Checking HUNGRY install availability" : app === "student" && installAvailability === "guide" ? "Show the HUNGRY installation guide" : label.ariaLabel}
          disabled={(app === "student" && !installed && installAvailability === "checking") || (app === "canteen" && installed)}
          onClick={(event) => void handleDownload(event)}
          className="group inline-flex min-w-0 max-w-full shrink items-center justify-center gap-2 whitespace-normal rounded-full border border-primary/60 bg-background px-4 py-3.5 text-center text-[13px] font-semibold leading-tight text-foreground transition-all duration-300 hover:scale-[1.03] hover:border-primary hover:shadow-[0_0_30px_-4px_var(--primary-bright)] disabled:cursor-default disabled:opacity-80 sm:whitespace-nowrap sm:px-6 sm:text-sm"
        >
          {installed ? <ArrowRight aria-hidden="true" className="h-4 w-4" /> : <Download aria-hidden="true" className="h-4 w-4" />}
          {installed ? "Already Installed" : app === "student" && installAvailability === "checking" ? "Preparing HUNGRY install…" : app === "student" && installAvailability === "guide" ? "Install HUNGRY" : label.download}
        </button>
      )}
      {app === "student" && showInstalledDialog && <AlreadyInstalledDialog onClose={() => setShowInstalledDialog(false)} />}
      {app === "student" && showInstallGuide && <HungryInstallGuideDialog onClose={() => setShowInstallGuide(false)} />}
    </div>
  );
}
