import postgres from "postgres";
import type {
  MenuCatalogSectionData,
  MenuDailyMenuData,
  MenuItemsSectionData,
  MenuPricing,
  MenuProfileData,
  MenuProfileServiceSettings,
  MenuSectionData,
} from "../types/menu";

type MenuItemData =
  | NonNullable<MenuSectionData["items"]>[number]
  | NonNullable<NonNullable<MenuSectionData["groups"]>[number]["items"]>[number];

interface MenuProfileRecord {
  id: string;
  data: MenuProfileData;
}

interface MenuContentSnapshot {
  profiles: MenuProfileRecord[];
  catalogSections: MenuCatalogSectionData[];
  dailyMenu: MenuDailyMenuData;
  profileServiceSettings: MenuProfileServiceSettings[];
  grillSection: MenuItemsSectionData;
}

interface ProfileRow {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  info_title: string;
}

interface ProfileFactRow {
  profile_id: string;
  fact_id: string;
  label: string;
  value: string;
  link_text: string | null;
  link_href: string | null;
}

interface ProfilePaymentRow {
  profile_id: string;
  payment_id: string;
  label: string;
}

interface ProfilePaymentMethodRow {
  profile_id: string;
  method: string;
}

interface PriceRow {
  pricing_key: string;
  kind: "fixed" | "included" | "variants";
  amount: number | null;
}

interface PriceVariantRow {
  pricing_key: string;
  variant_id: string;
  name: string;
  amount: number;
  available: boolean;
}

interface DailyItemRow {
  item_id: string;
  name: string;
  description: string | null;
  note: string | null;
  available: boolean;
  pricing_key: string;
}

interface ProfileServiceSettingsRow {
  profile_id: string;
  service_kind: "daily-menu" | "grill";
}

interface CatalogSectionRow {
  section_id: string;
  title: string;
  description: string | null;
  note: string | null;
  order_index: number;
  content_kind: "items" | "groups";
  presentation: "cards" | "compact-list";
}

interface CatalogGroupRow {
  section_id: string;
  group_id: string;
  title: string;
  description: string | null;
  note: string | null;
  pricing_key: string | null;
  order_index: number;
}

interface CatalogItemRow {
  id: number | string;
  section_id: string;
  group_id: string;
  item_id: string;
  name: string;
  description: string | null;
  note: string | null;
  image_path: string | null;
  available: boolean;
  pricing_key: string | null;
  order_index: number;
}

interface CatalogItemOptionRow {
  catalog_item_id: number | string;
  option_id: string;
  name: string;
  description: string | null;
  note: string | null;
  available: boolean;
}

interface GrillItemRow {
  id: number | string;
  family_id: string;
  item_id: string;
  name: string;
  description: string | null;
  note: string | null;
  image_path: string | null;
  available: boolean;
  pricing_key: string;
}

interface SupabaseRows {
  profiles: ProfileRow[];
  facts: ProfileFactRow[];
  payments: ProfilePaymentRow[];
  paymentMethods: ProfilePaymentMethodRow[];
  prices: PriceRow[];
  priceVariants: PriceVariantRow[];
  dailyItems: DailyItemRow[];
  profileServiceSettings: ProfileServiceSettingsRow[];
  catalogSections: CatalogSectionRow[];
  catalogGroups: CatalogGroupRow[];
  catalogItems: CatalogItemRow[];
  catalogItemOptions: CatalogItemOptionRow[];
  grillItems: GrillItemRow[];
}

