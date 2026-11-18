import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "dark" | "light";
type ThemeScope = "site" | "canteen";

function getStorageKey(scope: ThemeScope) {
  return scope === "canteen" ? "hungry-canteen-theme" : "hungry-theme";
}

function readTheme(scope: ThemeScope): Theme {
  try {
    const stored = window.localStorage.getItem(getStorageKey(scope));
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // Fall back to the theme applied by the pre-hydration script.
  }
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function applyHungryTheme(theme: Theme, scope: ThemeScope = "site") {
  document.documentElement.dataset.theme = theme;
  try {
    window.localStorage.setItem(getStorageKey(scope), theme);
  } catch {
    // Keep the current-page preference when browser storage is unavailable.
  }
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute("content", theme === "light" ? "#ffffff" : "#050505");
  window.dispatchEvent(new CustomEvent("hungry-theme-change", { detail: theme }));
}

export function ThemeToggle({ className = "", scope = "site" }: { className?: string; scope?: ThemeScope }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme(readTheme(scope));
    const sync = () => setTheme(readTheme(scope));
    window.addEventListener("hungry-theme-change", sync);
    return () => window.removeEventListener("hungry-theme-change", sync);
  }, [scope]);

  const nextTheme = theme === "dark" ? "light" : "dark";
  const Icon = theme === "dark" ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={() => {
        applyHungryTheme(nextTheme, scope);
        setTheme(nextTheme);
      }}
      aria-label={`Switch to ${nextTheme === "light" ? "White" : "HUNGRY Z"} Theme`}
      title={`Switch to ${nextTheme === "light" ? "White" : "HUNGRY Z"} Theme`}
      aria-pressed={theme === "light"}
      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition hover:border-primary/50 hover:text-primary ${className}`}
    >
      <Icon aria-hidden="true" className="h-4 w-4" />
      <span className="sr-only">{theme === "light" ? "White Theme" : "HUNGRY Z Theme"}</span>
    </button>
  );
}
