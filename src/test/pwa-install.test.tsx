import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("motion/react", () => ({
  motion: { span: ({ children }: { children: ReactNode }) => <span>{children}</span> },
  AnimatePresence: ({ children }: { children: ReactNode }) => children,
}));

import { HeroInstallButton } from "@/components/foodexa/HeroInstallButton";
import { CanteenInstallPage } from "@/routes/install.canteen";
import { landingManifestHref } from "@/routes/index";
import {
  clearDeferredInstallPrompt,
  getDeferredInstallPrompt,
  getInstallFallback,
  isAppInstalled,
  markAppInstalled,
  subscribeToInstallPrompt,
  type InstallPromptEvent,
} from "@/lib/pwa-install";
import studentManifestSource from "../../public/manifest-student.webmanifest?raw";
import canteenManifestSource from "../../public/manifest-canteen.webmanifest?raw";

type InstallManifest = {
  id: string;
  name: string;
  start_url: string;
  scope: string;
  theme_color: string;
  short_name: string;
  icons: { src: string; type: string; sizes: string }[];
};

const studentManifest = JSON.parse(studentManifestSource) as InstallManifest;
const canteenManifest = JSON.parse(canteenManifestSource) as InstallManifest;

function setManifest(name: "student" | "canteen") {
  document.head.querySelector('link[rel="manifest"]')?.remove();
  const manifest = document.createElement("link");
  manifest.rel = "manifest";
  manifest.href = `/manifest-${name}.webmanifest`;
  document.head.append(manifest);
}

