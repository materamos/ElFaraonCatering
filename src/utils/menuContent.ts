import type {
  MenuCatalogSectionData,
  MenuDailyMenuData,
  MenuDailyServiceSettings,
  MenuItem,
  MenuItemsSectionData,
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
  dailyServiceSettings: MenuDailyServiceSettings[];
  grillSection: MenuItemsSectionData;
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
  { dailyMenu, dailyServiceSettings, grillSection }: MenuContentSnapshot,
): MenuSectionData => {
  const settings = dailyServiceSettings.find((entry) => entry.menuId === menuId);

  if (!settings) {
    throw new Error(`Daily service settings not found for ${menuId}.`);
  }

  if (settings.grillEnabled) {
    return grillSection;
  }

  return {
    sectionId: "menu-del-dia",
    title: "Menu del dia",
    description: "Opcion principal del dia.",
    order: 10,
    items: dailyMenu.items,
  };
};

const validateMenuContentIntegrity = ({
  profiles,
  catalogSections,
  dailyMenu,
  dailyServiceSettings,
  grillSection,
}: MenuContentSnapshot) => {
  const profileIds = profiles.map((entry) => entry.data.id);
  const profileIdSet = new Set(profileIds);
  const dailyServiceMenuIds = dailyServiceSettings.map((entry) => entry.menuId);

  assertUniqueIds(profileIds, "menu profile id");
  assertUniqueIds(
    catalogSections.map((section) => section.sectionId),
    "catalog section id",
  );
  assertUniqueIds(dailyServiceMenuIds, "daily service settings entry");

  validateSectionIds("daily menu service", {
    sectionId: "menu-del-dia",
    title: "Menu del dia",
    order: 10,
    items: dailyMenu.items,
  });
  validateSectionIds("grill service", grillSection);

  for (const settings of dailyServiceSettings) {
    if (!profileIdSet.has(settings.menuId)) {
      throw new Error(`Daily service settings references unknown profile: ${settings.menuId}`);
    }

    if (typeof settings.grillEnabled !== "boolean") {
      throw new Error(`Daily service settings ${settings.menuId} grillEnabled must be boolean.`);
    }
  }

  for (const profileId of profileIds) {
    if (!dailyServiceMenuIds.includes(profileId)) {
      throw new Error(`Daily service settings missing ${profileId}.`);
    }
  }

  for (const section of catalogSections) {
    validateSectionIds(`catalog section ${section.sectionId}`, section);
  }
};

const validateSectionIds = (scope: string, section: MenuSectionData) => {
  if (section.items) {
    assertUniqueIds(
      section.items.map((item) => item.itemId),
      `${scope} item id`,
    );
    section.items.forEach((item) =>
      validateItemChildIds(`${scope} item ${item.itemId}`, item),
    );
  }

  if (section.groups) {
    assertUniqueIds(
      section.groups.map((group) => group.groupId),
      `${scope} group id`,
    );

    section.groups.forEach((group) => {
      assertUniqueIds(
        group.items.map((item) => item.itemId),
        `${scope} group ${group.groupId} item id`,
      );
      group.items.forEach((item) =>
        validateItemChildIds(`${scope} group ${group.groupId} item ${item.itemId}`, item),
      );
    });
  }
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
