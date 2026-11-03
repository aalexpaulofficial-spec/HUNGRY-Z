import { cn } from "@/lib/utils";
import burger from "@/assets/food-burger.jpg";
import indian from "@/assets/food-indian.jpg";
import pizza from "@/assets/food-pizza.jpg";
import bowl from "@/assets/food-bowl.jpg";
import coffee from "@/assets/food-coffee.jpg";

export type ScreenKey =
  | "home"
  | "menu"
  | "detail"
  | "cart"
  | "pay"
  | "confirm"
  | "track"
  | "qr"
  | "history";

const items = [
  { name: "Masala Dosa Thali", canteen: "Block A Canteen", price: "₹80", img: indian },
  { name: "Campus Black Burger", canteen: "Food Court", price: "₹120", img: burger },
  { name: "Wood-Fired Margherita", canteen: "Café 24", price: "₹150", img: pizza },
  { name: "Paneer Rice Bowl", canteen: "Block C Mess", price: "₹110", img: bowl },
  { name: "Masala Chai", canteen: "Tea Point", price: "₹20", img: coffee },
];

function StatusBar() {
  return (
    <div className="flex items-center justify-between px-5 pt-3 text-[9px] font-semibold tracking-wide text-foreground/70">
      <span>9:41</span>
      <div className="flex items-center gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-foreground/60" />
        <span className="h-1.5 w-3 rounded-sm bg-foreground/60" />
        <span className="h-1.5 w-4 rounded-sm bg-primary" />
      </div>
    </div>
  );
}

function Brand({ label = "HUNGRY" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid h-5 w-5 place-items-center rounded-md bg-primary text-[9px] font-black text-primary-foreground">
        H
      </span>
      <span className="display text-[11px] tracking-[0.28em] text-foreground">{label}</span>
    </div>
  );
}

function FeeBadge() {
  return (
    <span className="rounded-full border border-primary/40 bg-primary/12 px-2 py-[3px] text-[8px] font-bold tracking-[0.14em] text-primary-bright">
      ₹0 PLATFORM FEE
    </span>
  );
}

function TabBar({ active = 0 }: { active?: number }) {
  return (
    <div className="absolute inset-x-3 bottom-3 flex items-center justify-around rounded-2xl border border-border bg-ink/85 py-2.5 backdrop-blur-md">
      {["Home", "Menu", "Orders", "You"].map((t, i) => (
        <span
          key={t}
          className={cn(
            "text-[8px] font-semibold tracking-[0.12em]",
            i === active ? "text-primary-bright" : "text-muted-foreground",
          )}
        >
          {t.toUpperCase()}
        </span>
      ))}
    </div>
  );
}

function Row({
  item,
  compact,
}: {
  item: (typeof items)[number];
  compact?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-ink-soft/70 p-2">
      <img
        src={item.img}
        alt={item.name}
        loading="lazy"
        width={96}
        height={96}
        className={cn("rounded-xl object-cover", compact ? "h-9 w-9" : "h-12 w-12")}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[10px] font-semibold text-foreground">{item.name}</p>
        <p className="truncate text-[8px] text-muted-foreground">{item.canteen}</p>
      </div>
      <span className="text-[10px] font-bold text-primary-bright">{item.price}</span>
    </div>
  );
}

function QrBlock() {
  const cells = Array.from({ length: 121 }, (_, i) => {
    const x = i % 11;
    const y = Math.floor(i / 11);
    const corner = (x < 3 && y < 3) || (x > 7 && y < 3) || (x < 3 && y > 7);
    const on = corner || (x * 7 + y * 13 + ((x * y) % 5)) % 3 === 0;
    return on;
  });
  return (
    <div className="grid grid-cols-11 gap-[2px] rounded-xl bg-foreground p-2.5">
      {cells.map((on, i) => (
        <span
          key={i}
          className={cn("aspect-square rounded-[1px]", on ? "bg-background" : "bg-foreground")}
        />
      ))}
    </div>
  );
}

