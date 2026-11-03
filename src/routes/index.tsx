import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/foodexa/Navbar";
import { Cursor } from "@/components/foodexa/Cursor";
import { Hero } from "@/components/foodexa/Hero";
import { Marquee } from "@/components/foodexa/Marquee";
import { StudentsSection } from "@/components/foodexa/StudentsSection";
import { PhoneStory } from "@/components/foodexa/PhoneStory";
import { FacultySection } from "@/components/foodexa/FacultySection";
import { InstitutionsSection } from "@/components/foodexa/InstitutionsSection";
import { AnalyticsSection } from "@/components/foodexa/AnalyticsSection";
import { Campus3D } from "@/components/foodexa/Campus3D";
import { HowItWorks } from "@/components/foodexa/HowItWorks";
import { ZeroPlatformFee } from "@/components/foodexa/ZeroPlatformFee";
import { Pricing } from "@/components/foodexa/Pricing";
import { Faq } from "@/components/foodexa/Faq";
import { FinalCTA } from "@/components/foodexa/FinalCTA";
import { Footer } from "@/components/foodexa/Footer";

export const landingManifestHref = "/manifest-student.webmanifest";

const title = "HUNGRY — Smart Campus Food Ordering, ₹0 Platform Fee";
const description =
  "HUNGRY is smart campus food ordering. Order faster, skip the queue, track your food live and pay ₹0 platform fee on every order.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "manifest", href: landingManifestHref }],
  }),
  component: Index,
});

function Index() {
  return (
    <>
      <Cursor />
      <Navbar />
      <main>
        <Hero />
        <Marquee />
        <StudentsSection />
        <PhoneStory />
        <FacultySection />
        <InstitutionsSection />
        <AnalyticsSection />
        <Campus3D />
        <HowItWorks />
        <ZeroPlatformFee />
        <Pricing />
        <Faq />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
