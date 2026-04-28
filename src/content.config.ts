import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { menuImageSchema } from "./utils/menuImage";

const textSchema = z.string().trim().min(1);
const technicalIdSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const priceSchema = z
  .object({
    amount: z.number().int().nonnegative(),
  })
  .strict();

const fixedPricingSchema = z.object({
  kind: z.literal("fixed"),
  price: priceSchema,
}).strict();

const includedPricingSchema = z.object({
  kind: z.literal("included"),
}).strict();

const pricingVariantSchema = z
  .object({
    id: technicalIdSchema,
    name: textSchema,
    price: priceSchema,
    available: z.boolean().default(true),
  })
  .strict();

const variantsPricingSchema = z.object({
  kind: z.literal("variants"),
  variants: z.array(pricingVariantSchema).min(1),
}).strict();

const pricingSchema = z.discriminatedUnion("kind", [
  fixedPricingSchema,
  includedPricingSchema,
  variantsPricingSchema,
]);

const menuOptionSchema = z
  .object({
    id: technicalIdSchema,
    name: textSchema,
    description: textSchema.optional(),
    note: textSchema.optional(),
    available: z.boolean().default(true),
  })
  .strict();

const menuItemSchema = z
  .object({
    itemId: technicalIdSchema,
    name: textSchema,
    description: textSchema.optional(),
    note: textSchema.optional(),
    available: z.boolean(),
    pricing: pricingSchema.optional(),
    options: z.array(menuOptionSchema).optional(),
    image: menuImageSchema,
  })
  .strict();

const menuGroupSchema = z
  .object({
    groupId: technicalIdSchema,
    title: textSchema,
    description: textSchema.optional(),
    note: textSchema.optional(),
    pricing: pricingSchema.optional(),
    items: z.array(menuItemSchema).min(1),
  })
  .strict()
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
    sectionId: technicalIdSchema,
    title: textSchema,
    description: textSchema.optional(),
    note: textSchema.optional(),
    order: z.number().int().nonnegative(),
    items: z.array(menuItemSchema).min(1).optional(),
    groups: z.array(menuGroupSchema).min(1).optional(),
  })
  .strict()
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

const menuProfileFactSchema = z
  .object({
    id: technicalIdSchema,
    label: textSchema,
    value: textSchema,
    link: z
      .object({
        text: textSchema,
        href: textSchema,
      })
      .strict()
      .optional(),
  })
  .strict();

const menuProfilePaymentSchema = z
  .object({
    id: technicalIdSchema,
    label: textSchema,
    methods: z.array(textSchema).min(1),
  })
  .strict();

const menuProfileSchema = z
  .object({
    id: technicalIdSchema,
    eyebrow: textSchema,
    title: textSchema,
    description: textSchema,
    infoTitle: textSchema,
    facts: z.array(menuProfileFactSchema).min(1),
    payment: menuProfilePaymentSchema,
  })
  .strict();

const menuItemOverrideSchema = z
  .object({
    itemId: technicalIdSchema,
    available: z.boolean().optional(),
    pricing: pricingSchema.optional(),
    note: textSchema.optional(),
  })
  .strict();

const menuGroupOverrideSchema = z
  .object({
    groupId: technicalIdSchema,
    pricing: pricingSchema.optional(),
    note: textSchema.optional(),
    items: z.array(menuItemOverrideSchema).optional(),
  })
  .strict();

const menuSectionOverrideSchema = z
  .object({
    sectionId: technicalIdSchema,
    items: z.array(menuItemOverrideSchema).optional(),
    groups: z.array(menuGroupOverrideSchema).optional(),
  })
  .strict();

const menuOverrideSchema = z
  .object({
    menuId: technicalIdSchema,
    sections: z.array(menuSectionOverrideSchema).default([]),
  })
  .strict();

const menuProfiles = defineCollection({
  loader: glob({ pattern: "**/*.yaml", base: "./src/content/menu-profiles" }),
  schema: menuProfileSchema,
});

const menuOverrides = defineCollection({
  loader: glob({ pattern: "**/*.yaml", base: "./src/content/menu-overrides" }),
  schema: menuOverrideSchema,
});

const menuCatalogSections = defineCollection({
  loader: glob({ pattern: "**/*.yaml", base: "./src/content/menu-catalog-sections" }),
  schema: menuSectionSchema,
});

const menuDailySections = defineCollection({
  loader: glob({ pattern: "**/*.yaml", base: "./src/content/menu-daily-sections" }),
  schema: menuSectionSchema,
});

export const collections = {
  "menu-profiles": menuProfiles,
  "menu-overrides": menuOverrides,
  "menu-catalog-sections": menuCatalogSections,
  "menu-daily-sections": menuDailySections,
};
