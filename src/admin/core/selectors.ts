import type {
  AdminOperationalState,
  AvailabilityOverlayState,
  AvailabilityTargetState,
  CatalogEditorState,
  CatalogItemOptionState,
  CatalogItemState,
  DailyMenuState,
  GrillFamilyState,
  GrillItemState,
  ProfileState,
  ServiceKind,
} from "./types";
import { getOverlayKey, getTargetKey } from "./adminState";
import { getFixedMenuLocations, type FixedMenuLocation } from "./rules";

export interface AvailabilityGroupOption {
  key: string;
  label: string;
}

export function findDailyItem(
  state: AdminOperationalState,
  itemId: string,
): DailyMenuState | undefined {
  return state.daily_menu.find((item) => item.item_id === itemId);
}

export function findServiceKind(state: AdminOperationalState, profileId: string): ServiceKind {
  return state.service_settings.find((entry) => entry.profile_id === profileId)?.service_kind
    ?? "daily-menu";
}

export function getVisibleAvailabilityTargets(state: AdminOperationalState): AvailabilityTargetState[] {
  return state.availability_targets.filter((target) =>
    target.target_kind === "catalog"
    || target.target_kind === findServiceKind(state, target.menu_id)
  );
}

export function getHiddenAvailabilityTargets(state: AdminOperationalState): AvailabilityTargetState[] {
  return getVisibleAvailabilityTargets(state).filter((target) =>
    findOverlay(state, target)?.available_override === false
  );
}

export function getEditableAvailabilityProfiles(state: AdminOperationalState): ProfileState[] {
  return state.profiles.filter((profile) => profile.can_edit_availability);
}

export function getEffectiveAvailabilityProfileFilter(
  state: AdminOperationalState,
  profileFilter: string,
): string {
  const editableProfiles = getEditableAvailabilityProfiles(state);
  const defaultProfileId = state.staff?.default_availability_profile_id ?? "";

  if (editableProfiles.some((profile) => profile.id === profileFilter)) {
    return profileFilter;
  }

  if (editableProfiles.some((profile) => profile.id === defaultProfileId)) {
    return defaultProfileId;
  }

  return editableProfiles[0]?.id ?? "";
}

export function getAvailabilityGroupKey(target: AvailabilityTargetState): string {
  if (target.target_kind === "grill") {
    return `section:${target.section_id}`;
  }

  if (target.group_title) {
    return `family:${target.section_id}:${target.group_title}`;
  }

  return `section:${target.section_id}`;
}

export function getAvailabilityGroupLabel(target: AvailabilityTargetState): string {
  if (target.target_kind === "grill") {
    return "Parrilla";
  }

  return target.group_title ?? target.section_title;
}

export function getAvailabilityGroupOptions(
  targets: AvailabilityTargetState[],
): AvailabilityGroupOption[] {
  const options: AvailabilityGroupOption[] = [];
  const seenKeys = new Set<string>();

  for (const target of targets) {
    const key = getAvailabilityGroupKey(target);

    if (seenKeys.has(key)) {
      continue;
    }

    seenKeys.add(key);
    options.push({ key, label: getAvailabilityGroupLabel(target) });
  }

  return options;
}

export function getEffectiveAvailabilityGroupFilter(
  groupOptions: AvailabilityGroupOption[],
  groupFilter: string,
): string {
  if (groupOptions.some((option) => option.key === groupFilter)) {
    return groupFilter;
  }

  return groupOptions[0]?.key ?? "";
}

export function getFilteredAvailabilityTargets(
  state: AdminOperationalState,
  filters: { profileFilter: string; groupFilter: string },
): AvailabilityTargetState[] {
  const effectiveProfileFilter = getEffectiveAvailabilityProfileFilter(state, filters.profileFilter);
  const profileTargets = getVisibleAvailabilityTargets(state).filter((target) =>
    target.menu_id === effectiveProfileFilter
  );
  const effectiveGroupFilter = getEffectiveAvailabilityGroupFilter(
    getAvailabilityGroupOptions(profileTargets),
    filters.groupFilter,
  );

  return profileTargets.filter((target) =>
    !effectiveGroupFilter || getAvailabilityGroupKey(target) === effectiveGroupFilter
  );
}

export function getAvailabilityFamilyKey(target: AvailabilityTargetState): string {
  const familyId = target.group_title || target.item_id;

  return `family:${target.menu_id}:${target.section_id}:${familyId}`;
}

export function findOverlay(
  state: AdminOperationalState,
  target: AvailabilityTargetState,
): AvailabilityOverlayState | undefined {
  return state.availability_overlays.find((overlay) => getOverlayKey(overlay) === getTargetKey(target));
}

export function findAvailabilityTarget(
  state: AdminOperationalState,
  key: string,
): AvailabilityTargetState | undefined {
  return getVisibleAvailabilityTargets(state).find((target) => getTargetKey(target) === key);
}

