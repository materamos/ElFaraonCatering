import postgres from "postgres";
import { loadLocalEnv } from "./load-local-env.mjs";

const privateDatabaseUrlEnvName = ["SUPABASE", "DB", "URL"].join("_");
const dailyMenuWithDrinkPricingKey = "menu-del-dia-con-bebida";
const dailyMenuVegetarianPricingKey = "menu-vegetariano-del-dia";

loadLocalEnv();

export const loadSupabaseMenuSnapshot = async (
  databaseUrl = process.env[privateDatabaseUrlEnvName],
) => {
  if (!databaseUrl) {
    throw new Error("Private Supabase database URL is required to read menu content.");
  }

  const sql = postgres(databaseUrl, {
    max: 1,
    prepare: false,
  });

  try {
    const rows = await loadRows(sql);

    return createSnapshot(rows);
  } finally {
    await sql.end();
  }
};

const loadRows = async (sql) => {
  const [
    profiles,
    facts,
    payments,
    paymentMethods,
    prices,
    priceVariants,
    dailyMenus,
    dailyServiceSettings,
    sections,
    groups,
    items,
    options,
    sectionItems,
    groupItems,
    grillItems,
    overrides,
    overrideSections,
    overrideGroups,
    overrideSectionItems,
    overrideGroupItems,
  ] = await Promise.all([
    sql`select * from menu_content.menu_profiles order by id`,
    sql`select * from menu_content.menu_profile_facts order by profile_id, order_index`,
    sql`select * from menu_content.menu_profile_payments order by profile_id`,
    sql`select * from menu_content.menu_profile_payment_methods order by profile_id, order_index`,
    sql`select pricing_key, kind, amount from menu_content.menu_prices order by pricing_key`,
    sql`select * from menu_content.menu_price_variants order by pricing_key, order_index`,
    sql`select * from menu_content.menu_daily_menu order by id`,
    sql`select * from menu_content.menu_daily_service_settings order by profile_id`,
    sql`select * from menu_content.menu_sections order by section_scope, coalesce(menu_id, ''), order_index`,
    sql`select * from menu_content.menu_groups order by section_row_id, order_index`,
    sql`select * from menu_content.menu_items order by id`,
    sql`select * from menu_content.menu_item_options order by item_row_id, order_index`,
    sql`select * from menu_content.menu_section_items order by section_row_id, order_index`,
    sql`select * from menu_content.menu_group_items order by group_row_id, order_index`,
    sql`select * from menu_content.menu_grill_items order by order_index`,
    sql`select * from menu_content.menu_overrides order by menu_id`,
    sql`select * from menu_content.menu_override_sections order by override_row_id, order_index`,
    sql`select * from menu_content.menu_override_groups order by override_section_row_id, order_index`,
    sql`select * from menu_content.menu_override_section_items order by override_section_row_id, order_index`,
    sql`select * from menu_content.menu_override_group_items order by override_group_row_id, order_index`,
  ]);

  return {
    profiles,
    facts,
    payments,
    paymentMethods,
    prices,
    priceVariants,
    dailyMenus,
    dailyServiceSettings,
    sections,
    groups,
    items,
    options,
    sectionItems,
    groupItems,
    grillItems,
    overrides,
    overrideSections,
    overrideGroups,
    overrideSectionItems,
    overrideGroupItems,
  };
};

