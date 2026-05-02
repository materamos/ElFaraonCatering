import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";

export const menuIdsForComparison = ["corpo", "teleinde"];

export const structuralTableNames = [
  "menu_override_group_items",
  "menu_override_section_items",
  "menu_override_groups",
  "menu_override_sections",
  "menu_overrides",
  "menu_item_options",
  "menu_group_items",
  "menu_section_items",
  "menu_items",
  "menu_groups",
  "menu_sections",
  "menu_price_variants",
  "menu_prices",
  "menu_profile_payment_methods",
  "menu_profile_payments",
  "menu_profile_facts",
  "menu_profiles",
];

export const insertTableOrder = [
  "menu_profiles",
  "menu_profile_facts",
  "menu_profile_payments",
  "menu_profile_payment_methods",
  "menu_prices",
  "menu_price_variants",
  "menu_sections",
  "menu_groups",
  "menu_items",
  "menu_item_options",
  "menu_section_items",
  "menu_group_items",
  "menu_overrides",
  "menu_override_sections",
  "menu_override_groups",
  "menu_override_section_items",
  "menu_override_group_items",
];

const contentDirs = {
  profiles: ["src", "content", "menu-profiles"],
  overrides: ["src", "content", "menu-overrides"],
  catalogSections: ["src", "content", "menu-catalog-sections"],
  dailySections: ["src", "content", "menu-daily-sections"],
};

const technicalIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const loadYamlMenuContent = async (rootDir = process.cwd()) => ({
  profiles: await readYamlEntries(rootDir, contentDirs.profiles),
  overrides: await readYamlEntries(rootDir, contentDirs.overrides),
  catalogSections: await readYamlEntries(rootDir, contentDirs.catalogSections),
  dailySections: await readYamlEntries(rootDir, contentDirs.dailySections),
});

export const createYamlMenuSnapshot = (content) => ({
  profiles: content.profiles.map((entry) => ({
    id: entry.id,
    data: entry.data,
  })),
  overrides: content.overrides.map((entry) => ({
    ...(entry.data ?? {}),
    sections: entry.data?.sections ?? [],
  })),
  catalogSections: content.catalogSections
    .map((entry) => entry.data)
    .sort((left, right) => left.order - right.order),
  dailyEntries: content.dailySections.map((entry) => ({
    id: entry.id,
    data: entry.data,
  })),
});

export const getMenuProjectionFromSnapshot = (snapshot, menuId) => {
  const profile = snapshot.profiles.find((entry) => entry.data.id === menuId);

  if (!profile) {
    throw new Error(`Menu profile not found: ${menuId}`);
  }

  const dailyEntry = snapshot.dailyEntries.find((entry) => entry.id === menuId);

  if (!dailyEntry) {
    throw new Error(`Daily menu section not found: ${menuId}`);
  }

  const override = snapshot.overrides.find((entry) => entry.menuId === menuId);

  return {
    profile: cloneData(profile.data),
    sections: [
      cloneData(dailyEntry.data),
      ...applyMenuOverrides(snapshot.catalogSections, override).map(cloneData),
    ],
  };
};

export const applyMenuOverrides = (sections, override) => {
  if (!override) {
    return sections;
  }

  const sectionOverrides = new Map(
    (override.sections ?? []).map((section) => [section.sectionId, section]),
  );

  return sections.map((section) => {
    const sectionOverride = sectionOverrides.get(section.sectionId);

    if (!sectionOverride) {
      return section;
    }

    if (Array.isArray(section.items)) {
      const itemOverrides = new Map(
        (sectionOverride.items ?? []).map((item) => [item.itemId, item]),
      );

      return {
        ...section,
        items: section.items.map((item) =>
          applyItemOverride(item, itemOverrides.get(item.itemId)),
        ),
      };
    }

    if (Array.isArray(section.groups)) {
      const groupOverrides = new Map(
        (sectionOverride.groups ?? []).map((group) => [group.groupId, group]),
      );

      return {
        ...section,
        groups: section.groups.map((group) =>
          applyGroupOverride(group, groupOverrides.get(group.groupId)),
        ),
      };
    }

    return section;
  });
};

