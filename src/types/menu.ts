import type { CollectionEntry } from "astro:content";

export type MenuSectionData = CollectionEntry<"menu-sections">["data"];
export type MenuGroup = NonNullable<MenuSectionData["groups"]>[number];
export type MenuItem = NonNullable<MenuSectionData["items"]>[number] | MenuGroup["items"][number];
export type MenuPricing = NonNullable<MenuItem["pricing"] | MenuGroup["pricing"]>;
export type MenuPricingVariant = Extract<MenuPricing, { kind: "variants" }>["variants"][number];
export type MenuOption = NonNullable<MenuItem["options"]>[number];