const createSnapshot = (rows) => {
  const priceMap = createPriceMap(rows.prices, rows.priceVariants);
  const itemMap = new Map(rows.items.map((item) => [Number(item.id), item]));
  const optionsByItem = groupByNumberKey(rows.options, "item_row_id");
  const sectionItemsBySection = groupByNumberKey(rows.sectionItems, "section_row_id");
  const groupsBySection = groupByNumberKey(rows.groups, "section_row_id");
  const groupItemsByGroup = groupByNumberKey(rows.groupItems, "group_row_id");
  const factsByProfile = groupByStringKey(rows.facts, "profile_id");
  const paymentByProfile = new Map(rows.payments.map((payment) => [payment.profile_id, payment]));
  const paymentMethodsByProfile = groupByStringKey(rows.paymentMethods, "profile_id");
  const dailyMenu = createDailyMenu(rows.dailyMenus, priceMap);
  const grillSection = createGrillSection({
    grillItems: rows.grillItems,
    priceMap,
    itemMap,
    optionsByItem,
  });

  const profiles = rows.profiles.map((profile) => {
    const payment = paymentByProfile.get(profile.id);

    if (!payment) {
      throw new Error(`Missing payment data for profile: ${profile.id}`);
    }

    return {
      id: profile.id,
      data: {
        id: profile.id,
        eyebrow: profile.eyebrow,
        title: profile.title,
        description: profile.description,
        infoTitle: profile.info_title,
        facts: (factsByProfile.get(profile.id) ?? []).map((fact) =>
          cleanOptional({
            id: fact.fact_id,
            label: fact.label,
            value: fact.value,
            link:
              fact.link_text && fact.link_href
                ? {
                    text: fact.link_text,
                    href: fact.link_href,
                  }
                : undefined,
          }),
        ),
        payment: {
          id: payment.payment_id,
          label: payment.label,
          methods: (paymentMethodsByProfile.get(profile.id) ?? []).map(
            (method) => method.method,
          ),
        },
      },
    };
  });

  const sectionRecords = rows.sections.map((section) => ({
    id: section.menu_id ?? section.section_id,
    scope: section.section_scope,
    menuId: section.menu_id,
    data: createSection({
      section,
      priceMap,
      itemMap,
      optionsByItem,
      sectionItemsBySection,
      groupsBySection,
      groupItemsByGroup,
    }),
  }));

  return {
    profiles,
    overrides: createOverrides(rows, priceMap),
    catalogSections: sectionRecords
      .filter((record) => record.scope === "catalog")
      .map((record) => record.data)
      .sort((left, right) => left.order - right.order),
    dailyMenu,
    dailyServiceSettings: rows.dailyServiceSettings.map((entry) => ({
      menuId: entry.profile_id,
      grillEnabled: entry.grill_enabled,
    })),
    grillSection,
  };
};

const createDailyMenu = (dailyMenus, priceMap) => {
  if (dailyMenus.length !== 1) {
    throw new Error("Supabase menu content must define one current daily menu row.");
  }

  const dailyMenu = dailyMenus[0];
  const dailyMenuAvailable = dailyMenu.available;

  return {
    items: [
      cleanOptional({
        itemId: "menu-del-dia",
        name: dailyMenu.name,
        description: dailyMenu.description ?? undefined,
        note: dailyMenu.note ?? undefined,
        available: dailyMenuAvailable,
        pricing: requireMapValue(priceMap, dailyMenu.pricing_key),
      }),
      {
        itemId: "menu-del-dia-con-bebida",
        name: "Menu del dia + bebida",
        available: dailyMenuAvailable,
        pricing: requireMapValue(priceMap, dailyMenuWithDrinkPricingKey),
      },
      {
        itemId: "menu-vegetariano-del-dia",
        name: "Menu del dia vegetariano",
        available: dailyMenuAvailable,
        pricing: requireMapValue(priceMap, dailyMenuVegetarianPricingKey),
      },
    ],
  };
};

const createGrillSection = ({ grillItems, priceMap, itemMap, optionsByItem }) => ({
  sectionId: "parrilla",
  title: "Parrilla",
  description: "Productos de parrilla. La disponibilidad puede variar durante el dia.",
  order: 10,
  presentation: "compact-list",
  items: grillItems.map((itemRow) =>
    createItem({
      occurrence: itemRow,
      item: requireMapValue(itemMap, Number(itemRow.item_row_id)),
      options: optionsByItem.get(Number(itemRow.item_row_id)) ?? [],
      priceMap,
    }),
  ),
});

const createSection = ({
  section,
  priceMap,
  itemMap,
  optionsByItem,
  sectionItemsBySection,
  groupsBySection,
  groupItemsByGroup,
}) => {
  const baseSection = cleanOptional({
    sectionId: section.section_id,
    title: section.title,
    description: section.description ?? undefined,
    note: section.note ?? undefined,
    order: section.order_index,
  });

  if (section.content_kind === "items") {
    return {
      ...baseSection,
      items: (sectionItemsBySection.get(Number(section.id)) ?? []).map((itemRow) =>
        createItem({
          occurrence: itemRow,
          item: requireMapValue(itemMap, Number(itemRow.item_row_id)),
          options: optionsByItem.get(Number(itemRow.item_row_id)) ?? [],
          priceMap,
        }),
      ),
    };
  }

  return {
    ...baseSection,
    groups: (groupsBySection.get(Number(section.id)) ?? []).map((group) =>
      cleanOptional({
        groupId: group.group_id,
        title: group.title,
        description: group.description ?? undefined,
        note: group.note ?? undefined,
        pricing: readPricing(priceMap, group.pricing_key),
        items: (groupItemsByGroup.get(Number(group.id)) ?? []).map((itemRow) =>
          createItem({
            occurrence: itemRow,
            item: requireMapValue(itemMap, Number(itemRow.item_row_id)),
            options: optionsByItem.get(Number(itemRow.item_row_id)) ?? [],
            priceMap,
          }),
        ),
      }),
    ),
  };
};