export const projectStructuralRows = (content) => {
  const rows = createEmptyRows();
  const warnings = [];
  const priceKeys = new Set();
  const itemKeys = new Set();
  const sectionKeys = new Set();
  const groupKeys = new Set();
  const catalogSectionById = new Map();

  const warn = (message) => warnings.push(message);
  const snapshot = createYamlMenuSnapshot(content);
  const profileIds = new Set(snapshot.profiles.map((entry) => entry.data.id));

  for (const entry of snapshot.profiles) {
    const profile = entry.data;
    validateTechnicalId(profile.id, `profile ${entry.id}`, warn);

    rows.menu_profiles.push({
      id: profile.id,
      eyebrow: profile.eyebrow,
      title: profile.title,
      description: profile.description,
      info_title: profile.infoTitle,
    });

    profile.facts.forEach((fact, index) => {
      validateTechnicalId(fact.id, `profile ${profile.id} fact`, warn);
      rows.menu_profile_facts.push({
        profile_id: profile.id,
        fact_id: fact.id,
        label: fact.label,
        value: fact.value,
        link_text: fact.link?.text ?? null,
        link_href: fact.link?.href ?? null,
        order_index: index,
      });
    });

    rows.menu_profile_payments.push({
      profile_id: profile.id,
      payment_id: profile.payment.id,
      label: profile.payment.label,
    });

    profile.payment.methods.forEach((method, index) => {
      rows.menu_profile_payment_methods.push({
        profile_id: profile.id,
        method,
        order_index: index,
      });
    });
  }

  for (const section of snapshot.catalogSections) {
    catalogSectionById.set(section.sectionId, section);
    addSection({
      section,
      scope: "catalog",
      menuId: null,
      sectionKey: `catalog:${section.sectionId}`,
      rows,
      warn,
      priceKeys,
      itemKeys,
      sectionKeys,
      groupKeys,
    });
  }

  for (const entry of snapshot.dailyEntries) {
    if (!profileIds.has(entry.id)) {
      warn(`Daily section file ${entry.id} has no matching menu profile.`);
    }

    addSection({
      section: entry.data,
      scope: "daily",
      menuId: entry.id,
      sectionKey: `daily:${entry.id}:${entry.data.sectionId}`,
      rows,
      warn,
      priceKeys,
      itemKeys,
      sectionKeys,
      groupKeys,
    });
  }

  for (const override of snapshot.overrides) {
    if (!profileIds.has(override.menuId)) {
      warn(`Override references unknown profile: ${override.menuId}`);
    }

    const overrideKey = `override:${override.menuId}`;
    rows.menu_overrides.push({
      override_key: overrideKey,
      menu_id: override.menuId,
    });

    (override.sections ?? []).forEach((sectionOverride, sectionIndex) => {
      const overrideSectionKey = `${overrideKey}:section:${sectionOverride.sectionId}`;
      const catalogSection = catalogSectionById.get(sectionOverride.sectionId);

      if (!catalogSection) {
        warn(
          `Override ${override.menuId} references unknown catalog section ${sectionOverride.sectionId}.`,
        );
      }

      rows.menu_override_sections.push({
        override_section_key: overrideSectionKey,
        override_key: overrideKey,
        section_id: sectionOverride.sectionId,
        order_index: sectionIndex,
      });

      (sectionOverride.items ?? []).forEach((itemOverride, itemIndex) => {
        if (
          catalogSection?.items &&
          !catalogSection.items.some((item) => item.itemId === itemOverride.itemId)
        ) {
          warn(
            `Override ${override.menuId} references unknown item ${itemOverride.itemId} in section ${sectionOverride.sectionId}.`,
          );
        }

        rows.menu_override_section_items.push({
          override_section_item_key: `${overrideSectionKey}:item:${itemOverride.itemId}`,
          override_section_key: overrideSectionKey,
          item_id: itemOverride.itemId,
          available: itemOverride.available ?? null,
          pricing_key: addPricing(
            `${overrideSectionKey}:item:${itemOverride.itemId}`,
            itemOverride.pricing,
            rows,
            priceKeys,
            warn,
          ),
          note: itemOverride.note ?? null,
          order_index: itemIndex,
        });
      });

      (sectionOverride.groups ?? []).forEach((groupOverride, groupIndex) => {
        const catalogGroup = catalogSection?.groups?.find(
          (group) => group.groupId === groupOverride.groupId,
        );

        if (!catalogGroup) {
          warn(
            `Override ${override.menuId} references unknown group ${groupOverride.groupId} in section ${sectionOverride.sectionId}.`,
          );
        }

        const overrideGroupKey = `${overrideSectionKey}:group:${groupOverride.groupId}`;
        rows.menu_override_groups.push({
          override_group_key: overrideGroupKey,
          override_section_key: overrideSectionKey,
          group_id: groupOverride.groupId,
          pricing_key: addPricing(
            overrideGroupKey,
            groupOverride.pricing,
            rows,
            priceKeys,
            warn,
          ),
          note: groupOverride.note ?? null,
          order_index: groupIndex,
        });

        (groupOverride.items ?? []).forEach((itemOverride, itemIndex) => {
          if (
            catalogGroup &&
            !catalogGroup.items.some((item) => item.itemId === itemOverride.itemId)
          ) {
            warn(
              `Override ${override.menuId} references unknown item ${itemOverride.itemId} in group ${groupOverride.groupId}.`,
            );
          }

          rows.menu_override_group_items.push({
            override_group_item_key: `${overrideGroupKey}:item:${itemOverride.itemId}`,
            override_group_key: overrideGroupKey,
            item_id: itemOverride.itemId,
            available: itemOverride.available ?? null,
            pricing_key: addPricing(
              `${overrideGroupKey}:item:${itemOverride.itemId}`,
              itemOverride.pricing,
              rows,
              priceKeys,
              warn,
            ),
            note: itemOverride.note ?? null,
            order_index: itemIndex,
          });
        });
      });
    });
  }

  return {
    rows,
    warnings,
    counts: collectCounts(rows),
  };
};

