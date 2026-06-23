import type {
  AdminOperationalState,
  AvailabilityTargetState,
  CatalogItemOptionState,
  CatalogItemState,
  CatalogSectionState,
  GrillFamilyState,
  GrillItemState,
  GrillProfileGroup,
} from "./types";

export function getTargetKey(target: {
  menu_id: string;
  section_id: string;
  item_id: string;
}): string {
  return `${target.menu_id}/${target.section_id}/${target.item_id}`;
}

export function getOverlayKey(overlay: {
  menu_id: string;
  section_id: string;
  item_id: string;
}): string {
  return `${overlay.menu_id}/${overlay.section_id}/${overlay.item_id}`;
}

export function normalizeAdminState(
  state: AdminOperationalState,
  deployedContentHash = "",
  requestedPublishHash = "",
): AdminOperationalState {
  return {
    ...state,
    profiles: Array.isArray(state.profiles) ? state.profiles : [],
    service_settings: Array.isArray(state.service_settings) ? state.service_settings : [],
    daily_menu: Array.isArray(state.daily_menu) ? state.daily_menu : [],
    availability_targets: Array.isArray(state.availability_targets)
      ? state.availability_targets.map(normalizeAvailabilityTarget)
      : [],
    availability_overlays: Array.isArray(state.availability_overlays) ? state.availability_overlays : [],
    prices: {
      fixed: Array.isArray(state.prices?.fixed) ? state.prices.fixed : [],
      variants: Array.isArray(state.prices?.variants) ? state.prices.variants : [],
    },
    grill_editor: {
      families: Array.isArray(state.grill_editor?.families)
        ? state.grill_editor.families.map(normalizeGrillFamily)
        : [],
      items: Array.isArray(state.grill_editor?.items)
        ? state.grill_editor.items.map(normalizeGrillItem)
        : [],
    },
    catalog_editor: {
      sections: Array.isArray(state.catalog_editor?.sections)
        ? state.catalog_editor.sections.map(normalizeCatalogSection)
        : [],
      items: Array.isArray(state.catalog_editor?.items)
        ? state.catalog_editor.items.map(normalizeCatalogItem)
        : [],
    },
    publication: normalizePublicationState(
      (state as Partial<AdminOperationalState>).publication,
      deployedContentHash,
      requestedPublishHash,
    ),
  };
}

function normalizePublicationState(
  publication: Partial<AdminOperationalState["publication"]> | undefined,
  deployedContentHash: string,
  requestedPublishHash: string,
): AdminOperationalState["publication"] {
  const currentContentHash = typeof publication?.current_content_hash === "string"
    ? publication.current_content_hash
    : "";
  const publishedContentHash = typeof publication?.published_content_hash === "string"
    ? publication.published_content_hash
    : currentContentHash;
  const normalizedDeployedContentHash = normalizeContentHash(deployedContentHash) ?? "";
  const normalizedRequestedPublishHash = normalizeContentHash(requestedPublishHash);

  return {
    current_content_hash: currentContentHash,
    published_content_hash: publishedContentHash,
    deployed_content_hash: normalizedDeployedContentHash,
    has_unpublished_changes: currentContentHash !== normalizedDeployedContentHash,
    publish_requested:
      currentContentHash !== normalizedDeployedContentHash
      && currentContentHash === normalizedRequestedPublishHash,
  };
}

function normalizeContentHash(value: string): string | null {
  const trimmedValue = value.trim();

  return /^[a-f0-9]{32}$/.test(trimmedValue) ? trimmedValue : null;
}

function normalizeGrillFamily(family: GrillFamilyState): GrillFamilyState {
  return {
    ...family,
    item_count: normalizeNonnegativeInteger(family.item_count),
  };
}

function normalizeGrillItem(item: GrillItemState): GrillItemState {
  const priceAmount = (item as { price_amount?: unknown }).price_amount;

  return {
    ...item,
    price_amount:
      typeof priceAmount === "number" && Number.isSafeInteger(priceAmount) && priceAmount >= 0
        ? priceAmount
        : null,
  };
}

function normalizeCatalogSection(section: CatalogSectionState): CatalogSectionState {
  return {
    ...section,
    item_count: normalizeNonnegativeInteger(section.item_count),
  };
}

function normalizeCatalogItem(item: CatalogItemState): CatalogItemState {
  const priceAmount = (item as { price_amount?: unknown }).price_amount;

  return {
    ...item,
    price_amount:
      typeof priceAmount === "number" && Number.isSafeInteger(priceAmount) && priceAmount >= 0
        ? priceAmount
        : null,
    option_count: normalizeNonnegativeInteger(item.option_count),
    options: Array.isArray(item.options) ? item.options.map(normalizeCatalogItemOption) : [],
  };
}

function normalizeCatalogItemOption(option: CatalogItemOptionState): CatalogItemOptionState {
  return {
    ...option,
    order_index: normalizeNonnegativeInteger(option.order_index),
  };
}

function normalizeAvailabilityTarget(target: AvailabilityTargetState): AvailabilityTargetState {
  const priceAmount = (target as { price_amount?: unknown }).price_amount;

  return {
    ...target,
    price_amount:
      typeof priceAmount === "number" && Number.isSafeInteger(priceAmount) && priceAmount >= 0
        ? priceAmount
        : null,
  };
}

function normalizeNonnegativeInteger(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

export function groupGrillTargets(targets: AvailabilityTargetState[]): GrillProfileGroup[] {
  const profiles: GrillProfileGroup[] = [];
  const profileMap = new Map<string, GrillProfileGroup>();

  for (const target of targets) {
    let profileGroup = profileMap.get(target.menu_id);

    if (!profileGroup) {
      profileGroup = {
        menuId: target.menu_id,
        profileTitle: target.profile_title,
        families: [],
      };
      profileMap.set(target.menu_id, profileGroup);
      profiles.push(profileGroup);
    }

    const familyTitle = target.group_title ?? "Sin familia";
    let family = profileGroup.families.find((entry) => entry.title === familyTitle);

    if (!family) {
      family = { title: familyTitle, targets: [] };
      profileGroup.families.push(family);
    }

    family.targets.push(target);
  }

  return profiles;
}