function Screen({ screen }: { screen: ScreenKey }) {
  if (screen === "home") {
    return (
      <div className="flex h-full flex-col gap-3 px-4 pt-3 pb-16">
        <div className="flex items-center justify-between">
          <Brand />
          <FeeBadge />
        </div>
        <p className="display text-[19px] leading-[1.05] text-foreground">
          Hungry,
          <br />
          Aarav?
        </p>
        <div className="relative overflow-hidden rounded-2xl border border-border">
          <img
            src={burger}
            alt="Featured campus meal"
            loading="lazy"
            width={600}
            height={400}
            className="h-28 w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
          <div className="absolute bottom-2 left-3">
            <p className="text-[10px] font-semibold">Today at Food Court</p>
            <p className="text-[8px] text-muted-foreground">Ready in 6 min · ₹0 fee</p>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {items.slice(0, 3).map((i) => (
            <Row key={i.name} item={i} compact />
          ))}
        </div>
        <TabBar active={0} />
      </div>
    );
  }

  if (screen === "menu") {
    return (
      <div className="flex h-full flex-col gap-3 px-4 pt-3 pb-16">
        <div className="flex items-center justify-between">
          <span className="display text-[13px]">Menu</span>
          <FeeBadge />
        </div>
        <div className="flex gap-1.5">
          {["All", "South", "Snacks", "Drinks"].map((c, i) => (
            <span
              key={c}
              className={cn(
                "rounded-full px-2.5 py-1 text-[8px] font-semibold",
                i === 0
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground",
              )}
            >
              {c}
            </span>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          {items.map((i) => (
            <Row key={i.name} item={i} />
          ))}
        </div>
        <TabBar active={1} />
      </div>
    );
  }

  if (screen === "detail") {
    return (
      <div className="flex h-full flex-col pb-16">
        <img
          src={indian}
          alt="Masala dosa thali"
          loading="lazy"
          width={600}
          height={600}
          className="h-44 w-full object-cover"
        />
        <div className="-mt-6 flex flex-1 flex-col gap-3 rounded-t-3xl border-t border-border bg-ink px-4 pt-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="display text-[15px]">Masala Dosa Thali</p>
              <p className="text-[8px] text-muted-foreground">Block A Canteen · 8 min</p>
            </div>
            <span className="display text-[16px] text-primary-bright">₹80</span>
          </div>
          <div className="flex gap-2">
            {["Extra chutney", "Ghee roast", "No onion"].map((o) => (
              <span
                key={o}
                className="rounded-lg border border-border px-2 py-1 text-[7.5px] text-muted-foreground"
              >
                {o}
              </span>
            ))}
          </div>
          <div className="mt-auto mb-3 flex items-center gap-2">
            <div className="flex items-center gap-3 rounded-xl border border-border px-3 py-2 text-[10px]">
              <span>−</span>
              <span className="font-bold">1</span>
              <span>+</span>
            </div>
            <div className="flex-1 rounded-xl bg-primary py-2.5 text-center text-[10px] font-bold text-primary-foreground">
              Add to cart
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (screen === "cart") {
    return (
      <div className="flex h-full flex-col gap-3 px-4 pt-3 pb-16">
        <span className="display text-[13px]">Your cart</span>
        <div className="flex flex-col gap-2">
          {items.slice(0, 2).map((i) => (
            <Row key={i.name} item={i} compact />
          ))}
        </div>
        <div className="mt-2 flex flex-col gap-2 rounded-2xl border border-border bg-ink-soft/70 p-3 text-[9px]">
          <div className="flex justify-between text-muted-foreground">
            <span>Items</span>
            <span className="text-foreground">₹200</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Taxes</span>
            <span className="text-foreground">₹0</span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-primary/12 px-2 py-1.5">
            <span className="font-semibold text-primary-bright">Platform fee</span>
            <span className="display text-[13px] text-primary-bright">₹0</span>
          </div>
          <div className="flex justify-between border-t border-border pt-2 text-[11px] font-bold">
            <span>Total</span>
            <span>₹200</span>
          </div>
        </div>
        <div className="mt-auto mb-16 rounded-xl bg-primary py-2.5 text-center text-[10px] font-bold text-primary-foreground">
          Pay ₹200
        </div>
      </div>
    );
  }

  if (screen === "pay") {
    return (
      <div className="flex h-full flex-col gap-3 px-4 pt-3 pb-16">
        <span className="display text-[13px]">Payment</span>
        <div className="flex flex-col gap-2">
          {["Campus Wallet", "UPI", "Card"].map((m, i) => (
            <div
              key={m}
              className={cn(
                "flex items-center justify-between rounded-2xl border p-3 text-[10px]",
                i === 0 ? "border-primary/50 bg-primary/10" : "border-border bg-ink-soft/60",
              )}
            >
              <span className="font-semibold">{m}</span>
              <span
                className={cn(
                  "h-3 w-3 rounded-full border",
                  i === 0 ? "border-primary bg-primary" : "border-border",
                )}
              />
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-primary/30 bg-primary/8 p-3 text-center">
          <p className="text-[8px] tracking-[0.2em] text-muted-foreground">YOU PAY</p>
          <p className="display text-[26px] text-foreground">₹200</p>
          <p className="text-[8px] text-primary-bright">₹0 platform fee included. Always.</p>
        </div>
        <div className="mt-auto mb-16 rounded-xl bg-primary py-2.5 text-center text-[10px] font-bold text-primary-foreground">
          Confirm payment
        </div>
      </div>
    );
  }

  if (screen === "confirm") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="relative grid h-16 w-16 place-items-center rounded-full border border-primary/50 bg-primary/12">
          <span className="absolute inset-0 rounded-full bg-primary/25 blur-xl" />
          <span className="display text-[20px] text-primary-bright">✓</span>
        </div>
        <p className="display text-[16px]">Order placed</p>
        <p className="text-[9px] text-muted-foreground">
          Order #HG-2471 · Block A Canteen
          <br />
          Ready in about 8 minutes.
        </p>
        <div className="mt-2 rounded-full border border-primary/40 px-3 py-1 text-[8px] tracking-[0.18em] text-primary-bright">
          PLATFORM FEE ₹0
        </div>
      </div>
    );
  }

  if (screen === "track") {
    const steps = ["Order received", "Preparing", "Ready for pickup", "Collected"];
    return (
      <div className="flex h-full flex-col gap-3 px-4 pt-3 pb-16">
        <div className="flex items-center justify-between">
          <span className="display text-[13px]">Live tracking</span>
          <span className="rounded-full bg-primary/15 px-2 py-[3px] text-[8px] font-bold text-primary-bright">
            LIVE
          </span>
        </div>
        <div className="rounded-2xl border border-border bg-ink-soft/70 p-3">
          <p className="text-[8px] tracking-[0.18em] text-muted-foreground">READY IN</p>
          <p className="display text-[30px]">04:12</p>
        </div>
        <div className="flex flex-col gap-2.5 pl-1">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2.5">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  i <= 1 ? "bg-primary" : "bg-muted",
                  i === 1 && "ring-4 ring-primary/25",
                )}
              />
              <span
                className={cn(
                  "text-[9.5px]",
                  i <= 1 ? "font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                {s}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-auto mb-16 overflow-hidden rounded-2xl border border-border">
          <img
            src={pizza}
            alt="Order being prepared"
            loading="lazy"
            width={600}
            height={300}
            className="h-20 w-full object-cover"
          />
        </div>
      </div>
    );
  }

  if (screen === "qr") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-[8px] tracking-[0.22em] text-muted-foreground">SCAN AT COUNTER</p>
        <QrBlock />
        <p className="display text-[13px]">#HG-2471</p>
        <p className="text-[8.5px] text-muted-foreground">
          Show this code at Block A Canteen.
          <br />
          Scan. Collect. Go.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 px-4 pt-3 pb-16">
      <span className="display text-[13px]">Your orders</span>
      <div className="flex flex-col gap-2">
        {items.map((i, idx) => (
          <div
            key={i.name}
            className="flex items-center justify-between rounded-2xl border border-border bg-ink-soft/60 p-2.5"
          >
            <div>
              <p className="text-[9.5px] font-semibold">{i.name}</p>
              <p className="text-[8px] text-muted-foreground">
                {idx === 0 ? "Today" : `${idx} day${idx > 1 ? "s" : ""} ago`} · fee ₹0
              </p>
            </div>
            <span className="text-[9.5px] font-bold text-primary-bright">{i.price}</span>
          </div>
        ))}
      </div>
      <TabBar active={2} />
    </div>
  );
}

export function Phone({
  screen = "menu",
  className,
  glow = true,
}: {
  screen?: ScreenKey;
  className?: string;
  glow?: boolean;
}) {
  return (
    <div className={cn("relative w-[clamp(200px,62vw,290px)]", className)}>
      {glow && (
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-16 -z-10 rounded-full ember anim-pulse-glow opacity-70"
        />
      )}
      <div
        className="relative aspect-[9/19] rounded-[2.6rem] border border-border p-[3px]"
        style={{
          background:
            "linear-gradient(160deg, oklch(0.32 0.01 25) 0%, oklch(0.09 0 0) 32%, oklch(0.14 0.02 27) 100%)",
          boxShadow: "var(--shadow-device)",
        }}
      >
        <div className="relative h-full w-full overflow-hidden rounded-[2.4rem] bg-ink grain">
          <StatusBar />
          <div className="absolute left-1/2 top-2 h-4 w-16 -translate-x-1/2 rounded-full bg-background/90" />
          <div className="h-[calc(100%-1.25rem)]">
            <Screen screen={screen} />
          </div>
          {/* glass reflection */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[2.4rem] opacity-60"
            style={{
              background:
                "linear-gradient(115deg, oklch(1 0 0 / 0.14) 0%, transparent 32%, transparent 68%, oklch(1 0 0 / 0.06) 100%)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