export const normalizeMenuProjection = (projection) =>
  canonicalize({
    profile: normalizeProfile(projection.profile),
    sections: projection.sections.map(normalizeSection),
  });

export const findFirstDifference = (left, right, pathName = "$") => {
  if (Object.is(left, right)) {
    return null;
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) {
      return `${pathName}: type mismatch`;
    }

    if (left.length !== right.length) {
      return `${pathName}: array length ${left.length} !== ${right.length}`;
    }

    for (let index = 0; index < left.length; index += 1) {
      const difference = findFirstDifference(left[index], right[index], `${pathName}[${index}]`);

      if (difference) {
        return difference;
      }
    }

    return null;
  }

  if (isPlainObject(left) || isPlainObject(right)) {
    if (!isPlainObject(left) || !isPlainObject(right)) {
      return `${pathName}: type mismatch`;
    }

    const keys = Array.from(new Set([...Object.keys(left), ...Object.keys(right)])).sort();

    for (const key of keys) {
      if (!(key in left)) {
        return `${pathName}.${key}: missing from YAML`;
      }

      if (!(key in right)) {
        return `${pathName}.${key}: missing from Supabase`;
      }

      const difference = findFirstDifference(left[key], right[key], `${pathName}.${key}`);

      if (difference) {
        return difference;
      }
    }

    return null;
  }

  return `${pathName}: ${JSON.stringify(left)} !== ${JSON.stringify(right)}`;
};

const readYamlEntries = async (rootDir, relativePathSegments) => {
  const directory = path.join(rootDir, ...relativePathSegments);
  const files = (await readdir(directory))
    .filter((fileName) => fileName.endsWith(".yaml") || fileName.endsWith(".yml"))
    .sort((left, right) => left.localeCompare(right));

  return Promise.all(
    files.map(async (fileName) => {
      const filePath = path.join(directory, fileName);
      const source = await readFile(filePath, "utf8");

      return {
        id: path.basename(fileName, path.extname(fileName)),
        fileName,
        filePath,
        data: parse(source),
      };
    }),
  );
};

const createEmptyRows = () =>
  Object.fromEntries(insertTableOrder.map((tableName) => [tableName, []]));

