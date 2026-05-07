import postgres from "postgres";
import { loadLocalEnv } from "./load-local-env.mjs";

const privateDatabaseUrlEnvName = ["SUPABASE", "DB", "URL"].join("_");

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
    return createSnapshot(await loadRows(sql));
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
    dailyItems,
    profileServiceSettings,
    catalogSections,
    catalogGroups,
    catalogItems,
    catalogItemOptions,
    grillItems,
  ] = await Promise.all([
    sql`select * from menu_content.menu_profiles order by id`,
    sql`select * from menu_content.menu_profile_facts order by profile_id, order_index`,
    sql`select * from menu_content.menu_profile_payments order by profile_id`,
    sql`select * from menu_content.menu_profile_payment_methods order by profile_id, order_index`,
    sql`select pricing_key, kind, amount from menu_content.menu_prices order by pricing_key`,
    sql`select * from menu_content.menu_price_variants order by pricing_key, order_index`,
    sql`select * from menu_content.menu_daily_items order by order_index`,
    sql`select * from menu_content.menu_profile_service_settings order by profile_id`,
    sql`select * from menu_content.menu_catalog_sections order by order_index`,
    sql`select * from menu_content.menu_catalog_groups order by section_id, order_index`,
    sql`select * from menu_content.menu_catalog_items order by section_id, group_id, order_index`,
    sql`select * from menu_content.menu_catalog_item_options order by catalog_item_id, order_index`,
    sql`select * from menu_content.menu_grill_catalog_items order by order_index`,
  ]);

  return {
    profiles,
    facts,
    payments,
    paymentMethods,
    prices,
    priceVariants,
    dailyItems,
    profileServiceSettings,
    catalogSections,
    catalogGroups,
    catalogItems,
    catalogItemOptions,
    grillItems,
  };
};

const createSnapshot = (rows) => {
  const priceMap = createPriceMap(rows.prices, rows.priceVariants);
  const factsByProfile = groupByStringKey(rows.facts, "profile_id");
  const paymentByProfile = new Map(rows.payments.map((payment) => [payment.profile_id, payment]));
  const paymentMethodsByProfile = groupByStringKey(rows.paymentMethods, "profile_id");
  const catalogItemsBySection = groupByStringKey(rows.catalogItems, "section_id");
  const catalogGroupsBySection = groupByStringKey(rows.catalogGroups, "section_id");
  const optionsByCatalogItem = groupByNumberKey(rows.catalogItemOptions, "catalog_item_id");

  const profiles = rows.profiles.map((profile) => {
    const payment = requireMapValue(paymentByProfile, profile.id);

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

  return {
    profiles,
    catalogSections: rows.catalogSections.map((section) =>
      createCatalogSection({
        section,
        groups: catalogGroupsBySection.get(section.section_id) ?? [],
        items: catalogItemsBySection.get(section.section_id) ?? [],
        optionsByCatalogItem,
        priceMap,
      }),
    ),
    dailyMenu: {
      items: rows.dailyItems.map((item) => createFlatItem(item, [], priceMap)),
    },
    dailyServiceSettings: rows.profileServiceSettings.map((entry) => ({
      menuId: entry.profile_id,
      grillEnabled: entry.service_kind === "grill",
    })),
    grillSection: {
      sectionId: "parrilla",
      title: "Parrilla",
      description: "Productos de parrilla. La disponibilidad puede variar durante el dia.",
      order: 10,
      presentation: "compact-list",
      items: rows.grillItems.map((item) => createFlatItem(item, [], priceMap)),
    },
  };
};

const createCatalogSection = ({
  section,
  groups,
  items,
  optionsByCatalogItem,
  priceMap,
}) => {
  const baseSection = cleanOptional({
    sectionId: section.section_id,
    title: section.title,
    description: section.description ?? undefined,
    note: section.note ?? undefined,
    order: section.order_index,
    presentation: section.presentation === "compact-list" ? section.presentation : undefined,
  });

  if (section.content_kind === "items") {
    return {
      ...baseSection,
      items: items
        .filter((item) => item.group_id === "")
        .map((item) =>
          createFlatItem(
            item,
            optionsByCatalogItem.get(Number(item.id)) ?? [],
            priceMap,
          ),
        ),
    };
  }

  const itemsByGroup = groupByStringKey(
    items.filter((item) => item.group_id !== ""),
    "group_id",
  );

  return {
    ...baseSection,
    groups: groups.map((group) =>
      cleanOptional({
        groupId: group.group_id,
        title: group.title,
        description: group.description ?? undefined,
        note: group.note ?? undefined,
        pricing: readPricing(priceMap, group.pricing_key),
        items: (itemsByGroup.get(group.group_id) ?? []).map((item) =>
          createFlatItem(
            item,
            optionsByCatalogItem.get(Number(item.id)) ?? [],
            priceMap,
          ),
        ),
      }),
    ),
  };
};

const createFlatItem = (item, options, priceMap) =>
  cleanOptional({
    itemId: item.item_id,
    name: item.name,
    description: item.description ?? undefined,
    note: item.note ?? undefined,
    available: item.available,
    pricing: readPricing(priceMap, item.pricing_key),
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
