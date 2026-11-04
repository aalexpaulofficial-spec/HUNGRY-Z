import { ORDER_LABELS } from "@/lib/access";
import { cn } from "@/lib/utils";

export function orderStatusBorderClass(status: string) {
  if (status === "placed") return "order-card-placed";
  if (status === "collected") return "order-card-collected";
  if (status === "cancelled") return "order-card-cancelled";
  return "order-card-other";
}

export function OrderStatusBadge({ status, className }: { status: string; className?: string }) {
  const label = ORDER_LABELS[status] ?? status.replaceAll("_", " ");
  const statusClass = status === "placed" ? "order-status-placed"
    : status === "collected" ? "order-status-collected"
      : status === "cancelled" ? "order-status-cancelled" : "order-status-other";
  const dotClass = status === "placed" ? "order-status-dot-placed"
    : status === "collected" ? "order-status-dot-collected"
      : status === "cancelled" ? "order-status-dot-cancelled" : "order-status-dot-other";
  return (
    <span
      data-order-status={status}
      className={cn(
        "max-w-[65%] break-words rounded-full px-3 py-1 text-right text-[10px] font-bold uppercase leading-tight tracking-normal sm:max-w-none sm:text-left sm:leading-normal sm:tracking-widest",
        statusClass,
        className,
      )}
    >
      <span aria-hidden="true" className={cn("mr-1.5 inline-block h-2 w-2 shrink-0 rounded-full", dotClass)} />
      {label}
    </span>
  );
}