const addSection = ({
  section,
  scope,
  menuId,
  sectionKey,
  rows,
  warn,
  priceKeys,
  itemKeys,
  sectionKeys,
  groupKeys,
}) => {
  if (sectionKeys.has(sectionKey)) {
    warn(`Duplicate section key: ${sectionKey}`);
  }

  sectionKeys.add(sectionKey);
  validateTechnicalId(section.sectionId, `section ${sectionKey}`, warn);

  const hasItems = Array.isArray(section.items) && section.items.length > 0;
  const hasGroups = Array.isArray(section.groups) && section.groups.length > 0;

  if (hasItems === hasGroups) {
    warn(`Section ${sectionKey} must define either items or groups.`);
  }

  rows.menu_sections.push({
    section_key: sectionKey,
    section_scope: scope,
    menu_id: menuId,
    section_id: section.sectionId,
    title: section.title,
    description: section.description ?? null,
    note: section.note ?? null,
    order_index: section.order,
    content_kind: hasGroups ? "groups" : "items",
  });

  (section.items ?? []).forEach((item, index) => {
    if (!item.pricing) {
      warn(`Direct item ${item.itemId} in section ${sectionKey} has no pricing.`);
    }

    const itemKey = `${sectionKey}:item:${item.itemId}`;
    addItemBase({ item, itemKey, rows, itemKeys, warn });

    rows.menu_section_items.push({
      section_item_key: itemKey,
      section_key: sectionKey,
      item_key: itemKey,
      item_id: item.itemId,
      order_index: index,
      available: Boolean(item.available),
      note: item.note ?? null,
      pricing_key: addPricing(itemKey, item.pricing, rows, priceKeys, warn),
    });
  });

  (section.groups ?? []).forEach((group, groupIndex) => {
    const groupKey = `${sectionKey}:group:${group.groupId}`;

    if (groupKeys.has(groupKey)) {
      warn(`Duplicate group key: ${groupKey}`);
    }

    groupKeys.add(groupKey);
    validateTechnicalId(group.groupId, `group ${groupKey}`, warn);

    rows.menu_groups.push({
      group_key: groupKey,
      section_key: sectionKey,
      group_id: group.groupId,
      title: group.title,
      description: group.description ?? null,
      note: group.note ?? null,
      pricing_key: addPricing(groupKey, group.pricing, rows, priceKeys, warn),
      order_index: groupIndex,
    });

    group.items.forEach((item, itemIndex) => {
      if (!group.pricing && !item.pricing) {
        warn(`Grouped item ${item.itemId} in group ${groupKey} has no inherited or direct pricing.`);
      }

      const itemKey = `${groupKey}:item:${item.itemId}`;
      addItemBase({ item, itemKey, rows, itemKeys, warn });

      rows.menu_group_items.push({
        group_item_key: itemKey,
        group_key: groupKey,
        item_key: itemKey,
        item_id: item.itemId,
        order_index: itemIndex,
        available: Boolean(item.available),
        note: item.note ?? null,
        pricing_key: addPricing(itemKey, item.pricing, rows, priceKeys, warn),
      });
    });
  });
};

const addItemBase = ({ item, itemKey, rows, itemKeys, warn }) => {
  if (itemKeys.has(itemKey)) {
    warn(`Duplicate item key: ${itemKey}`);
  }

  itemKeys.add(itemKey);
  validateTechnicalId(item.itemId, `item ${itemKey}`, warn);

  rows.menu_items.push({
    item_key: itemKey,
    item_id: item.itemId,
    name: item.name,
    description: item.description ?? null,
    image_path: item.image ?? null,
  });

  (item.options ?? []).forEach((option, index) => {
    validateTechnicalId(option.id, `option ${itemKey}:${option.id}`, warn);

    rows.menu_item_options.push({
      item_key: itemKey,
      option_id: option.id,
      name: option.name,
      description: option.description ?? null,
      note: option.note ?? null,
      available: option.available ?? true,
      order_index: index,
    });
  });
};

const addPricing = (sourceKey, pricing, rows, priceKeys, warn) => {
  if (!pricing) {
    return null;
  }

  const pricingKey = `${sourceKey}:price`;

  if (priceKeys.has(pricingKey)) {
    return pricingKey;
  }

  priceKeys.add(pricingKey);

  if (pricing.kind === "fixed") {
    if (!Number.isInteger(pricing.price?.amount) || pricing.price.amount < 0) {
      warn(`Fixed price ${pricingKey} must define a nonnegative integer amount.`);
    }

    rows.menu_prices.push({
      pricing_key: pricingKey,
      kind: "fixed",
      amount: pricing.price?.amount ?? null,
      currency: "ARS",
    });

    return pricingKey;
  }

  if (pricing.kind === "included") {
    rows.menu_prices.push({
      pricing_key: pricingKey,
      kind: "included",
      amount: null,
      currency: "ARS",
    });

    return pricingKey;
  }

  if (pricing.kind === "variants") {
    rows.menu_prices.push({
      pricing_key: pricingKey,
      kind: "variants",
      amount: null,
      currency: "ARS",
    });

    (pricing.variants ?? []).forEach((variant, index) => {
      validateTechnicalId(variant.id, `variant ${pricingKey}:${variant.id}`, warn);

      if (!Number.isInteger(variant.price?.amount) || variant.price.amount < 0) {
        warn(`Variant price ${pricingKey}:${variant.id} must define a nonnegative integer amount.`);
      }

      rows.menu_price_variants.push({
        pricing_key: pricingKey,
        variant_id: variant.id,
        name: variant.name,
        amount: variant.price?.amount ?? null,
        available: variant.available ?? true,
        order_index: index,
      });
    });

    if (!Array.isArray(pricing.variants) || pricing.variants.length === 0) {
      warn(`Variant price ${pricingKey} has no variants.`);
    }

    return pricingKey;
  }

  warn(`Unknown pricing kind at ${pricingKey}.`);

  return pricingKey;
};

