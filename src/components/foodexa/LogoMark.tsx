import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-grid aspect-square place-items-center rounded-full bg-primary font-black text-primary-foreground",
        className,
      )}
    >
      H
    </span>
  );
}
