import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "dark" | "light";
const STORAGE_KEY = "hungry-theme";

function readTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function applyHungryTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Keep the current-page preference when browser storage is unavailable.
  }
  window.dispatchEvent(new CustomEvent("hungry-theme-change", { detail: theme }));
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    setTheme(readTheme());
    const sync = () => setTheme(readTheme());
    window.addEventListener("hungry-theme-change", sync);
    return () => window.removeEventListener("hungry-theme-change", sync);
  }, []);

  const nextTheme = theme === "dark" ? "light" : "dark";
  const Icon = theme === "dark" ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={() => {
        applyHungryTheme(nextTheme);
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