export function findCatalogParentAvailabilityTarget(
  state: AdminOperationalState,
  target: AvailabilityTargetState,
): AvailabilityTargetState | undefined {
  const optionDisplay = getCatalogOptionDisplay(state, target);

  if (!optionDisplay) {
    return undefined;
  }

  return getVisibleAvailabilityTargets(state).find((entry) =>
    entry.menu_id === target.menu_id
    && entry.target_kind === "catalog"
    && entry.section_id === target.section_id
    && entry.item_id === optionDisplay.itemId
  );
}

export function findCatalogOptionAvailabilityTargets(
  state: AdminOperationalState,
  target: AvailabilityTargetState,
): AvailabilityTargetState[] {
  const item = state.catalog_editor.items.find((entry) =>
    entry.section_id === target.section_id
    && entry.item_id === target.item_id
  );

  if (!item || item.options.length === 0) {
    return [];
  }

  const optionIds = new Set(
    item.options.map((option) => `${item.item_id}-${option.option_id}`),
  );

  return getVisibleAvailabilityTargets(state).filter((entry) =>
    entry.menu_id === target.menu_id
    && entry.target_kind === "catalog"
    && entry.section_id === target.section_id
    && optionIds.has(entry.item_id)
  );
}

export function getCatalogOptionDisplay(
  state: AdminOperationalState,
  target: AvailabilityTargetState,
): { itemId: string; itemName: string; optionName: string } | undefined {
  for (const item of state.catalog_editor.items) {
    if (item.section_id !== target.section_id) {
      continue;
    }

    const optionPrefix = `${item.item_id}-`;

    if (!target.item_id.startsWith(optionPrefix)) {
      continue;
    }

    const optionId = target.item_id.slice(optionPrefix.length);
    const option = item.options.find((entry) => entry.option_id === optionId);

    if (option) {
      return { itemId: item.item_id, itemName: item.name, optionName: option.name };
    }
  }

  return undefined;
}

export function getEffectiveAvailability(
  state: AdminOperationalState,
  target: AvailabilityTargetState,
): boolean {
  return findOverlay(state, target)?.available_override ?? target.base_available;
}

export function shouldCatalogParentAppearAvailable(
  state: AdminOperationalState,
  target: AvailabilityTargetState,
): boolean {
  const optionTargets = findCatalogOptionAvailabilityTargets(state, target);

  if (optionTargets.length === 0) {
    return getEffectiveAvailability(state, target);
  }

  return getEffectiveAvailability(state, target)
    && optionTargets.some((optionTarget) => getEffectiveAvailability(state, optionTarget));
}

export function buildCatalogAvailabilityCascade(
  state: AdminOperationalState,
  target: AvailabilityTargetState,
  available: boolean,
): AvailabilityTargetState[] {
  const parentTarget = findCatalogParentAvailabilityTarget(state, target);

  if (parentTarget) {
    if (available) {
      return [target, parentTarget];
    }

    const siblingTargets = findCatalogOptionAvailabilityTargets(state, parentTarget);
    const allOptionsWillBeUnavailable = siblingTargets.every((optionTarget) =>
      getTargetKey(optionTarget) === getTargetKey(target)
        ? true
        : !getEffectiveAvailability(state, optionTarget)
    );

    return allOptionsWillBeUnavailable ? [target, parentTarget] : [target];
  }

  const optionTargets = findCatalogOptionAvailabilityTargets(state, target);

  if (optionTargets.length > 0) {
    return available ? [target, ...optionTargets] : [target, ...optionTargets];
  }

  return [target];
}

export function findAvailabilityFamilyTargets(
  state: AdminOperationalState,
  key: string,
): AvailabilityTargetState[] {
  return getVisibleAvailabilityTargets(state).filter((target) =>
    target.target_kind === "grill" && getAvailabilityFamilyKey(target) === key
  );
}

export function findCatalogItem(
  state: AdminOperationalState,
  sectionId: string,
  itemId: string,
): CatalogItemState | undefined {
  return state.catalog_editor.items.find((item) =>
    item.section_id === sectionId
    && item.item_id === itemId
  );
}

export function findCatalogItemOption(
  state: AdminOperationalState,
  sectionId: string,
  itemId: string,
  optionId: string,
): CatalogItemOptionState | undefined {
  return findCatalogItem(state, sectionId, itemId)?.options.find((option) => option.option_id === optionId);
}

export function findGrillItem(state: AdminOperationalState, itemId: string): GrillItemState | undefined {
  return state.grill_editor.items.find((item) => item.item_id === itemId);
}

export function findGrillFamily(state: AdminOperationalState, familyId: string): GrillFamilyState | undefined {
  return state.grill_editor.families.find((family) => family.family_id === familyId);
}

export function getEffectiveFixedSection(
  editor: CatalogEditorState,
  fixedSectionFilter: string,
): FixedMenuLocation | undefined {
  const locations = getFixedMenuLocations(editor.sections);

  return locations.find((section) => section.filter_id === fixedSectionFilter)
    ?? locations[0];
}

export function getFixedLocationItems(
  editor: CatalogEditorState,
  section: FixedMenuLocation,
): CatalogItemState[] {
  return editor.items.filter((item) =>
    item.section_id === section.section_id
    && (!section.item_ids || section.item_ids.includes(item.item_id))
  );
}
