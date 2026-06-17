import type {
  AdminOperationalState,
  AdminTabId,
  CatalogItemState,
  CatalogSectionState,
  FixedMenuEditMode,
  ServiceKind,
  ServiceSectionId,
} from "./adminTypes";

export const regularDailyId = "menu-del-dia";
export const vegetarianDailyId = "menu-vegetariano-del-dia";

export interface FixedOptionsOnlySectionRule {
  sectionId: string;
  title: string;
  itemIds: readonly string[];
}

export const fixedOptionsOnlySectionRules: readonly FixedOptionsOnlySectionRule[] = [
  {
    sectionId: "tartas-tortillas-omelettes",
    title: "Tartas, tortillas y omelettes",
    itemIds: ["tartas", "tortilla", "omelette"],
  },
  {
    sectionId: "empanadas",
    title: "Empanadas",
    itemIds: ["empanadas"],
  },
];

export function getFixedOptionsOnlyRule(sectionId: string): FixedOptionsOnlySectionRule | undefined {
  return fixedOptionsOnlySectionRules.find((rule) => rule.sectionId === sectionId);
}

export function getFixedMenuEditMode(section: CatalogSectionState): FixedMenuEditMode {
  return getFixedOptionsOnlyRule(section.section_id) ? "options-only" : "items";
}

export function getFixedSectionAdminTitle(section: CatalogSectionState): string {
  return getFixedOptionsOnlyRule(section.section_id)?.title ?? section.title;
}

export function catalogItemFormRequiresPrice(section: CatalogSectionState): boolean {
  return section.section_id !== "guarniciones";
}

export function isIncludedSideOptionItem(item: CatalogItemState): boolean {
  if (item.section_id === "guarniciones" && item.item_id !== "guarnicion-sola") {
    return true;
  }

  const searchableValues = [item.item_id, item.name].map((value) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase(),
  );

  return searchableValues.some((value) => value === "guarnicion" || value === "guarniciones");
}

export function canDeleteFromList(itemCount: number): boolean {
  return itemCount > 1;
}

export function isServiceSectionAvailable(
  state: AdminOperationalState,
  section: ServiceSectionId,
): boolean {
  if (section === "active-service") {
    return true;
  }

  const targetServiceKind: ServiceKind = section === "daily-menu" ? "daily-menu" : "grill";

  return state.service_settings.some((entry) => entry.service_kind === targetServiceKind);
}

export function getAllowedTabs(state: AdminOperationalState): Array<{ id: AdminTabId; label: string }> {
  const tabs: Array<{ id: AdminTabId; label: string }> = [];

  if (state.permissions.can_edit_availability) {
    tabs.push({ id: "availability", label: "Disponibilidad" });
  }

  if (state.permissions.can_edit_menu_content) {
    tabs.push({ id: "service", label: "Servicio" });
  }

  if (state.permissions.can_edit_menu_content) {
    tabs.push({ id: "fixed", label: "Menú fijo" });
  }

  tabs.push({ id: "account", label: "Cuenta" });

  return tabs;
}
