import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { menuImageSchema } from "./utils/menuImage";

const pricedMenuItemSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  price: z.number(),
  available: z.boolean(),
  image: menuImageSchema,
});

const sideDishSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  available: z.boolean(),
  image: menuImageSchema,
});

const dailyDishes = defineCollection({
  loader: glob({ pattern: "**/*.yaml", base: "./src/content/daily-dishes" }),
  schema: pricedMenuItemSchema,
});

const fixedDishes = defineCollection({
  loader: glob({ pattern: "**/*.yaml", base: "./src/content/fixed-dishes" }),
  schema: pricedMenuItemSchema,
});

const sideDishes = defineCollection({
  loader: glob({ pattern: "**/*.yaml", base: "./src/content/side-dishes" }),
  schema: sideDishSchema,
});

const drinks = defineCollection({
  loader: glob({ pattern: "**/*.yaml", base: "./src/content/drinks" }),
  schema: pricedMenuItemSchema,
});

export const collections = {
  "daily-dishes": dailyDishes,
  "fixed-dishes": fixedDishes,
  "side-dishes": sideDishes,
  drinks,
};
