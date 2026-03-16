import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const menuItemSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  price: z.number(),
  available: z.boolean(),
  image: z.string().optional(),
});

const dailyDishes = defineCollection({
  loader: glob({ pattern: "**/*.yaml", base: "./src/content/daily-dishes" }),
  schema: menuItemSchema,
});

const fixedDishes = defineCollection({
  loader: glob({ pattern: "**/*.yaml", base: "./src/content/fixed-dishes" }),
  schema: menuItemSchema,
});

const sideDishes = defineCollection({
  loader: glob({ pattern: "**/*.yaml", base: "./src/content/side-dishes" }),
  schema: menuItemSchema,
});

const drinks = defineCollection({
  loader: glob({ pattern: "**/*.yaml", base: "./src/content/drinks" }),
  schema: menuItemSchema,
});

export const collections = {
  "daily-dishes": dailyDishes,
  "fixed-dishes": fixedDishes,
  "side-dishes": sideDishes,
  drinks,
};