const createItem = ({ occurrence, item, options, priceMap }) =>
  cleanOptional({
    itemId: occurrence.item_id,
    name: item.name,
    description: item.description ?? undefined,
    note: occurrence.note ?? undefined,
    available: occurrence.available,
    pricing: readPricing(priceMap, occurrence.pricing_key),
    options:
      options.length > 0
        ? options.map((option) =>
            cleanOptional({
              id: option.option_id,
              name: option.name,
              description: option.description ?? undefined,
              note: option.note ?? undefined,
              available: option.available,
            }),
          )
        : undefined,
    image: item.image_path ?? undefined,
  });

const createOverrides = (rows, priceMap) => {
  const sectionsByOverride = groupByNumberKey(rows.overrideSections, "override_row_id");
  const groupsBySection = groupByNumberKey(rows.overrideGroups, "override_section_row_id");
  const sectionItemsBySection = groupByNumberKey(
    rows.overrideSectionItems,
    "override_section_row_id",
  );
  const groupItemsByGroup = groupByNumberKey(rows.overrideGroupItems, "override_group_row_id");

  return rows.overrides.map((override) => ({
    menuId: override.menu_id,
    sections: (sectionsByOverride.get(Number(override.id)) ?? []).map((section) =>
      cleanOptional({
        sectionId: section.section_id,
        items:
          (sectionItemsBySection.get(Number(section.id)) ?? []).length > 0
            ? (sectionItemsBySection.get(Number(section.id)) ?? []).map((item) =>
                cleanOptional({
                  itemId: item.item_id,
                  available: item.available ?? undefined,
                  pricing: readPricing(priceMap, item.pricing_key),
                  note: item.note ?? undefined,
                }),
              )
            : undefined,
        groups:
          (groupsBySection.get(Number(section.id)) ?? []).length > 0
            ? (groupsBySection.get(Number(section.id)) ?? []).map((group) =>
                cleanOptional({
                  groupId: group.group_id,
                  pricing: readPricing(priceMap, group.pricing_key),
                  note: group.note ?? undefined,
                  items:
                    (groupItemsByGroup.get(Number(group.id)) ?? []).length > 0
                      ? (groupItemsByGroup.get(Number(group.id)) ?? []).map((item) =>
                          cleanOptional({
                            itemId: item.item_id,
                            available: item.available ?? undefined,
                            pricing: readPricing(priceMap, item.pricing_key),
                            note: item.note ?? undefined,
                          }),
                        )
                      : undefined,
                }),
              )
            : undefined,
      }),
    ),
  }));
};

const createPriceMap = (prices, variants) => {
  const variantsByPrice = groupByStringKey(variants, "pricing_key");

  return new Map(
    prices.map((price) => {
      if (price.kind === "fixed") {
        return [
          price.pricing_key,
          {
            kind: "fixed",
            price: {
              amount: price.amount,
            },
          },
        ];
      }

      if (price.kind === "included") {
        return [
          price.pricing_key,
          {
            kind: "included",
          },
        ];
      }

      return [
        price.pricing_key,
        {
          kind: "variants",
          variants: (variantsByPrice.get(price.pricing_key) ?? []).map((variant) => ({
            id: variant.variant_id,
            name: variant.name,
            price: {
              amount: variant.amount,
            },
            available: variant.available,
          })),
        },
      ];
    }),
  );
};

const readPricing = (priceMap, pricingKey) => {
  if (!pricingKey) {
    return undefined;
  }

  return requireMapValue(priceMap, pricingKey);
};

const groupByStringKey = (rows, key) => groupBy(rows, (row) => row[key]);

const groupByNumberKey = (rows, key) => groupBy(rows, (row) => Number(row[key]));

const groupBy = (rows, getKey) => {
  const grouped = new Map();

  for (const row of rows) {
    const key = getKey(row);
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }

  return grouped;
};

const requireMapValue = (map, key) => {
  const value = map.get(key);

  if (!value) {
    throw new Error(`Missing Supabase menu row for key: ${key}`);
  }

  return value;
};

const cleanOptional = (value) =>
  Object.fromEntries(Object.entries(value).filter(([, entryValue]) => entryValue !== undefined));
