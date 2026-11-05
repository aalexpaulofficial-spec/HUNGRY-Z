import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/foodexa/LegalPage";
import { termsConditions } from "@/content/legal";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: "Terms & Conditions — HUNGRY Z" }, { name: "description", content: "Terms for HUNGRY Z campus ordering, payments, faculty events, participation tokens, refunds and AI nutrition estimates." }] }),
  component: TermsPage,
});

function TermsPage() {
  return <LegalPage {...termsConditions} />;
}
