import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/foodexa/LegalPage";
import { termsConditions } from "@/content/legal";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: "Terms & Conditions — HUNGRY Z" }, { name: "description", content: "Terms for using HUNGRY Z campus food ordering and canteen services." }] }),
  component: TermsPage,
});

function TermsPage() {
  return <LegalPage {...termsConditions} />;
}
