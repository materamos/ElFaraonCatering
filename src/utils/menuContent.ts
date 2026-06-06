import type {
  MenuCatalogSectionData,
  MenuDailyMenuData,
  MenuItem,
  MenuProfileServiceSettings,
  MenuProfileData,
  MenuSectionData,
} from "../types/menu";
import { loadSupabaseMenuContentSnapshot } from "./menuSupabaseContent";

interface MenuProfileRecord {
  id: string;
  data: MenuProfileData;
}

interface MenuContentSnapshot {
  profiles: MenuProfileRecord[];
  catalogSections: MenuCatalogSectionData[];
  dailyMenu: MenuDailyMenuData;
  profileServiceSettings: MenuProfileServiceSettings[];
  grillSection: MenuSectionData;
}

let supabaseMenuContentSnapshot: Promise<MenuContentSnapshot> | undefined;

export const getMenuProfile = async (menuId: string) => {
  const { profiles } = await getActiveMenuContent();
  const profile = profiles.find((entry) => entry.data.id === menuId);

  if (!profile) {
    throw new Error(`Menu profile not found: ${menuId}`);
  }

  return profile.data;
};

export const getMenuSections = async (menuId: string) => {
  const content = await getActiveMenuContent();

  return [
    getDailyServiceSection(menuId, content),
    ...content.catalogSections,
  ] satisfies MenuSectionData[];
};

const getActiveMenuContent = async () => {
  supabaseMenuContentSnapshot ??= loadSupabaseMenuContentSnapshot().then((snapshot) => {
    validateMenuContentIntegrity(snapshot);

    return snapshot;
  });

  return supabaseMenuContentSnapshot;
};

const getDailyServiceSection = (
  menuId: string,
  { dailyMenu, profileServiceSettings, grillSection }: MenuContentSnapshot,
): MenuSectionData => {
  const settings = profileServiceSettings.find((entry) => entry.menuId === menuId);

  if (!settings) {
    throw new Error(`Profile service settings not found for ${menuId}.`);
  }

  if (settings.serviceKind === "grill") {
    return grillSection;
  }

  return {
    sectionId: "menu-del-dia",
    title: "Menú del día",
    description: "Opción principal del día.",
    order: 10,
    items: dailyMenu.items,
  };
};

const validateMenuContentIntegrity = ({
  profiles,
  catalogSections,
  dailyMenu,
  profileServiceSettings,
  grillSection,
}: MenuContentSnapshot) => {
  const profileIds = profiles.map((entry) => entry.data.id);
  const profileIdSet = new Set(profileIds);
  const profileServiceMenuIds = profileServiceSettings.map((entry) => entry.menuId);

  assertUniqueIds(profileIds, "menu profile id");
  assertUniqueIds(
    catalogSections.map((section) => section.sectionId),
    "catalog section id",
  );
  assertUniqueIds(profileServiceMenuIds, "profile service settings entry");

  validateSectionIds("daily menu service", {
    sectionId: "menu-del-dia",
    title: "Menú del día",
    order: 10,
    items: dailyMenu.items,
  });
  validateSectionIds("grill service", grillSection);

  for (const settings of profileServiceSettings) {
    if (!profileIdSet.has(settings.menuId)) {
      throw new Error(`Profile service settings references unknown profile: ${settings.menuId}`);
    }

    if (settings.serviceKind !== "daily-menu" && settings.serviceKind !== "grill") {
      throw new Error(`Profile service settings ${settings.menuId} serviceKind must be daily-menu or grill.`);
    }
  }

  for (const profileId of profileIds) {
    if (!profileServiceMenuIds.includes(profileId)) {
      throw new Error(`Profile service settings missing ${profileId}.`);
    }
  }

  for (const section of catalogSections) {
    validateSectionIds(`catalog section ${section.sectionId}`, section);
  }
};

const validateSectionIds = (scope: string, section: MenuSectionData) => {
  assertUniqueIds(
    section.items.map((item) => item.itemId),
    `${scope} item id`,
  );
  section.items.forEach((item) =>
    validateItemChildIds(`${scope} item ${item.itemId}`, item),
  );
};

const validateItemChildIds = (scope: string, item: MenuItem) => {
  if (item.options) {
    assertUniqueIds(
      item.options.map((option) => option.id),
      `${scope} option id`,
    );
  }

  if (item.pricing?.kind === "variants") {
    assertUniqueIds(
      item.pricing.variants.map((variant) => variant.id),
      `${scope} variant id`,
    );
  }
};

const assertUniqueIds = (ids: string[], label: string) => {
  const seenIds = new Set<string>();

  for (const id of ids) {
    if (seenIds.has(id)) {
      throw new Error(`Duplicate ${label}: ${id}`);
    }

    seenIds.add(id);
  }
};
