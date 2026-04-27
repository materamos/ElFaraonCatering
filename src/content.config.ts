import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { menuImageSchema } from "./utils/menuImage";

const textSchema = z.string().trim().min(1);

const fixedPricingSchema = z.object({
  kind: z.literal("fixed"),
  amount: z.number().int().nonnegative(),
});

const pendingPricingSchema = z.object({
  kind: z.literal("pending"),
});

const includedPricingSchema = z.object({
  kind: z.literal("included"),
  label: textSchema.optional(),
});

const pricingVariantSchema = z
  .object({
    name: textSchema,
    amount: z.number().int().nonnegative().optional(),
    pending: z.literal(true).optional(),
    available: z.boolean().default(true),
    note: textSchema.optional(),
  })
  .superRefine((variant, context) => {
    const hasAmount = typeof variant.amount === "number";
    const isPending = variant.pending === true;

    if (hasAmount === isPending) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Each pricing variant must define either amount or pending: true.",
        path: ["amount"],
      });
    }
  });

const variantsPricingSchema = z.object({
  kind: z.literal("variants"),
  variants: z.array(pricingVariantSchema).min(1),
});

const pricingSchema = z.discriminatedUnion("kind", [
  fixedPricingSchema,
  pendingPricingSchema,
  includedPricingSchema,
  variantsPricingSchema,
]);

const menuOptionSchema = z.object({
  name: textSchema,
  description: textSchema.optional(),
  note: textSchema.optional(),
  available: z.boolean().default(true),
});

const menuItemSchema = z.object({
  name: textSchema,
  description: textSchema.optional(),
  note: textSchema.optional(),
  available: z.boolean(),
  pricing: pricingSchema.optional(),
  options: z.array(menuOptionSchema).optional(),
  image: menuImageSchema,
});

const menuGroupSchema = z
  .object({
    title: textSchema,
    description: textSchema.optional(),
    note: textSchema.optional(),
    pricing: pricingSchema.optional(),
    items: z.array(menuItemSchema).min(1),
  })
  .superRefine((group, context) => {
    if (group.pricing) {
      return;
    }

    group.items.forEach((item, index) => {
      if (!item.pricing) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Grouped items must define pricing when their group has no shared pricing.",
          path: ["items", index, "pricing"],
        });
      }
    });
  });

const menuSectionSchema = z
  .object({
    title: textSchema,
    description: textSchema.optional(),
    note: textSchema.optional(),
    order: z.number().int().nonnegative(),
    items: z.array(menuItemSchema).min(1).optional(),
    groups: z.array(menuGroupSchema).min(1).optional(),
  })
  .superRefine((section, context) => {
    const hasItems = Array.isArray(section.items) && section.items.length > 0;
    const hasGroups = Array.isArray(section.groups) && section.groups.length > 0;

    if (hasItems === hasGroups) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Menu sections must define either items or groups, but not both.",
        path: ["items"],
      });
    }

    if (!section.items) {
      return;
    }

    section.items.forEach((item, index) => {
      if (!item.pricing) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Direct section items must define pricing.",
          path: ["items", index, "pricing"],
        });
      }
    });
  });

const menuSections = defineCollection({
  loader: glob({ pattern: "**/*.yaml", base: "./src/content/menu-sections" }),
  schema: menuSectionSchema,
});

export const collections = {
  "menu-sections": menuSections,
};