const applyGroupOverride = (group, override) => {
  if (!override) {
    return group;
  }

  const itemOverrides = new Map(
    (override.items ?? []).map((item) => [item.itemId, item]),
  );

  return {
    ...group,
    note: override.note ?? group.note,
    pricing: override.pricing ?? group.pricing,
    items: group.items.map((item) =>
      applyItemOverride(item, itemOverrides.get(item.itemId)),
    ),
  };
};

const applyItemOverride = (item, override) => {
  if (!override) {
    return item;
  }

  return {
    ...item,
    available: override.available ?? item.available,
    note: override.note ?? item.note,
    pricing: override.pricing ?? item.pricing,
  };
};

const collectCounts = (rows) =>
  Object.fromEntries(insertTableOrder.map((tableName) => [tableName, rows[tableName].length]));

const validateTechnicalId = (value, label, warn) => {
  if (!technicalIdPattern.test(value ?? "")) {
    warn(`${label} has invalid technical id: ${value}`);
  }
};

const normalizeProfile = (profile) => ({
  id: profile.id,
  eyebrow: profile.eyebrow,
  title: profile.title,
  description: profile.description,
  infoTitle: profile.infoTitle,
  facts: (profile.facts ?? []).map((fact) =>
    removeUndefined({
      id: fact.id,
      label: fact.label,
      value: fact.value,
      link: fact.link
        ? {
            text: fact.link.text,
            href: fact.link.href,
          }
        : undefined,
    }),
  ),
  payment: {
    id: profile.payment.id,
    label: profile.payment.label,
    methods: profile.payment.methods ?? [],
  },
});

const normalizeSection = (section) =>
  removeUndefined({
    sectionId: section.sectionId,
    title: section.title,
    description: section.description,
    note: section.note,
    order: section.order,
    items: section.items?.map(normalizeItem),
    groups: section.groups?.map((group) =>
      removeUndefined({
        groupId: group.groupId,
        title: group.title,
        description: group.description,
        note: group.note,
        pricing: normalizePricing(group.pricing),
        items: (group.items ?? []).map(normalizeItem),
      }),
    ),
  });

const normalizeItem = (item) =>
  removeUndefined({
    itemId: item.itemId,
    name: item.name,
    description: item.description,
    note: item.note,
    available: item.available,
    pricing: normalizePricing(item.pricing),
    options: (item.options ?? []).map((option) =>
      removeUndefined({
        id: option.id,
        name: option.name,
        description: option.description,
        note: option.note,
        available: option.available ?? true,
      }),
    ),
    image: item.image,
  });

const normalizePricing = (pricing) => {
  if (!pricing) {
    return undefined;
  }

  if (pricing.kind === "fixed") {
    return {
      kind: "fixed",
      price: {
        amount: pricing.price.amount,
      },
    };
  }

  if (pricing.kind === "included") {
    return {
      kind: "included",
    };
  }

  return {
    kind: "variants",
    variants: (pricing.variants ?? []).map((variant) => ({
      id: variant.id,
      name: variant.name,
      price: {
        amount: variant.price.amount,
      },
      available: variant.available ?? true,
    })),
  };
};

const removeUndefined = (value) =>
  Object.fromEntries(Object.entries(value).filter(([, entryValue]) => entryValue !== undefined));

const canonicalize = (value) => {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (!isPlainObject(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entryValue]) => [key, canonicalize(entryValue)]),
  );
};

const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const cloneData = (value) => JSON.parse(JSON.stringify(value));
