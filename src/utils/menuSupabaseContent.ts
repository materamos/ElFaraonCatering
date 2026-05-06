import postgres from "postgres";
import type {
  MenuCatalogSectionData,
  MenuDailyMenuData,
  MenuDailyServiceSettings,
  MenuItemsSectionData,
  MenuPricing,
  MenuProfileData,
  MenuSectionData,
} from "../types/menu";

type MenuItemData =
  | NonNullable<MenuSectionData["items"]>[number]
  | NonNullable<NonNullable<MenuSectionData["groups"]>[number]["items"]>[number];

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

interface DailyMenuRow {
  id: "current";
  name: string;
  description: string | null;
  note: string | null;
  available: boolean;
  pricing_key: string;
}

interface DailyServiceSettingsRow {
  profile_id: string;
  grill_enabled: boolean;
}

interface SectionRow {
  id: number | string;
  section_id: string;
  title: string;
  description: string | null;
  note: string | null;
  order_index: number;
  content_kind: "items" | "groups";
}

interface GroupRow {
  id: number | string;
  section_row_id: number | string;
  group_id: string;
  title: string;
  description: string | null;
  note: string | null;
  pricing_key: string | null;
}

interface ItemRow {
  id: number | string;
  item_id: string;
  name: string;
  description: string | null;
  image_path: string | null;
}

interface OptionRow {
  item_row_id: number | string;
  option_id: string;
  name: string;
  description: string | null;
  note: string | null;
  available: boolean;
}

interface SectionItemRow {
  section_row_id: number | string;
  item_row_id: number | string;
  item_id: string;
  available: boolean;
  note: string | null;
  pricing_key: string | null;
}

interface GroupItemRow {
  group_row_id: number | string;
  item_row_id: number | string;
  item_id: string;
  available: boolean;
  note: string | null;
  pricing_key: string | null;
}

interface GrillItemRow {
  id: number | string;
  item_row_id: number | string;
  item_id: string;
  available: boolean;
  note: string | null;
  pricing_key: string;
}

interface OverrideRow {
  id: number | string;
  menu_id: string;
}

interface OverrideSectionRow {
  id: number | string;
  override_row_id: number | string;
  section_id: string;
}

interface OverrideGroupRow {
  id: number | string;
  override_section_row_id: number | string;
  group_id: string;
  note: string | null;
}

interface OverrideSectionItemRow {
  override_section_row_id: number | string;
  item_id: string;
  available: boolean | null;
  note: string | null;
}

interface OverrideGroupItemRow {
  override_group_row_id: number | string;
  item_id: string;
  available: boolean | null;
  note: string | null;
}

interface SupabaseRows {
  profiles: ProfileRow[];
  facts: ProfileFactRow[];
  payments: ProfilePaymentRow[];
  paymentMethods: ProfilePaymentMethodRow[];
  prices: PriceRow[];
  priceVariants: PriceVariantRow[];
  dailyMenus: DailyMenuRow[];
  dailyServiceSettings: DailyServiceSettingsRow[];
  sections: SectionRow[];
  groups: GroupRow[];
  items: ItemRow[];
  options: OptionRow[];
  sectionItems: SectionItemRow[];
  groupItems: GroupItemRow[];
  grillItems: GrillItemRow[];
  overrides: OverrideRow[];
  overrideSections: OverrideSectionRow[];
  overrideGroups: OverrideGroupRow[];
  overrideSectionItems: OverrideSectionItemRow[];
  overrideGroupItems: OverrideGroupItemRow[];
}

