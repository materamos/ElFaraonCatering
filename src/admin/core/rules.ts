import type {
  AdminOperationalState,
  AdminTabId,
  CatalogItemState,
  CatalogSectionState,
  FixedMenuEditMode,
  ServiceKind,
  ServiceSectionId,
} from "./types";
import { catalogItems, dailyMenuItems, menuSections } from "../../menu/menuRules";

export const regularDailyId = dailyMenuItems.regular;
export const vegetarianDailyId = dailyMenuItems.vegetarian;

export interface FixedOptionsOnlySectionRule {
  filterId: string;
  sectionId: string;
  title: string;
  itemIds: readonly string[];
}

export const fixedOptionsOnlySectionRules: readonly FixedOptionsOnlySectionRule[] = [
  {
    filterId: "tartas",
    sectionId: menuSections.piesTortillasOmelettes,
    title: "Tartas",
    itemIds: [catalogItems.tartas],
  },
  {
    filterId: "tortillas",
    sectionId: menuSections.piesTortillasOmelettes,
    title: "Tortillas",
    itemIds: [catalogItems.tortilla],
  },
  {
    filterId: "omelettes",
    sectionId: menuSections.piesTortillasOmelettes,
    title: "Omelettes",
    itemIds: [catalogItems.omeletteSpinach, catalogItems.omeletteHam],
  },
  {
    filterId: "empanadas",
    sectionId: menuSections.empanadas,
    title: "Empanadas",
    itemIds: [catalogItems.empanadas],
  },
];

export interface FixedMenuLocation extends CatalogSectionState {
  filter_id: string;
  item_ids: readonly string[] | null;
}

export function getFixedMenuLocations(sections: readonly CatalogSectionState[]): FixedMenuLocation[] {
  return sections.flatMap((section): FixedMenuLocation[] => {
    const optionOnlyRules = fixedOptionsOnlySectionRules.filter((rule) =>
      rule.sectionId === section.section_id
    );

    if (optionOnlyRules.length === 0) {
      return [{ ...section, filter_id: section.section_id, item_ids: null }];
    }

    return optionOnlyRules.map((rule) => ({
      ...section,
      filter_id: rule.filterId,
      title: rule.title,
      item_count: rule.itemIds.length,
      item_ids: rule.itemIds,
    }));
  });
}

export function getFixedMenuEditMode(section: FixedMenuLocation): FixedMenuEditMode {
  return section.item_ids ? "options-only" : "items";
}

export function catalogItemFormRequiresPrice(section: CatalogSectionState): boolean {
  return section.section_id !== menuSections.sides;
}

export function isIncludedSideOptionItem(item: CatalogItemState): boolean {
  if (item.section_id === menuSections.sides && item.item_id !== catalogItems.sideOnly) {
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
