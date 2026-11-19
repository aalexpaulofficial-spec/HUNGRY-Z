import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, BellOff, CheckCheck, LoaderCircle, Smartphone, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type NotificationRow = {
  id: string;
  notification_type: string;
  title: string;
  body: string;
  href: string;
  created_at: string;
  read_at: string | null;
};

type PushPermission = "default" | "granted" | "denied" | "unsupported";
type PushRegistrationState = "idle" | "working" | "enabled" | "disabled" | "error";
type DashboardLanguage = "en" | "hi" | "kn";

const COPY: Record<DashboardLanguage, Record<string, string>> = {
  en: {
    notifications: "Notifications",
    markAll: "Mark all read",
    empty: "You're all caught up.",
    enable: "Enable on this device",
    disable: "Disable on this device",
    why: "Get order and event updates even when HUNGRY Z is closed.",
    permission: "Browser permission",
    granted: "Allowed",
    denied: "Blocked in browser settings",
    default: "Not enabled",
    unsupported: "Push isn't supported in this browser.",
    settings: "Notification settings",
    enabled: "Push is enabled on this device.",
    disabled: "Push is off on this device.",
    error: "Could not update this device. Please try again.",
    open: "Open notification",
    close: "Close notifications",
  },
  hi: {
    notifications: "सूचनाएँ",
    markAll: "सभी पढ़े हुए करें",
    empty: "अभी कोई नई सूचना नहीं है।",
    enable: "इस डिवाइस पर चालू करें",
    disable: "इस डिवाइस पर बंद करें",
    why: "HUNGRY Z बंद होने पर भी ऑर्डर और कार्यक्रम के अपडेट पाएँ।",
    permission: "ब्राउज़र अनुमति",
    granted: "अनुमति है",
    denied: "ब्राउज़र सेटिंग में अवरुद्ध",
    default: "चालू नहीं है",
    unsupported: "इस ब्राउज़र में पुश उपलब्ध नहीं है।",
    settings: "सूचना सेटिंग",
    enabled: "इस डिवाइस पर पुश चालू है।",
    disabled: "इस डिवाइस पर पुश बंद है।",
    error: "डिवाइस अपडेट नहीं हो सका। फिर कोशिश करें।",
    open: "सूचना खोलें",
    close: "सूचनाएँ बंद करें",
  },
  kn: {
    notifications: "ಅಧಿಸೂಚನೆಗಳು",
    markAll: "ಎಲ್ಲವನ್ನೂ ಓದಿದಂತೆ ಗುರುತಿಸಿ",
    empty: "ಹೊಸ ಅಧಿಸೂಚನೆಗಳಿಲ್ಲ.",
    enable: "ಈ ಸಾಧನದಲ್ಲಿ ಸಕ್ರಿಯಗೊಳಿಸಿ",
    disable: "ಈ ಸಾಧನದಲ್ಲಿ ನಿಷ್ಕ್ರಿಯಗೊಳಿಸಿ",
    why: "HUNGRY Z ಮುಚ್ಚಿದ್ದರೂ ಆರ್ಡರ್ ಮತ್ತು ಕಾರ್ಯಕ್ರಮದ ಅಪ್‌ಡೇಟ್ ಪಡೆಯಿರಿ.",
    permission: "ಬ್ರೌಸರ್ ಅನುಮತಿ",
    granted: "ಅನುಮತಿಸಲಾಗಿದೆ",
    denied: "ಬ್ರೌಸರ್ ಸೆಟ್ಟಿಂಗ್‌ಗಳಲ್ಲಿ ನಿರ್ಬಂಧಿಸಲಾಗಿದೆ",
    default: "ಸಕ್ರಿಯವಾಗಿಲ್ಲ",
    unsupported: "ಈ ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಪುಶ್ ಬೆಂಬಲಿತವಲ್ಲ.",
    settings: "ಅಧಿಸೂಚನೆ ಸೆಟ್ಟಿಂಗ್‌ಗಳು",
    enabled: "ಈ ಸಾಧನದಲ್ಲಿ ಪುಶ್ ಸಕ್ರಿಯವಾಗಿದೆ.",
    disabled: "ಈ ಸಾಧನದಲ್ಲಿ ಪುಶ್ ಆಫ್ ಆಗಿದೆ.",
    error: "ಸಾಧನವನ್ನು ನವೀಕರಿಸಲಾಗಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
    open: "ಅಧಿಸೂಚನೆ ತೆರೆಯಿರಿ",
    close: "ಅಧಿಸೂಚನೆಗಳನ್ನು ಮುಚ್ಚಿ",
  },
};

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

