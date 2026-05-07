export interface MenuPrice {
  amount: number;
}

export interface FixedMenuPricing {
  kind: "fixed";
  price: MenuPrice;
}

export interface IncludedMenuPricing {
  kind: "included";
}

export interface VariantsMenuPricing {
  kind: "variants";
  variants: MenuPricingVariant[];
}

export type MenuPricing =
  | FixedMenuPricing
  | IncludedMenuPricing
  | VariantsMenuPricing;

export interface MenuPricingVariant {
  id: string;
  name: string;
  price: MenuPrice;
  available: boolean;
}

export interface MenuOption {
  id: string;
  name: string;
  description?: string;
  note?: string;
  available: boolean;
}

export interface MenuItem {
  itemId: string;
  name: string;
  description?: string;
  note?: string;
  available: boolean;
  pricing?: MenuPricing;
  options?: MenuOption[];
  image?: string;
}

export interface MenuGroup {
  groupId: string;
  title: string;
  description?: string;
  note?: string;
  pricing?: MenuPricing;
  items: MenuItem[];
}

export type MenuSectionPresentation = "cards" | "compact-list";

export interface MenuSectionBase {
  sectionId: string;
  title: string;
  description?: string;
  note?: string;
  order: number;
  presentation?: MenuSectionPresentation;
}

export type MenuItemsSectionData = MenuSectionBase & {
  items: MenuItem[];
  groups?: never;
};

export type MenuGroupsSectionData = MenuSectionBase & {
  items?: never;
  groups: MenuGroup[];
};

export type MenuCatalogSectionData =
  | MenuItemsSectionData
  | MenuGroupsSectionData;

export type MenuDailySectionData = MenuCatalogSectionData;

export type MenuSectionData = MenuCatalogSectionData | MenuDailySectionData;

export interface MenuDailyMenuData {
  items: MenuItem[];
}

export interface MenuProfileServiceSettings {
  menuId: string;
  serviceKind: "daily-menu" | "grill";
}

export interface MenuProfileFactLink {
  text: string;
  href: string;
}

export interface MenuProfileFact {
  id: string;
  label: string;
  value: string;
  link?: MenuProfileFactLink;
}

export interface MenuProfilePayment {
  id: string;
  label: string;
  methods: string[];
}

export interface MenuProfileData {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  infoTitle: string;
  facts: MenuProfileFact[];
  payment: MenuProfilePayment;
}
