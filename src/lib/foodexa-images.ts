import indian from "@/assets/food-indian.jpg";
import bowl from "@/assets/food-bowl.jpg";
import burger from "@/assets/food-burger.jpg";
import pizza from "@/assets/food-pizza.jpg";
import coffee from "@/assets/food-coffee.jpg";
import cafeteria from "@/assets/campus-cafeteria.jpg";

const map: Record<string, string> = {
  "food-indian": indian,
  "food-bowl": bowl,
  "food-burger": burger,
  "food-pizza": pizza,
  "food-coffee": coffee,
  "campus-cafeteria": cafeteria,
};

export function foodImage(key?: string | null): string | undefined {
  if (!key) return undefined;
  if (key && /^https?:\/\//i.test(key)) return key;
  return map[key] || cafeteria;
}
