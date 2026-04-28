import { getCollection } from "astro:content";
import type { CollectionEntry } from "astro:content";
import type { MenuPricing } from "../types/menu";

type MenuProfileEntry = CollectionEntry<"menu-profiles">;
type MenuOverrideEntry = CollectionEntry<"menu-overrides">;
type MenuCatalogSectionEntry = CollectionEntry<"menu-catalog-sections">;
type MenuDailySectionEntry = CollectionEntry<"menu-daily-sections">;
type MenuSectionData =
  | MenuCatalogSectionEntry["data"]
  | MenuDailySectionEntry["data"];
type MenuCatalogSectionData = MenuCatalogSectionEntry["data"];

interface MenuItemOverride {
  itemId: string;
  available?: boolean;
  pricing?: MenuPricing;
  note?: string;
}

interface MenuGroupOverride {
  groupId: string;
  pricing?: MenuPricing;
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

interface MenuCatalogItem {
  itemId: string;
  available: boolean;
  note?: string;
  pricing?: MenuPricing;
  options?: { id: string }[];
}

interface MenuCatalogGroup {
  groupId: string;
  note?: string;
  pricing?: MenuPricing;
  items: MenuCatalogItem[];
}

interface MenuContentSnapshot {
  profiles: MenuProfileEntry[];
  overrides: MenuOverrideData[];
  catalogSections: MenuCatalogSectionData[];
  dailyEntries: MenuDailySectionEntry[];
}

let menuContentSnapshot: Promise<MenuContentSnapshot> | undefined;

export const getMenuProfile = async (menuId: string) => {
  const { profiles } = await getValidatedMenuContent();
  const profile = profiles.find((entry: MenuProfileEntry) => entry.data.id === menuId);

  if (!profile) {
    throw new Error(`Menu profile not found: ${menuId}`);
  }

  return profile.data satisfies MenuProfileEntry["data"];
};

export const getMenuSections = async (menuId: string) => {
  const { catalogSections, dailyEntries, overrides } = await getValidatedMenuContent();
  const dailyEntry = dailyEntries.find((entry: MenuDailySectionEntry) => entry.id === menuId);

  if (!dailyEntry) {
    throw new Error(`Daily menu section not found: ${menuId}`);
  }

  const override = overrides.find((entry: MenuOverrideData) => entry.menuId === menuId);

  return [
    dailyEntry.data,
    ...applyMenuOverrides(catalogSections, override),
  ] satisfies MenuSectionData[];
};

const getValidatedMenuContent = async () => {
  menuContentSnapshot ??= loadValidatedMenuContent();

  return menuContentSnapshot;
};

const loadValidatedMenuContent = async () => {
  const [profiles, overrideEntries, catalogEntries, dailyEntries] = await Promise.all([
    getCollection("menu-profiles"),
    getCollection("menu-overrides"),
    getCollection("menu-catalog-sections"),
    getCollection("menu-daily-sections"),
  ]);
  const overrides = overrideEntries.map(
    (entry: MenuOverrideEntry): MenuOverrideData => entry.data as MenuOverrideData,
  );
  const catalogSections = catalogEntries
    .map((section: MenuCatalogSectionEntry): MenuCatalogSectionEntry["data"] => section.data)
    .sort(
      (
        left: MenuCatalogSectionEntry["data"],
        right: MenuCatalogSectionEntry["data"],
      ) => left.order - right.order,
    );

  validateMenuContentIntegrity({
    profiles,
    overrides,
    catalogSections,
    dailyEntries,
  });

  return {
    profiles,
    overrides,
    catalogSections,
    dailyEntries,
  } satisfies MenuContentSnapshot;
};

const applyMenuOverrides = (
  sections: MenuCatalogSectionData[],
  override?: MenuOverrideData,
) => {
  if (!override) {
    return sections;
  }

  const sectionOverrides = new Map<string, MenuSectionOverride>(
    override.sections.map((section: MenuSectionOverride) => [section.sectionId, section]),
  );

  return sections.map((section: MenuCatalogSectionData): MenuCatalogSectionData => {
    const sectionOverride = sectionOverrides.get(section.sectionId);

    if (!sectionOverride) {
      return section;
    }

    if (section.items) {
      const itemOverrides = new Map(
        sectionOverride.items?.map((item: MenuItemOverride) => [item.itemId, item]) ?? [],
      );

      return {
        ...section,
        items: section.items.map((item: MenuCatalogItem) =>
          applyItemOverride(item, itemOverrides.get(item.itemId)),
        ),
      } as MenuCatalogSectionData;
    }

    if (section.groups) {
      const groupOverrides = new Map(
        sectionOverride.groups?.map((group: MenuGroupOverride) => [group.groupId, group]) ?? [],
      );

      return {
        ...section,
        groups: section.groups.map((group: MenuCatalogGroup) =>
          applyGroupOverride(group, groupOverrides.get(group.groupId)),
        ),
      } as MenuCatalogSectionData;
    }

    return section;
  });
};

const applyGroupOverride = (
  group: MenuCatalogGroup,
  override?: MenuGroupOverride,
) => {
  if (!override) {
    return group;
  }

  const itemOverrides = new Map(
    override.items?.map((item: MenuItemOverride) => [item.itemId, item]) ?? [],
  );

  return {
    ...group,
    note: override.note ?? group.note,
    pricing: override.pricing ?? group.pricing,
    items: group.items.map((item: MenuCatalogItem) =>
      applyItemOverride(item, itemOverrides.get(item.itemId)),
    ),
  };
};

const applyItemOverride = <TItem extends MenuCatalogItem>(
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
    pricing: override.pricing ?? item.pricing,
  } as TItem;
};

