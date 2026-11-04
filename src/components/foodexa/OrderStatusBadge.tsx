import { ORDER_LABELS } from "@/lib/access";
import { cn } from "@/lib/utils";

export function orderStatusBorderClass(status: string) {
  return status === "placed" ? "order-card-placed" : "order-card-other";
}

export function OrderStatusBadge({ status, className }: { status: string; className?: string }) {
  const label = ORDER_LABELS[status] ?? status.replaceAll("_", " ");
  return (
    <span
      data-order-status={status}
      className={cn(
        "max-w-[65%] break-words rounded-full px-3 py-1 text-right text-[10px] font-bold uppercase leading-tight tracking-normal sm:max-w-none sm:text-left sm:leading-normal sm:tracking-widest",
        status === "placed" ? "order-status-placed" : "order-status-other",
        className,
      )}
    >
      <span aria-hidden="true" className={cn("mr-1.5 inline-block h-2 w-2 shrink-0 rounded-full", status === "placed" ? "order-status-dot-placed" : "order-status-dot-other")} />
      {label}
    </span>
  );
}
