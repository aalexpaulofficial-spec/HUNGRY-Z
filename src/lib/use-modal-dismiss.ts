import { useCallback, useEffect, useRef } from "react";
import { useBackStep } from "@/lib/back-nav";

/** Keeps browser Back, the dashboard Back button, Escape, and the dialog's X in sync. */
export function useModalDismiss(onClose: () => void) {
  const onCloseRef = useRef(onClose);
  const entryId = useRef<string | null>(null);
  if (entryId.current === null) entryId.current = `hungry-modal-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
  onCloseRef.current = onClose;

  useEffect(() => {
    const id = entryId.current!;
    if (window.history.state?.__hungryModalId !== id) {
      window.history.pushState({ ...(window.history.state ?? {}), __hungryModalId: id }, "", window.location.href);
    }
    const onPopState = () => {
      if (window.history.state?.__hungryModalId !== id) onCloseRef.current();
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const close = useCallback(() => {
    onCloseRef.current();
    if (window.history.state?.__hungryModalId === entryId.current) window.history.back();
  }, []);

  useBackStep(true, close);
  return close;
}
