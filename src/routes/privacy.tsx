import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/foodexa/LegalPage";
import { privacyPolicy } from "@/content/legal";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Privacy Policy — HUNGRY" }, { name: "description", content: "How HUNGRY handles account, canteen, order and payment information." }] }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return <LegalPage {...privacyPolicy} />;
}
