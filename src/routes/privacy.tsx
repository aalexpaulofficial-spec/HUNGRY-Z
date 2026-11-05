import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/foodexa/LegalPage";
import { privacyPolicy } from "@/content/legal";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Privacy Policy — HUNGRY Z" }, { name: "description", content: "How HUNGRY Z handles account, order, payment, event, token, support and AI food-scan information." }] }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return <LegalPage {...privacyPolicy} />;
}
