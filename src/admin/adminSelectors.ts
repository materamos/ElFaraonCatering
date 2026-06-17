import type {
  AdminOperationalState,
  AvailabilityOverlayState,
  AvailabilityTargetState,
  CatalogEditorState,
  CatalogItemOptionState,
  CatalogItemState,
  CatalogSectionState,
  DailyMenuState,
  GrillFamilyState,
  GrillItemState,
  ProfileState,
  ServiceKind,
} from "./adminTypes";
import { getOverlayKey, getTargetKey } from "./adminUtils";
import { getFixedOptionsOnlyRule } from "./adminRules";

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

export function getEditableAvailabilityProfiles(state: AdminOperationalState): ProfileState[] {
  return state.profiles.filter((profile) => profile.can_edit_availability);
}

export function getEffectiveAvailabilityProfileFilter(
  state: AdminOperationalState,
  profileFilter: string,
): string {
  const editableProfiles = getEditableAvailabilityProfiles(state);

  if (editableProfiles.some((profile) => profile.id === profileFilter)) {
    return profileFilter;
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
  return state.availability_targets.find((target) => getTargetKey(target) === key);
}

export function findAvailabilityFamilyTargets(
  state: AdminOperationalState,
  key: string,
): AvailabilityTargetState[] {
  return state.availability_targets.filter((target) =>
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
): CatalogSectionState | undefined {
  return editor.sections.find((section) => section.section_id === fixedSectionFilter)
    ?? editor.sections[0];
}

export function getFixedLocationItems(
  editor: CatalogEditorState,
  section: CatalogSectionState,
): CatalogItemState[] {
  const optionsOnlyRule = getFixedOptionsOnlyRule(section.section_id);

  return editor.items.filter((item) =>
    item.section_id === section.section_id
    && (!optionsOnlyRule || optionsOnlyRule.itemIds.includes(item.item_id))
  );
}