const dailyMenuWithDrinkPricingKey = "menu-del-dia-con-bebida";
const dailyMenuVegetarianPricingKey = "menu-vegetariano-del-dia";

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
    sql`select * from menu_content.menu_sections order by order_index`,
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
    profiles: profiles as unknown as ProfileRow[],
    facts: facts as unknown as ProfileFactRow[],
    payments: payments as unknown as ProfilePaymentRow[],
    paymentMethods: paymentMethods as unknown as ProfilePaymentMethodRow[],
    prices: prices as unknown as PriceRow[],
    priceVariants: priceVariants as unknown as PriceVariantRow[],
    dailyMenus: dailyMenus as unknown as DailyMenuRow[],
    dailyServiceSettings: dailyServiceSettings as unknown as DailyServiceSettingsRow[],
    sections: sections as unknown as SectionRow[],
    groups: groups as unknown as GroupRow[],
    items: items as unknown as ItemRow[],
    options: options as unknown as OptionRow[],
    sectionItems: sectionItems as unknown as SectionItemRow[],
    groupItems: groupItems as unknown as GroupItemRow[],
    grillItems: grillItems as unknown as GrillItemRow[],
    overrides: overrides as unknown as OverrideRow[],
    overrideSections: overrideSections as unknown as OverrideSectionRow[],
    overrideGroups: overrideGroups as unknown as OverrideGroupRow[],
    overrideSectionItems: overrideSectionItems as unknown as OverrideSectionItemRow[],
    overrideGroupItems: overrideGroupItems as unknown as OverrideGroupItemRow[],
  };
};

const createSnapshot = (rows: SupabaseRows): MenuContentSnapshot => {
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

  const catalogSections = rows.sections
    .map((section) =>
      createSection({
        section,
        priceMap,
        itemMap,
        optionsByItem,
        sectionItemsBySection,
        groupsBySection,
        groupItemsByGroup,
      }) as MenuCatalogSectionData,
    )
    .sort((left, right) => left.order - right.order);

  return {
    profiles,
    overrides: createOverrides(rows),
    catalogSections,
    dailyMenu,
    dailyServiceSettings: rows.dailyServiceSettings.map((entry) => ({
      menuId: entry.profile_id,
      grillEnabled: entry.grill_enabled,
    })),
    grillSection,
  };
};

const createDailyMenu = (
  dailyMenus: DailyMenuRow[],
  priceMap: Map<string, MenuPricing>,
): MenuDailyMenuData => {
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

const createGrillSection = ({
  grillItems,
  priceMap,
  itemMap,
  optionsByItem,
}: {
  grillItems: GrillItemRow[];
  priceMap: Map<string, MenuPricing>;
  itemMap: Map<number, ItemRow>;
  optionsByItem: Map<number, OptionRow[]>;
}): MenuItemsSectionData => ({
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
}: {
  section: SectionRow;
  priceMap: Map<string, MenuPricing>;
  itemMap: Map<number, ItemRow>;
  optionsByItem: Map<number, OptionRow[]>;
  sectionItemsBySection: Map<number, SectionItemRow[]>;
  groupsBySection: Map<number, GroupRow[]>;
  groupItemsByGroup: Map<number, GroupItemRow[]>;
}): MenuSectionData => {
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
    } as MenuSectionData;
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
  } as MenuSectionData;
};

const createItem = ({
  occurrence,
  item,
  options,
  priceMap,
}: {
  occurrence: SectionItemRow | GroupItemRow | GrillItemRow;
  item: ItemRow;
  options: OptionRow[];
  priceMap: Map<string, MenuPricing>;
}): MenuItemData =>
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
  }) as MenuItemData;

const createOverrides = (rows: SupabaseRows): MenuOverrideData[] => {
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
                  note: item.note ?? undefined,
                }),
              )
            : undefined,
        groups:
          (groupsBySection.get(Number(section.id)) ?? []).length > 0
            ? (groupsBySection.get(Number(section.id)) ?? []).map((group) =>
                cleanOptional({
                  groupId: group.group_id,
                  note: group.note ?? undefined,
                  items:
                    (groupItemsByGroup.get(Number(group.id)) ?? []).length > 0
                      ? (groupItemsByGroup.get(Number(group.id)) ?? []).map((item) =>
                          cleanOptional({
                            itemId: item.item_id,
                            available: item.available ?? undefined,
                            note: item.note ?? undefined,
                          }),
                        )
                      : undefined,
                }),
              )
            : undefined,
      }),
    ),
  })) as MenuOverrideData[];
};

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
