import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/foodexa/Navbar";
import { Footer } from "@/components/foodexa/Footer";
import { CanteenSection } from "@/components/foodexa/CanteenSection";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getCanteenOwnerAccess } from "@/lib/hungry.functions";
import { isStandaloneApp } from "@/lib/pwa-install";
import { useBackNavigationEnabled } from "@/lib/back-nav";

const title = "Register Your Canteen — HUNGRY";
const description =
  "Apply to bring your campus canteen onto HUNGRY, or log in to your approved canteen dashboard with your 7-character code.";

export const Route = createFileRoute("/register-canteen")({
  head: () => ({
    links: [{ rel: "manifest", href: "/manifest-canteen.webmanifest" }],
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RegisterCanteenPage,
});

function RegisterCanteenPage() {
  const navigate = useNavigate();
  const getOwnerAccess = useServerFn(getCanteenOwnerAccess);
  const siteNavigationEnabled = useBackNavigationEnabled();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!isStandaloneApp() || params.get("hungry_app") !== "canteen") return;

    let active = true;
    void (async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) return;
        const access = await getOwnerAccess({ data: {} });
        if (active && access.linked && access.status === "approved") {
          navigate({ to: "/canteen", replace: true });
        }
      } catch {
        // Keep the register/login page available if an existing owner session can't be restored.
      }
    })();

    return () => { active = false; };
  }, [getOwnerAccess, navigate]);

  return (
    <>
      <Navbar />
      <main>
        <CanteenSection />
      </main>
      {siteNavigationEnabled && <Footer />}
    </>
  );
}