export const loadSupabaseMenuContentSnapshot = async (): Promise<MenuContentSnapshot> => {
  const privateDatabaseUrlEnvName = ["SUPABASE", "DB", "URL"].join("_");
  const databaseUrl = getPrivateEnvironmentValue(privateDatabaseUrlEnvName);

  if (!databaseUrl) {
    throw new Error(
      "Private Supabase database URL is required for build-time menu content.",
    );
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

const getPrivateEnvironmentValue = (name: string): string | undefined =>
  (
    globalThis as typeof globalThis & {
      process?: {
        env?: Record<string, string | undefined>;
      };
    }
  ).process?.env?.[name];

const loadRows = async (sql: ReturnType<typeof postgres>): Promise<SupabaseRows> => {
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
    profiles: profiles as unknown as ProfileRow[],
    facts: facts as unknown as ProfileFactRow[],
    payments: payments as unknown as ProfilePaymentRow[],
    paymentMethods: paymentMethods as unknown as ProfilePaymentMethodRow[],
    prices: prices as unknown as PriceRow[],
    priceVariants: priceVariants as unknown as PriceVariantRow[],
    dailyItems: dailyItems as unknown as DailyItemRow[],
    profileServiceSettings: profileServiceSettings as unknown as ProfileServiceSettingsRow[],
    catalogSections: catalogSections as unknown as CatalogSectionRow[],
    catalogGroups: catalogGroups as unknown as CatalogGroupRow[],
    catalogItems: catalogItems as unknown as CatalogItemRow[],
    catalogItemOptions: catalogItemOptions as unknown as CatalogItemOptionRow[],
    grillItems: grillItems as unknown as GrillItemRow[],
  };
};

const createSnapshot = (rows: SupabaseRows): MenuContentSnapshot => {
  const priceMap = createPriceMap(rows.prices, rows.priceVariants);
  const factsByProfile = groupByStringKey(rows.facts, "profile_id");
  const paymentByProfile = new Map(rows.payments.map((payment) => [payment.profile_id, payment]));
  const paymentMethodsByProfile = groupByStringKey(rows.paymentMethods, "profile_id");
  const catalogItemsBySection = groupByStringKey(rows.catalogItems, "section_id");
  const catalogGroupsBySection = groupByStringKey(rows.catalogGroups, "section_id");
  const optionsByCatalogItem = groupByNumberKey(rows.catalogItemOptions, "catalog_item_id");

  const profiles = rows.profiles.map((profile): MenuProfileRecord => {
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
    profileServiceSettings: rows.profileServiceSettings.map((entry) => ({
      menuId: entry.profile_id,
      serviceKind: entry.service_kind,
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
}: {
  section: CatalogSectionRow;
  groups: CatalogGroupRow[];
  items: CatalogItemRow[];
  optionsByCatalogItem: Map<number, CatalogItemOptionRow[]>;
  priceMap: Map<string, MenuPricing>;
}): MenuCatalogSectionData => {
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

const createFlatItem = (
  item: DailyItemRow | CatalogItemRow | GrillItemRow,
  options: CatalogItemOptionRow[],
  priceMap: Map<string, MenuPricing>,
): MenuItemData =>
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
    image: "image_path" in item ? item.image_path ?? undefined : undefined,
  }) as MenuItemData;

const createPriceMap = (
  prices: PriceRow[],
  variants: PriceVariantRow[],
): Map<string, MenuPricing> => {
  const variantsByPrice = groupByStringKey(variants, "pricing_key");

  return new Map<string, MenuPricing>(
    prices.map((price): [string, MenuPricing] => {
      if (price.kind === "fixed") {
        return [
          price.pricing_key,
          {
            kind: "fixed",
            price: {
              amount: Number(price.amount),
            },
          } satisfies MenuPricing,
        ];
      }

      if (price.kind === "included") {
        return [
          price.pricing_key,
          {
            kind: "included",
          } satisfies MenuPricing,
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
              amount: Number(variant.amount),
            },
            available: variant.available,
          })),
        } satisfies MenuPricing,
      ];
    }),
  );
};

const readPricing = (
  priceMap: Map<string, MenuPricing>,
  pricingKey?: string | null,
): MenuPricing | undefined => {
  if (!pricingKey) {
    return undefined;
  }

  return requireMapValue(priceMap, pricingKey);
};

const groupByStringKey = <TRow extends Record<TKey, string>, TKey extends keyof TRow>(
  rows: TRow[],
  key: TKey,
) => groupBy(rows, (row) => row[key]);

const groupByNumberKey = <
  TRow extends Record<TKey, number | string | undefined>,
  TKey extends keyof TRow,
>(
  rows: TRow[],
  key: TKey,
) => groupBy(rows, (row) => Number(row[key]));

const groupBy = <TRow, TKey extends string | number>(
  rows: TRow[],
  getKey: (row: TRow) => TKey,
) => {
  const grouped = new Map<TKey, TRow[]>();

  for (const row of rows) {
    const key = getKey(row);
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }

  return grouped;
};

const requireMapValue = <TKey, TValue>(map: Map<TKey, TValue>, key: TKey) => {
  const value = map.get(key);

  if (!value) {
    throw new Error(`Missing Supabase menu row for key: ${String(key)}`);
  }

  return value;
};

const cleanOptional = <TValue extends Record<string, unknown>>(value: TValue) =>
  Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  ) as TValue;
