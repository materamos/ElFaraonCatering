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

export function getMenuNavSectionLabel(sectionId: string, fallback: string): string {
  if (sectionId === menuSections.mainDishes) {
    return "Principales";
  }

  if (sectionId === menuSections.promos) {
    return "Promos cafeteria";
  }

  return fallback;
}

export function getAvailabilitySummaryGroupLabel(input: {
  targetKind: string;
  sectionId: string;
  sectionTitle: string;
  itemId: string;
  itemName: string;
  optionItemName?: string;
  hasOptionDisplay: boolean;
}): string {
  if (input.targetKind === "daily-menu") {
    return "Menu del dia";
  }

  if (input.targetKind === "grill") {
    return "Parrilla";
  }

  if (input.sectionId === menuSections.mainDishes) {
    return "Principales";
  }

  if (input.sectionId === menuSections.promos) {
    return "Promos cafeteria";
  }

  if (input.sectionId === menuSections.piesTortillasOmelettes) {
    const itemName = input.optionItemName ?? input.itemName;

    if (itemName === "Tartas") {
      return input.hasOptionDisplay ? "Tarta" : "";
    }

    if (
      itemName === "Tortilla" ||
      input.itemId === catalogItems.omeletteSpinach ||
      input.itemId === catalogItems.omeletteHam
    ) {
      return "";
    }
  }

  if (input.sectionId === menuSections.empanadas) {
    return input.hasOptionDisplay ? "Empanada" : "";
  }

  const catalogLabels: Record<string, string> = {
    [menuSections.sides]: "Guarniciones",
    [menuSections.salads]: "Ensaladas",
    [menuSections.cafeteria]: "Cafeteria",
    [menuSections.drinks]: "Bebidas",
  };

  return catalogLabels[input.sectionId] ?? input.sectionTitle;
}
