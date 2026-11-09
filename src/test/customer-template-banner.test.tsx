import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CanteenTemplatePreview } from "@/components/foodexa/CanteenTemplatePreview";
import { DEFAULT_WEEKLY_HOURS } from "@/lib/canteen-availability";
import { HomeTab } from "@/routes/_authenticated/app";

afterEach(cleanup);

describe("customer Home banner template consistency", () => {
  it("renders the saved owner template image, crop, zoom, heading and description identically", () => {
    const saved = {
      banner_image_url: "https://storage.example/canteen/banner-original.jpg",
      heading: "Welcome to our campus",
      description: "Fresh meals, served daily.",
      banner_crop_x: 28,
      banner_crop_y: 67,
      banner_crop_zoom: 1.6,
    };
    const canteen = {
      id: "canteen-1", name: "North Canteen", university_name: "Example University", campus_location: "Main Block",
      visibility: "public", is_active: true, availability_mode: "schedule" as const,
      operating_hours: DEFAULT_WEEKLY_HOURS, timezone: "Asia/Kolkata",
    };
    const template = { canteen_id: canteen.id, ...saved };
    const menu = [{ id: "item-1", canteen_id: canteen.id, name: "Masala Dosa", description: "Crisp dosa", image: "food-indian", price: 80, category: "Breakfast", veg: true, prep_minutes: 8, counter: "Counter 1", tag: null, available: true, stock: null }];

    render(<>
      <CanteenTemplatePreview imageUrl={saved.banner_image_url} heading={saved.heading} description={saved.description} canteenName={canteen.name} universityName={canteen.university_name} crop={{ x: saved.banner_crop_x, y: saved.banner_crop_y, zoom: saved.banner_crop_zoom }} onCropChange={vi.fn()} />
      <HomeTab menu={menu} canteen={canteen} template={template} onOpen={vi.fn()} onAdd={vi.fn()} goMenu={vi.fn()} />
    </>);

    const banners = screen.getAllByTestId("canteen-template-banner");
    expect(banners).toHaveLength(2);
    const [ownerPreview, customerHome] = banners;
    for (const banner of banners) {
      const image = banner.querySelector("img");
      expect(image?.src).toBe(saved.banner_image_url);
      expect(image?.style.transform).toBe("translate(13.2%, -10.2%) scale(1.6)");
      expect(image?.className).toContain("object-contain");
      expect(image?.style.filter).toBe("");
      expect(within(banner).getByText(saved.heading)).toBeInTheDocument();
      expect(within(banner).getByText(saved.description)).toBeInTheDocument();
      expect(within(banner).getByText(`${canteen.name} · ${canteen.university_name}`)).toBeInTheDocument();
    }
    expect(customerHome?.querySelector("img")?.style.cssText).toBe(ownerPreview?.querySelector("img")?.style.cssText);
  });
});
