import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

/** Small route UI snapshots survive dashboard → secondary page → Back and refresh. */
export function useSessionState<T>(key: string, initialValue: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const saved = window.sessionStorage.getItem(key);
      return saved == null ? initialValue : (JSON.parse(saved) as T);
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      // A full or disabled session storage must not prevent dashboard use.
    }
  }, [key, value]);

  return [value, setValue];
}

export function clearSessionState(...keys: string[]) {
  try {
    keys.forEach((key) => window.sessionStorage.removeItem(key));
  } catch {
    // Storage is optional; authentication sign-out still proceeds.
  }
}
