import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getScannedOrderReference } from "@/lib/order-qr";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      const scannedOrderId = getScannedOrderReference(location.pathname, location.searchStr);
      throw redirect({ to: "/auth", search: { mode: "login", ...(scannedOrderId ? { orderId: scannedOrderId } : {}) } });
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});
