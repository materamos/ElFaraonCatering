export const menuSections = {
  dailyMenu: "menu-del-dia",
  sides: "guarniciones",
  empanadas: "empanadas",
  piesTortillasOmelettes: "tartas-tortillas-omelettes",
  mainDishes: "platos-principales",
  promos: "promociones",
  salads: "ensaladas",
  cafeteria: "cafeteria",
  drinks: "bebidas",
} as const;

export const dailyMenuItems = {
  regular: "menu-del-dia",
  vegetarian: "menu-vegetariano-del-dia",
} as const;

export const catalogItems = {
  empanadas: "empanadas",
  tartas: "tartas",
  tortilla: "tortilla",
  omeletteSpinach: "omelette-espinaca-muzzarella",
  omeletteHam: "omelette-jamon-queso",
  sideOnly: "guarnicion-sola",
} as const;

export function shouldHideIncludedPricing(sectionId: string, pricingKind?: string): boolean {
  return sectionId === menuSections.sides && pricingKind === "included";
}

export function shouldHideUnavailableOptions(sectionId: string, itemId: string): boolean {
  return (
    (sectionId === menuSections.empanadas && itemId === catalogItems.empanadas) ||
    (sectionId === menuSections.piesTortillasOmelettes && itemId === catalogItems.tartas)
  );
}

// Deliberate abbreviations for the public menu sticky index. Full database
// titles do not fit well on desktop; other sections keep their database title.
const navSectionLabels: Record<string, string> = {
  [menuSections.mainDishes]: "Principales",
  [menuSections.promos]: "Promos cafeteria",
};

// Operational panel group labels reuse the index abbreviations and keep the
// remaining hidden-item chip labels short.
const availabilityGroupChipLabels: Record<string, string> = {
  ...navSectionLabels,
  [menuSections.sides]: "Guarniciones",
  [menuSections.salads]: "Ensaladas",
  [menuSections.cafeteria]: "Cafeteria",
  [menuSections.drinks]: "Bebidas",
};

export function getMenuNavSectionLabel(sectionId: string, fallback: string): string {
  return navSectionLabels[sectionId] ?? fallback;
}

export function getAvailabilitySummaryGroupLabel(input: {
  targetKind: string;
  sectionId: string;
  sectionTitle: string;
  itemId: string;
  optionItemId?: string;
  hasOptionDisplay: boolean;
}): string {
  if (input.targetKind === "daily-menu") {
    return "Menu del dia";
  }

  if (input.targetKind === "grill") {
    return "Parrilla";
  }

  if (input.sectionId === menuSections.piesTortillasOmelettes) {
    const itemId = input.optionItemId ?? input.itemId;

    if (itemId === catalogItems.tartas) {
      return input.hasOptionDisplay ? "Tarta" : "";
    }

    if (
      itemId === catalogItems.tortilla ||
      itemId === catalogItems.omeletteSpinach ||
      itemId === catalogItems.omeletteHam
    ) {
      return "";
    }
  }

  if (input.sectionId === menuSections.empanadas) {
    return input.hasOptionDisplay ? "Empanada" : "";
  }

  return availabilityGroupChipLabels[input.sectionId] ?? input.sectionTitle;
}
