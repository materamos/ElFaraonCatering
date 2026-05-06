import type {
  MenuCatalogSectionData,
  MenuDailyMenuData,
  MenuDailyServiceSettings,
  MenuGroup,
  MenuItem,
  MenuItemsSectionData,
  MenuProfileData,
  MenuSectionData,
} from "../types/menu";
import { loadSupabaseMenuContentSnapshot } from "./menuSupabaseContent";

interface MenuItemOverride {
  itemId: string;
  available?: boolean;
  note?: string;
}

interface MenuGroupOverride {
  groupId: string;
  note?: string;
  items?: MenuItemOverride[];
}

interface MenuSectionOverride {
  sectionId: string;
  items?: MenuItemOverride[];
  groups?: MenuGroupOverride[];
}

interface MenuOverrideData {
  menuId: string;
  sections: MenuSectionOverride[];
}

interface MenuProfileRecord {
  id: string;
  data: MenuProfileData;
}

interface MenuContentSnapshot {
  profiles: MenuProfileRecord[];
  overrides: MenuOverrideData[];
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
  const { catalogSections, overrides } = content;
  const override = overrides.find((entry) => entry.menuId === menuId);

  return [
    getDailyServiceSection(menuId, content),
    ...applyMenuOverrides(catalogSections, override),
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

const applyMenuOverrides = (
  sections: MenuCatalogSectionData[],
  override?: MenuOverrideData,
) => {
  if (!override) {
    return sections;
  }

  const sectionOverrides = new Map<string, MenuSectionOverride>(
    override.sections.map((section) => [section.sectionId, section]),
  );

  return sections.map((section): MenuCatalogSectionData => {
    const sectionOverride = sectionOverrides.get(section.sectionId);

    if (!sectionOverride) {
      return section;
    }

    if (section.items) {
      const itemOverrides = new Map(
        sectionOverride.items?.map((item) => [item.itemId, item]) ?? [],
      );

      return {
        ...section,
        items: section.items.map((item) =>
          applyItemOverride(item, itemOverrides.get(item.itemId)),
        ),
      } as MenuCatalogSectionData;
    }

    if (section.groups) {
      const groupOverrides = new Map(
        sectionOverride.groups?.map((group) => [group.groupId, group]) ?? [],
      );

      return {
        ...section,
        groups: section.groups.map((group) =>
          applyGroupOverride(group, groupOverrides.get(group.groupId)),
        ),
      } as MenuCatalogSectionData;
    }

    return section;
  });
};

const applyGroupOverride = (
  group: MenuGroup,
  override?: MenuGroupOverride,
) => {
  if (!override) {
    return group;
  }

  const itemOverrides = new Map(
    override.items?.map((item) => [item.itemId, item]) ?? [],
  );

  return {
    ...group,
    note: override.note ?? group.note,
    items: group.items.map((item) =>
      applyItemOverride(item, itemOverrides.get(item.itemId)),
    ),
  };
};

const applyItemOverride = <TItem extends MenuItem>(
  item: TItem,
  override?: MenuItemOverride,
) => {
  if (!override) {
    return item;
  }

  return {
    ...item,
    available: override.available ?? item.available,
    note: override.note ?? item.note,
  } as TItem;
};

const validateMenuContentIntegrity = ({
  profiles,
  overrides,
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
  assertUniqueIds(
    overrides.map((override) => override.menuId),
    "menu override menuId",
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

  for (const override of overrides) {
    if (!profileIdSet.has(override.menuId)) {
      throw new Error(`Menu override references unknown profile: ${override.menuId}`);
    }

    validateOverrideIds(override);
    validateMenuOverrides(override.menuId, catalogSections, override);
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

const validateOverrideIds = (override: MenuOverrideData) => {
  assertUniqueIds(
    override.sections.map((section) => section.sectionId),
    `menu override ${override.menuId} section id`,
  );

  for (const section of override.sections) {
    if (section.items) {
      assertUniqueIds(
        section.items.map((item) => item.itemId),
        `menu override ${override.menuId} section ${section.sectionId} item id`,
      );
    }

    if (section.groups) {
      assertUniqueIds(
        section.groups.map((group) => group.groupId),
        `menu override ${override.menuId} section ${section.sectionId} group id`,
      );

      for (const group of section.groups) {
        assertUniqueIds(
          group.items?.map((item) => item.itemId) ?? [],
          `menu override ${override.menuId} section ${section.sectionId} group ${group.groupId} item id`,
        );
      }
    }
  }
};

const validateMenuOverrides = (
  menuId: string,
  sections: MenuCatalogSectionData[],
  override: MenuOverrideData,
) => {
  for (const sectionOverride of override.sections) {
    const section = sections.find(
      (candidate) => candidate.sectionId === sectionOverride.sectionId,
    );

    if (!section) {
      throw new Error(
        `Menu override ${menuId} references unknown section: ${sectionOverride.sectionId}`,
      );
    }

    if (sectionOverride.items) {
      validateSectionItemOverrides(menuId, section, sectionOverride.items);
    }

    if (sectionOverride.groups) {
      validateGroupOverrides(menuId, section, sectionOverride.groups);
    }
  }
};

const validateSectionItemOverrides = (
  menuId: string,
  section: MenuCatalogSectionData,
  itemOverrides: MenuItemOverride[],
) => {
  if (!section.items) {
    throw new Error(
      `Menu override ${menuId} cannot override direct items in grouped section: ${section.sectionId}`,
    );
  }

  for (const itemOverride of itemOverrides) {
    if (!section.items.some((item) => item.itemId === itemOverride.itemId)) {
      throw new Error(
        `Menu override ${menuId} references unknown item ${itemOverride.itemId} in section ${section.sectionId}`,
      );
    }
  }
};

const validateGroupOverrides = (
  menuId: string,
  section: MenuCatalogSectionData,
  groupOverrides: MenuGroupOverride[],
) => {
  if (!section.groups) {
    throw new Error(
      `Menu override ${menuId} cannot override groups in item section: ${section.sectionId}`,
    );
  }

  for (const groupOverride of groupOverrides) {
    const group = section.groups.find(
      (candidate) => candidate.groupId === groupOverride.groupId,
    );

    if (!group) {
      throw new Error(
        `Menu override ${menuId} references unknown group ${groupOverride.groupId} in section ${section.sectionId}`,
      );
    }

    for (const itemOverride of groupOverride.items ?? []) {
      if (!group.items.some((item) => item.itemId === itemOverride.itemId)) {
        throw new Error(
          `Menu override ${menuId} references unknown item ${itemOverride.itemId} in group ${group.groupId}`,
        );
      }
    }
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
