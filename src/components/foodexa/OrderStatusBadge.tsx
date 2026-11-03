import { ORDER_LABELS } from "@/lib/access";
import { cn } from "@/lib/utils";

export function OrderStatusBadge({ status, className }: { status: string; className?: string }) {
  const label = ORDER_LABELS[status] ?? status.replaceAll("_", " ");
  return (
    <span
      data-order-status={status}
      className={cn(
        "max-w-[65%] break-words rounded-full px-3 py-1 text-right text-[10px] font-bold uppercase leading-tight tracking-normal sm:max-w-none sm:text-left sm:leading-normal sm:tracking-widest",
        status === "collected"
          ? "status-collected border"
          : status === "ready" || status === "pending_payment"
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground",
        className,
      )}
    >
      {label}
    </span>
  );
}
