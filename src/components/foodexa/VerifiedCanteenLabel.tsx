import { Check } from "lucide-react";

export function VerifiedCanteenLabel() {
  return (
    <p className="verified-canteen-indicator mt-1 inline-flex items-center gap-1 text-xs font-semibold">
      <Check aria-hidden="true" className="h-3.5 w-3.5" />
      <span>Verified HUNGRYZ Canteen</span>
    </p>
  );
}