function publicVapidKey(): string | null {
  const key = import.meta.env["VITE_VAPID_PUBLIC_KEY"];
  return typeof key === "string" && key.length > 0 ? key : null;
}

export function NotificationBell({
  userId,
  language = "en",
}: {
  userId: string;
  language?: DashboardLanguage;
}) {
  const labels = COPY[language];
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [permission, setPermission] = useState<PushPermission>("unsupported");
  const [pushState, setPushState] = useState<PushRegistrationState>("idle");
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [list, count] = await Promise.all([
        supabase
          .from("notifications" as never)
          .select("id,notification_type,title,body,href,created_at,read_at")
          .eq("recipient_user_id", userId)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("notifications" as never)
          .select("id", { count: "exact", head: true })
          .eq("recipient_user_id", userId)
          .is("read_at", null),
      ]);
      if (!list.error) setRows((list.data ?? []) as unknown as NotificationRow[]);
      if (!count.error) setUnreadCount(count.count ?? 0);
    } catch {
      // Keep the authenticated dashboard usable in test/limited Supabase clients.
    }
  }, [userId]);

  const registerSubscription = useCallback(
    async (subscription: PushSubscription | PushSubscriptionJSON) => {
      const { error } = await supabase.functions.invoke("manage-push-subscription", {
        body: {
          action: "subscribe",
          subscription: "toJSON" in subscription ? subscription.toJSON() : subscription,
        },
      });
      if (error) throw new Error("Could not register this device.");
    },
    [],
  );

  useEffect(() => {
    void refresh();
    if (typeof supabase.channel !== "function") return;
    const channel = supabase
      .channel(`hz-notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `recipient_user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const notification = payload.new as NotificationRow;
            toast(notification.title, { description: notification.body });
          }
          void refresh();
        },
      )
      .subscribe();
    return () => {
      if (typeof supabase.removeChannel === "function") void supabase.removeChannel(channel);
    };
  }, [refresh, userId]);

  useEffect(() => {
    if (
      !("Notification" in window) ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !window.isSecureContext
    ) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);
    if (Notification.permission !== "granted") return;
    let active = true;
    void navigator.serviceWorker.ready
      .then(async (registration) => {
        const subscription = await registration.pushManager.getSubscription();
        if (!active || !subscription) return;
        await registerSubscription(subscription);
        if (active) setPushState("enabled");
      })
      .catch(() => {
        if (active) setPushState("error");
      });
    const onWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === "HUNGRYZ_PUSH") void refresh();
      if (event.data?.type === "HUNGRYZ_PUSH_SUBSCRIPTION_CHANGED") {
        void navigator.serviceWorker.ready
          .then(async (registration) => {
            let subscription = event.data?.subscription as PushSubscriptionJSON | null | undefined;
            if (!subscription) {
              subscription = await registration.pushManager
                .getSubscription()
                .then((current) => current?.toJSON());
            }
            if (!subscription) {
              const key = publicVapidKey();
              if (!key || Notification.permission !== "granted") return;
              const renewed = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: base64UrlToBytes(key).slice().buffer as ArrayBuffer,
              });
              await registerSubscription(renewed);
              return;
            }
            await registerSubscription(subscription);
          })
          .catch(() => setPushState("error"));
      }
    };
    navigator.serviceWorker.addEventListener("message", onWorkerMessage);
    return () => {
      active = false;
      navigator.serviceWorker.removeEventListener("message", onWorkerMessage);
    };
  }, [refresh, registerSubscription]);

  const permissionLabel = useMemo(
    () =>
      permission === "granted"
        ? labels.granted
        : permission === "denied"
          ? labels.denied
          : permission === "unsupported"
            ? labels.unsupported
            : labels.default,
    [labels, permission],
  );

  async function enablePush() {
    setPushState("working");
    setMessage("");
    try {
      const key = publicVapidKey();
      if (!key) throw new Error("Push notifications are not configured yet.");
      const currentPermission =
        Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      setPermission(currentPermission);
      if (currentPermission !== "granted") {
        setPushState("disabled");
        setMessage(currentPermission === "denied" ? labels.denied : labels.default);
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToBytes(key).slice().buffer as ArrayBuffer,
        }));
      await registerSubscription(subscription);
      setPushState("enabled");
      setMessage(labels.enabled);
    } catch {
      setPushState("error");
      setMessage(labels.error);
    }
  }

  async function disablePush() {
    setPushState("working");
    setMessage("");
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        const { error } = await supabase.functions.invoke("manage-push-subscription", {
          body: { action: "unsubscribe", endpoint },
        });
        if (error) throw error;
      }
      setPushState("disabled");
      setMessage(labels.disabled);
    } catch {
      setPushState("error");
      setMessage(labels.error);
    }
  }

  async function markRead(notification: NotificationRow) {
    if (!notification.read_at) {
      const readAt = new Date().toISOString();
      const { error } = await supabase
        .from("notifications" as never)
        .update({ read_at: readAt } as never)
        .eq("id", notification.id)
        .eq("recipient_user_id", userId);
      if (error) return;
      setRows((current) =>
        current.map((row) => (row.id === notification.id ? { ...row, read_at: readAt } : row)),
      );
      setUnreadCount((count) => Math.max(0, count - 1));
    }
    setOpen(false);
    const href =
      notification.href.startsWith("/") && !notification.href.startsWith("//")
        ? notification.href
        : "/app";
    window.location.assign(href);
  }

  async function markAllRead() {
    const { error } = await supabase
      .from("notifications" as never)
      .update({ read_at: new Date().toISOString() } as never)
      .eq("recipient_user_id", userId)
      .is("read_at", null);
    if (error) return;
    await refresh();
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`${labels.notifications}${unreadCount ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
        className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border bg-card text-foreground transition hover:border-primary/50 hover:text-primary"
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <section
          role="dialog"
          aria-label={labels.notifications}
          className="absolute right-0 top-12 z-[80] flex max-h-[min(80vh,36rem)] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-border bg-card text-card-foreground shadow-2xl"
        >
          <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <h2 className="font-semibold">{labels.notifications}</h2>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => void markAllRead()}
                  className="rounded-full px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10"
                >
                  <CheckCheck className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
                  {labels.markAll}
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted"
                aria-label={labels.close}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>
          <div className="overflow-y-auto">
            {rows.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">{labels.empty}</p>
            ) : (
              rows.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => void markRead(notification)}
                  className={cn(
                    "block w-full border-b border-border/70 px-4 py-3 text-left transition hover:bg-muted/70",
                    !notification.read_at && "bg-primary/[0.04]",
                  )}
                >
                  <span className="flex items-start gap-2">
                    <span
                      className={cn(
                        "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                        notification.read_at ? "bg-transparent" : "bg-primary",
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <strong className="block text-sm leading-snug">{notification.title}</strong>
                      <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                        {notification.body}
                      </span>
                      <time
                        className="mt-2 block text-[10px] text-muted-foreground"
                        dateTime={notification.created_at}
                      >
                        {new Date(notification.created_at).toLocaleString(
                          language === "hi" ? "hi-IN" : language === "kn" ? "kn-IN" : undefined,
                          { dateStyle: "medium", timeStyle: "short" },
                        )}
                      </time>
                    </span>
                    <span className="sr-only">{labels.open}</span>
                  </span>
                </button>
              ))
            )}
          </div>
          <footer className="border-t border-border px-4 py-3">
            <p className="text-xs font-semibold">{labels.settings}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {labels.permission}: {permissionLabel}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{labels.why}</p>
            {permission === "unsupported" ? (
              <p className="mt-2 text-xs text-muted-foreground">{labels.unsupported}</p>
            ) : permission === "denied" ? (
              <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                <BellOff className="h-3.5 w-3.5" />
                {labels.denied}
              </p>
            ) : (
              <button
                type="button"
                disabled={pushState === "working"}
                onClick={() => void (pushState === "enabled" ? disablePush() : enablePush())}
                className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground disabled:opacity-60"
              >
                {pushState === "working" ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Smartphone className="h-4 w-4" />
                )}
                {pushState === "enabled" ? labels.disable : labels.enable}
              </button>
            )}
            {message && (
              <p role="status" className="mt-2 text-xs text-muted-foreground">
                {message}
              </p>
            )}
          </footer>
        </section>
      )}
    </div>
  );
}