const validateMenuContentIntegrity = ({
  profiles,
  overrides,
  catalogSections,
  dailyEntries,
}: MenuContentSnapshot) => {
  const profileIds = profiles.map((entry: MenuProfileEntry) => entry.data.id);
  const profileIdSet = new Set(profileIds);

  assertUniqueIds(profileIds, "menu profile id");
  assertUniqueIds(
    catalogSections.map((section: MenuCatalogSectionData) => section.sectionId),
    "catalog section id",
  );
  assertUniqueIds(
    overrides.map((override: MenuOverrideData) => override.menuId),
    "menu override menuId",
  );

  for (const dailyEntry of dailyEntries) {
    if (!profileIdSet.has(dailyEntry.id)) {
      throw new Error(
        `Daily menu section file ${dailyEntry.id} does not match a menu profile id.`,
      );
    }

    validateSectionIds(`daily menu ${dailyEntry.id}`, dailyEntry.data);
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
      section.items.map((item: MenuCatalogItem) => item.itemId),
      `${scope} item id`,
    );
    section.items.forEach((item: MenuCatalogItem) =>
      validateItemChildIds(`${scope} item ${item.itemId}`, item),
    );
  }

  if (section.groups) {
    assertUniqueIds(
      section.groups.map((group: MenuCatalogGroup) => group.groupId),
      `${scope} group id`,
    );

    section.groups.forEach((group: MenuCatalogGroup) => {
      assertUniqueIds(
        group.items.map((item: MenuCatalogItem) => item.itemId),
        `${scope} group ${group.groupId} item id`,
      );
      group.items.forEach((item: MenuCatalogItem) =>
        validateItemChildIds(`${scope} group ${group.groupId} item ${item.itemId}`, item),
      );
    });
  }
};

const validateItemChildIds = (scope: string, item: MenuCatalogItem) => {
  if (item.options) {
    assertUniqueIds(
      item.options.map((option: { id: string }) => option.id),
      `${scope} option id`,
    );
  }

  if (item.pricing?.kind === "variants") {
    assertUniqueIds(
      item.pricing.variants.map((variant: { id: string }) => variant.id),
      `${scope} variant id`,
    );
  }
};

const validateOverrideIds = (override: MenuOverrideData) => {
  assertUniqueIds(
    override.sections.map((section: MenuSectionOverride) => section.sectionId),
    `menu override ${override.menuId} section id`,
  );

  for (const section of override.sections) {
    if (section.items) {
      assertUniqueIds(
        section.items.map((item: MenuItemOverride) => item.itemId),
        `menu override ${override.menuId} section ${section.sectionId} item id`,
      );
    }

    if (section.groups) {
      assertUniqueIds(
        section.groups.map((group: MenuGroupOverride) => group.groupId),
        `menu override ${override.menuId} section ${section.sectionId} group id`,
      );

      for (const group of section.groups) {
        assertUniqueIds(
          group.items?.map((item: MenuItemOverride) => item.itemId) ?? [],
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
      (candidate: MenuCatalogSectionData) => candidate.sectionId === sectionOverride.sectionId,
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
    if (!section.items.some((item: MenuCatalogItem) => item.itemId === itemOverride.itemId)) {
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
      (candidate: MenuCatalogGroup) => candidate.groupId === groupOverride.groupId,
    );

    if (!group) {
      throw new Error(
        `Menu override ${menuId} references unknown group ${groupOverride.groupId} in section ${section.sectionId}`,
      );
    }

    for (const itemOverride of groupOverride.items ?? []) {
      if (!group.items.some((item: MenuCatalogItem) => item.itemId === itemOverride.itemId)) {
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