describe("independent HUNGRY PWA install flows", () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, "", "/");
    setManifest("student");
  });

  afterEach(() => {
    cleanup();
    clearDeferredInstallPrompt();
    Reflect.deleteProperty(navigator, "install");
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("keeps separate student and owner PWA identities and launch pages", () => {
    expect(studentManifest.id).not.toBe(canteenManifest.id);
    expect(studentManifest.name).toBe("HUNGRY");
    expect(studentManifest.start_url).toBe("/auth?hungry_app=student");
    expect(canteenManifest.name).toBe("HUNGRY Canteen Dashboard");
    expect(canteenManifest.start_url).toBe("/register-canteen?hungry_app=canteen");
    expect(studentManifest.scope).toBe("/");
    expect(canteenManifest.scope).toBe("/");
    expect(studentManifest.icons.map((icon) => icon.src)).not.toEqual(canteenManifest.icons.map((icon) => icon.src));
  });

  it("uses the HUNGRY manifest on the landing page so the student prompt is captured", () => {
    expect(landingManifestHref).toBe("/manifest-student.webmanifest");
  });

  it("detects each installation using the browser's related-apps result", async () => {
    Object.defineProperty(navigator, "getInstalledRelatedApps", {
      configurable: true,
      value: vi.fn().mockResolvedValue([{ platform: "webapp", id: `${window.location.origin}/?hungry_app=student` }]),
    });
    await expect(isAppInstalled("student")).resolves.toBe(true);
    await expect(isAppInstalled("canteen")).resolves.toBe(false);
    expect(localStorage.getItem("hungry:pwa:installed:student")).toBe("confirmed");
    expect(localStorage.getItem("hungry:pwa:installed:canteen")).toBeNull();
  });

  it("does not claim installation when the browser cannot report it", async () => {
    Object.defineProperty(navigator, "getInstalledRelatedApps", { configurable: true, value: undefined });
    await expect(isAppInstalled("student")).resolves.toBe(false);
    await expect(isAppInstalled("canteen")).resolves.toBe(false);
  });

  it("keeps confirmed install state separate and clears it when Chrome offers a fresh prompt", async () => {
    setManifest("canteen");
    Object.defineProperty(navigator, "getInstalledRelatedApps", { configurable: true, value: undefined });
    markAppInstalled("canteen", true);
    await expect(isAppInstalled("canteen")).resolves.toBe(true);
    await expect(isAppInstalled("student")).resolves.toBe(false);

    window.dispatchEvent(Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: "dismissed" as const, platform: "web" }),
    }));
    await expect(isAppInstalled("canteen")).resolves.toBe(false);
  });

  it("captures a native prompt only for the manifest active on this page", () => {
    const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: "accepted" as const, platform: "web" }),
    }) as InstallPromptEvent;
    const update = vi.fn();
    const unsubscribe = subscribeToInstallPrompt(update);
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(getDeferredInstallPrompt("student")).toBe(event);
    expect(getDeferredInstallPrompt("canteen")).toBeNull();
    expect(update).toHaveBeenCalledOnce();
    clearDeferredInstallPrompt(event);
    expect(getDeferredInstallPrompt()).toBeNull();
    unsubscribe();
  });

  it("adopts a prompt captured by the pre-hydration listener", () => {
    const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: "accepted" as const, platform: "web" }),
    }) as InstallPromptEvent;
    const installWindow = window as Window & {
      __hungryPwaInstallState?: { prompts?: Partial<Record<"student" | "canteen", InstallPromptEvent>> };
    };
    installWindow.__hungryPwaInstallState = { prompts: { student: event } };
    window.dispatchEvent(new CustomEvent("hungry-pwa-install-prompt", { detail: { app: "student" } }));
    expect(getDeferredInstallPrompt("student")).toBe(event);
    delete installWindow.__hungryPwaInstallState;
  });

  it("retains the canteen prompt independently when its manifest is active", () => {
    setManifest("canteen");
    const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: "accepted" as const, platform: "web" }),
    }) as InstallPromptEvent;
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(getDeferredInstallPrompt("canteen")).toBe(event);
    expect(getDeferredInstallPrompt("student")).toBeNull();
  });

  it("provides an iOS Add to Home Screen fallback without claiming installation", () => {
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1", platform: "", maxTouchPoints: 0 });
    expect(getInstallFallback("student")).toContain("Add to Home Screen");
    expect(getInstallFallback("student")).not.toContain("already installed");
  });

  it("shows the fixed student label until browser-reported installation succeeds", async () => {
    Object.defineProperty(navigator, "getInstalledRelatedApps", {
      configurable: true,
      value: vi.fn().mockResolvedValue([{ platform: "webapp", id: `${window.location.origin}/?hungry_app=student` }]),
    });
    render(<HeroInstallButton app="student" />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(screen.getByRole("button", { name: "Already Installed" })).toHaveTextContent("Already Installed");
  });

  it("directly prompts from the landing-page click without navigating to an install route", async () => {
    Object.defineProperty(navigator, "getInstalledRelatedApps", { configurable: true, value: vi.fn().mockResolvedValue([]) });
    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
      prompt,
      userChoice: Promise.resolve({ outcome: "accepted" as const, platform: "web" }),
    }) as InstallPromptEvent;
    window.dispatchEvent(event);
    render(<HeroInstallButton app="student" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Download HUNGRY for Students, Faculty and Guests" }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(prompt).toHaveBeenCalledOnce();
    expect(window.location.pathname).toBe("/");
    expect(screen.getByRole("button", { name: "Show the HUNGRY installation guide" })).toBeInTheDocument();
    await act(async () => { window.dispatchEvent(new Event("appinstalled")); });
    expect(screen.getByRole("button", { name: "Already Installed" })).toHaveTextContent("Already Installed");
    expect(window.location.pathname).toBe("/");
  });

  it("opens a HUNGRY-branded guide instead of ignoring clicks when Chrome offers no prompt", async () => {
    Object.defineProperty(navigator, "getInstalledRelatedApps", { configurable: true, value: undefined });
    render(<HeroInstallButton app="student" />);
    const guideButton = await screen.findByRole("button", { name: "Show the HUNGRY installation guide" });
    fireEvent.click(guideButton);
    expect(screen.getByRole("dialog", { name: "Install HUNGRY" })).toBeInTheDocument();
    expect(screen.getByText(/Chrome has not offered its install prompt yet/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Got it" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Already Installed" })).not.toBeInTheDocument();
  });

  it("shows the existing HUNGRY installed popup and login destination", async () => {
    Object.defineProperty(navigator, "getInstalledRelatedApps", {
      configurable: true,
      value: vi.fn().mockResolvedValue([{ platform: "webapp", id: `${window.location.origin}/?hungry_app=student` }]),
    });
    render(<HeroInstallButton app="student" />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    fireEvent.click(screen.getByRole("button", { name: "Already Installed" }));
    expect(screen.getByRole("heading", { name: "Already Installed" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "HUNGRY" })).toBeInTheDocument();
    expect(screen.getByText("HUNGRY is already installed on your device. You can launch it anytime from your home screen or desktop, or start ordering right now!")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start Ordering in App" })).toBeDisabled();
    expect(screen.queryByRole("link", { name: /Start Ordering/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("opens the dedicated canteen installation page from the landing action", () => {
    render(<HeroInstallButton app="canteen" />);
    expect(screen.getByRole("link", { name: "Download the Canteen Dashboard for Canteen Owners" })).toHaveAttribute("href", "/install/canteen");
  });

  it("does not claim the Canteen app installed until Chrome confirms it", async () => {
    setManifest("canteen");
    Object.defineProperty(navigator, "getInstalledRelatedApps", { configurable: true, value: vi.fn().mockResolvedValue([]) });
    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
      prompt,
      userChoice: Promise.resolve({ outcome: "accepted" as const, platform: "web" }),
    }) as InstallPromptEvent;
    window.dispatchEvent(event);
    render(<CanteenInstallPage />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Install Canteen Dashboard" }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(prompt).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "Already Installed" })).not.toBeInTheDocument();

    await act(async () => { window.dispatchEvent(new Event("appinstalled")); });
    const installedButton = screen.getByRole("button", { name: "Already Installed" });
    expect(installedButton).toHaveTextContent("Already Installed");
    expect(installedButton).toBeDisabled();
    expect(screen.queryByRole("heading", { name: "Installation Successful!" })).not.toBeInTheDocument();
  });

  it("waits for the Canteen prompt instead of immediately showing the Chrome fallback", async () => {
    setManifest("canteen");
    Object.defineProperty(navigator, "getInstalledRelatedApps", { configurable: true, value: vi.fn().mockResolvedValue([]) });
    render(<CanteenInstallPage />);
    expect(screen.queryByText(/Chrome did not offer the Canteen Dashboard install prompt/)).not.toBeInTheDocument();

    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
      prompt,
      userChoice: Promise.resolve({ outcome: "accepted" as const, platform: "web" }),
    }) as InstallPromptEvent;
    await act(async () => { window.dispatchEvent(event); });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Install Canteen Dashboard" }));
      await Promise.resolve();
    });
    expect(prompt).toHaveBeenCalledOnce();
    expect(screen.queryByText(/Chrome did not offer the Canteen Dashboard install prompt/)).not.toBeInTheDocument();
  });

  it("does not trigger another installation from the landing button after confirmation", async () => {
    setManifest("canteen");
    Object.defineProperty(navigator, "getInstalledRelatedApps", {
      configurable: true,
      value: vi.fn().mockResolvedValue([{ platform: "webapp", id: `${window.location.origin}/?hungry_app=canteen` }]),
    });
    render(<HeroInstallButton app="canteen" dedicatedInstallPage />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByRole("button", { name: "Already Installed" })).toBeDisabled();
    expect(screen.queryByRole("link", { name: /Already Installed/ })).not.toBeInTheDocument();
  });

});
