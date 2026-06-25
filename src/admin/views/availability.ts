import { adminActions } from "../core/contracts";
import { disabledAttr, renderEmpty } from "./html";
import type {
  AdminOperationalState,
  AvailabilityOverlayState,
  AvailabilityTargetState,
} from "../core/types";
import type { AdminViewState } from "../core/viewState";
import {
  findOverlay,
  getAvailabilityFamilyKey,
  getAvailabilityGroupKey,
  getAvailabilityGroupOptions,
  getEffectiveAvailabilityGroupFilter,
  getEffectiveAvailabilityProfileFilter,
  getEditableAvailabilityProfiles,
  getHiddenAvailabilityTargets,
  getVisibleAvailabilityTargets,
} from "../core/selectors";
import { getTargetKey } from "../core/adminState";
import { escapeHtml } from "../core/format";

export function renderAvailabilityTab(
  state: AdminOperationalState,
  viewState: AdminViewState,
  isBusy: boolean,
): string {
  return `
    <section class="admin-section">
      <div class="admin-section__header">
        <h2 class="admin-section__title">Disponibilidad</h2>
        <p class="admin-section__copy">Ocultá o volvé a mostrar items visibles. El servicio muestra solo menú del día o parrilla según cada local; menú fijo queda separado.</p>
      </div>
      ${renderHiddenAvailabilitySummary(state, viewState, isBusy)}
      ${renderAvailabilityFilters(state, viewState)}
      ${renderAvailabilityRows(state, viewState, isBusy)}
    </section>
  `;
}

function renderHiddenAvailabilitySummary(
  state: AdminOperationalState,
  viewState: AdminViewState,
  isBusy: boolean,
): string {
  const hiddenTargets = getHiddenAvailabilityTargets(state);

  if (hiddenTargets.length === 0) {
    return `
      <section class="admin-availability-group admin-availability-summary">
        <div class="admin-list-header">
          <span>Items ocultos</span>
          <span>0 items</span>
        </div>
        ${renderEmpty("No hay items ocultos.")}
      </section>
    `;
  }

  const profileGroups = groupAvailabilityTargetsByProfile(state, hiddenTargets);
  const selectedProfileId = getEffectiveHiddenAvailabilityProfileFilter(state, viewState.hiddenAvailabilityProfileFilter);
  const selectedGroup = profileGroups.find((group) => group.menuId === selectedProfileId) ?? profileGroups[0];

  return `
    <section class="admin-availability-group admin-availability-summary">
      <div class="admin-list-header admin-availability-summary__header">
        <span>Items ocultos</span>
        <span class="admin-availability-summary__filters">
          ${profileGroups.map((group) => renderHiddenAvailabilityProfileFilter(group, selectedProfileId)).join("")}
        </span>
      </div>
      <div class="admin-availability-chip-list">
        ${selectedGroup && selectedGroup.targets.length > 0
          ? renderHiddenAvailabilityProfileChips(state, selectedGroup, isBusy)
          : renderEmpty("No hay items ocultos para este menu.")}
      </div>
    </section>
  `;
}

function getEffectiveHiddenAvailabilityProfileFilter(state: AdminOperationalState, profileFilter: string): string {
  const editableProfiles = getEditableAvailabilityProfiles(state);

  if (editableProfiles.some((profile) => profile.id === profileFilter)) {
    return profileFilter;
  }

  return editableProfiles[0]?.id ?? "";
}

function renderHiddenAvailabilityProfileFilter(
  group: { menuId: string; profileTitle: string; targets: AvailabilityTargetState[] },
  selectedProfileId: string,
): string {
  const isSelected = group.menuId === selectedProfileId;

  return `
    <button class="admin-availability-summary__filter" type="button" data-current="${isSelected ? "true" : "false"}" data-admin-action="${adminActions.hiddenAvailabilityProfile}" data-admin-hidden-availability-profile="${escapeHtml(group.menuId)}">
      ${escapeHtml(group.profileTitle)}: ${group.targets.length}
    </button>
  `;
}

function groupAvailabilityTargetsByProfile(
  state: AdminOperationalState,
  targets: AvailabilityTargetState[],
): Array<{ menuId: string; profileTitle: string; targets: AvailabilityTargetState[] }> {
  return getEditableAvailabilityProfiles(state).map((profile) => ({
    menuId: profile.id,
    profileTitle: profile.title,
    targets: targets.filter((target) => target.menu_id === profile.id),
  }));
}

function renderHiddenAvailabilityProfileChips(
  state: AdminOperationalState,
  group: { profileTitle: string; targets: AvailabilityTargetState[] },
  isBusy: boolean,
): string {
  const serviceTargets = group.targets.filter((target) => target.target_kind !== "catalog");
  const catalogTargets = group.targets.filter((target) => target.target_kind === "catalog");
  const chips = [
    ...buildHiddenServiceChips(state, serviceTargets, isBusy),
    ...catalogTargets.map((target) => renderCatalogAvailabilityChip(state, target, isBusy)),
  ];

  return `
    ${chips.join("")}
  `;
}

function buildHiddenServiceChips(
  state: AdminOperationalState,
  hiddenTargets: AvailabilityTargetState[],
  isBusy: boolean,
): string[] {
  const chips: string[] = [];
  const grillFamilyMap = new Map<string, AvailabilityTargetState[]>();

  for (const target of hiddenTargets) {
    if (target.target_kind !== "grill") {
      chips.push(renderAvailabilityChip(target, isBusy));
      continue;
    }

    const familyKey = getAvailabilityFamilyKey(target);
    const familyTargets = grillFamilyMap.get(familyKey) ?? [];
    familyTargets.push(target);
    grillFamilyMap.set(familyKey, familyTargets);
  }

  const visibleTargets = getVisibleAvailabilityTargets(state);

  for (const familyKey of grillFamilyMap.keys()) {
    const visibleFamilyTargets = visibleTargets.filter((target) =>
      target.target_kind === "grill" && getAvailabilityFamilyKey(target) === familyKey
    );

    if (visibleFamilyTargets.length > 0) {
      chips.push(renderAvailabilityFamilyChip(visibleFamilyTargets, isBusy));
    }
  }

  return chips;
}

function renderAvailabilityFilters(state: AdminOperationalState, viewState: AdminViewState): string {
  const profileFilter = getEffectiveAvailabilityProfileFilter(state, viewState.availabilityProfileFilter);
  const profileOptions = getEditableAvailabilityProfiles(state);
  const profileTargets = getVisibleAvailabilityTargets(state).filter((target) => target.menu_id === profileFilter);
  const groupOptions = getAvailabilityGroupOptions(profileTargets);
  const groupFilter = getEffectiveAvailabilityGroupFilter(groupOptions, viewState.availabilityGroupFilter);

  return `
    <div class="admin-toolbar">
      <label class="admin-field">
        <span class="admin-label">Local</span>
        <select class="admin-select" data-admin-filter="availability-profile">
          ${profileOptions
            .map((profile) => `<option value="${escapeHtml(profile.id)}" ${profileFilter === profile.id ? "selected" : ""}>${escapeHtml(profile.title)}</option>`)
            .join("")}
        </select>
      </label>
      <label class="admin-field">
        <span class="admin-label">Familia / grupo</span>
        <select class="admin-select" data-admin-filter="availability-group">
          ${groupOptions
            .map((option) => `<option value="${escapeHtml(option.key)}" ${groupFilter === option.key ? "selected" : ""}>${escapeHtml(option.label)}</option>`)
            .join("")}
        </select>
      </label>
    </div>
  `;
}

function renderAvailabilityRows(
  state: AdminOperationalState,
  viewState: AdminViewState,
  isBusy: boolean,
): string {
  const profileFilter = getEffectiveAvailabilityProfileFilter(state, viewState.availabilityProfileFilter);
  const profileTargets = getVisibleAvailabilityTargets(state).filter((target) => target.menu_id === profileFilter);
  const groupFilter = getEffectiveAvailabilityGroupFilter(
    getAvailabilityGroupOptions(profileTargets),
    viewState.availabilityGroupFilter,
  );
  const targets = profileTargets.filter((target) => !groupFilter || getAvailabilityGroupKey(target) === groupFilter);
  const serviceTargets = targets.filter((target) => target.target_kind !== "catalog");
  const catalogTargets = targets.filter((target) => target.target_kind === "catalog");

  if (targets.length === 0) {
    return renderEmpty(
      getVisibleAvailabilityTargets(state).length > 0
        ? "No hay items para los filtros seleccionados."
        : "No hay items disponibles para este rol.",
    );
  }

  return `
    ${renderAvailabilityTargetSection(state, "Servicio activo", serviceTargets, isBusy, { collapseGrillFamilies: true })}
    ${renderAvailabilityTargetSection(state, "Menú fijo", catalogTargets, isBusy, { groupCatalogOptions: true })}
  `;
}

function renderAvailabilityTargetSection(
  state: AdminOperationalState,
  title: string,
  targets: AvailabilityTargetState[],
  isBusy: boolean,
  options: { collapseGrillFamilies?: boolean; groupCatalogOptions?: boolean } = {},
): string {
  const rows = options.collapseGrillFamilies
    ? buildAvailabilityRows(state, targets, isBusy)
    : options.groupCatalogOptions
      ? targets.map((target) => renderCatalogAvailabilityRow(state, target, isBusy))
      : targets.map((target) => renderAvailabilityRow(state, target, isBusy));

  if (rows.length === 0) {
    return "";
  }

  return `
    <section class="admin-availability-group">
      <div class="admin-list-header">
        <span>${escapeHtml(title)}</span>
        <span>${rows.length} items &middot; cambios instantaneos</span>
      </div>
      <div class="admin-grid">${rows.join("")}</div>
    </section>
  `;
}

function buildAvailabilityRows(
  state: AdminOperationalState,
  targets: AvailabilityTargetState[],
  isBusy: boolean,
): string[] {
  const rows: string[] = [];
  const grillFamilyMap = new Map<string, AvailabilityTargetState[]>();

  for (const target of targets) {
    if (target.target_kind !== "grill") {
      rows.push(renderAvailabilityRow(state, target, isBusy));
      continue;
    }

    const familyKey = getAvailabilityFamilyKey(target);
    const familyTargets = grillFamilyMap.get(familyKey) ?? [];
    familyTargets.push(target);
    grillFamilyMap.set(familyKey, familyTargets);
  }

  for (const familyTargets of grillFamilyMap.values()) {
    rows.push(renderAvailabilityFamilyRow(state, familyTargets, isBusy));
  }

  return rows;
}

function renderCatalogAvailabilityRow(
  state: AdminOperationalState,
  target: AvailabilityTargetState,
  isBusy: boolean,
): string {
  const optionDisplay = getCatalogOptionDisplay(state, target);

  if (!optionDisplay) {
    return renderAvailabilityRow(state, target, isBusy);
  }

  return renderAvailabilityRow(state, target, isBusy, {
    displayName: optionDisplay.optionName,
    rowClass: "admin-row--nested",
  });
}

function renderCatalogAvailabilityChip(
  state: AdminOperationalState,
  target: AvailabilityTargetState,
  isBusy: boolean,
): string {
  const optionDisplay = getCatalogOptionDisplay(state, target);

  return renderAvailabilityChip(target, isBusy, {
    displayName: optionDisplay?.optionName,
  });
}

function getCatalogOptionDisplay(
  state: AdminOperationalState,
  target: AvailabilityTargetState,
): { itemName: string; optionName: string } | undefined {
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
      return { itemName: item.name, optionName: option.name };
    }
  }

  return undefined;
}

function renderAvailabilityChip(
  target: AvailabilityTargetState,
  isBusy: boolean,
  options: { displayName?: string } = {},
): string {
  return `
    <span class="admin-availability-chip">
      <span class="admin-availability-chip__name">${escapeHtml(options.displayName ?? target.name)}</span>
      <button class="admin-availability-chip__action" type="button" data-admin-action="${adminActions.setOverlay}" data-target-key="${escapeHtml(getTargetKey(target))}" data-available="true" ${disabledAttr(isBusy)}>
        Mostrar
      </button>
    </span>
  `;
}

function renderAvailabilityFamilyChip(
  familyTargets: AvailabilityTargetState[],
  isBusy: boolean,
): string {
  const familyTarget = familyTargets[0];

  return `
    <span class="admin-availability-chip">
      <span class="admin-availability-chip__name">${escapeHtml(familyTarget.group_title ?? familyTarget.name)}</span>
      <button class="admin-availability-chip__action" type="button" data-admin-action="${adminActions.setOverlay}" data-family-key="${escapeHtml(getAvailabilityFamilyKey(familyTarget))}" data-available="true" ${disabledAttr(isBusy)}>
        Mostrar
      </button>
    </span>
  `;
}

function renderAvailabilityRow(
  state: AdminOperationalState,
  target: AvailabilityTargetState,
  isBusy: boolean,
  options: { displayName?: string; rowClass?: string } = {},
): string {
  const overlay = findOverlay(state, target);
  const effectiveAvailable = overlay ? overlay.available_override : target.base_available;
  const key = getTargetKey(target);

  return `
    <div class="admin-row${options.rowClass ? ` ${escapeHtml(options.rowClass)}` : ""}">
      <div class="admin-row__main">
        <p class="admin-row__title">${escapeHtml(options.displayName ?? target.name)} <span class="admin-row__title-meta">- ${escapeHtml(target.profile_title)}</span></p>
        <div class="admin-row__status">
          ${renderAvailabilityStatus(effectiveAvailable)}
        </div>
      </div>
      ${renderAvailabilityActions(key, effectiveAvailable, overlay, isBusy)}
    </div>
  `;
}

function renderAvailabilityFamilyRow(
  state: AdminOperationalState,
  familyTargets: AvailabilityTargetState[],
  isBusy: boolean,
): string {
  const familyTarget = familyTargets[0];
  const effectiveAvailable = familyTargets.every((target) => {
    const overlay = findOverlay(state, target);
    return overlay ? overlay.available_override : target.base_available;
  });
  const hasOverlay = familyTargets.some((target) => Boolean(findOverlay(state, target)));

  return `
    <div class="admin-row">
      <div class="admin-row__main">
        <p class="admin-row__title">${escapeHtml(familyTarget.group_title ?? familyTarget.name)} <span class="admin-row__title-meta">- ${escapeHtml(familyTarget.profile_title)}</span></p>
        <div class="admin-row__status">
          ${renderAvailabilityStatus(effectiveAvailable)}
        </div>
      </div>
      ${renderAvailabilityActions(getAvailabilityFamilyKey(familyTarget), effectiveAvailable, hasOverlay, isBusy, "family")}
    </div>
  `;
}

function renderAvailabilityStatus(effectiveAvailable: boolean): string {
  return `
    <span class="admin-pill" data-tone="${effectiveAvailable ? "success" : "danger"}">
      ${effectiveAvailable ? "Se muestra en el menú" : "Oculto en el menú"}
    </span>
  `;
}

function renderAvailabilityActions(
  key: string,
  effectiveAvailable: boolean,
  overlay: AvailabilityOverlayState | boolean | undefined,
  isBusy: boolean,
  keyKind: "target" | "family" = "target",
): string {
  const keyAttribute = keyKind === "family" ? "data-family-key" : "data-target-key";
  const hasOverlay = Boolean(overlay);
  const mainButton = effectiveAvailable
    ? `
      <button class="admin-button admin-button--danger" type="button" data-admin-action="${adminActions.setOverlay}" ${keyAttribute}="${escapeHtml(key)}" data-available="false" ${disabledAttr(isBusy)}>
        Ocultar ahora
      </button>
    `
    : `
      <button class="admin-button admin-button--secondary" type="button" data-admin-action="${adminActions.setOverlay}" ${keyAttribute}="${escapeHtml(key)}" data-available="true" ${disabledAttr(isBusy)}>
        Volver a mostrar
      </button>
    `;

  const clearButton = hasOverlay && effectiveAvailable
    ? `
      <button class="admin-button admin-button--secondary" type="button" data-admin-action="${adminActions.clearOverlay}" ${keyAttribute}="${escapeHtml(key)}" ${disabledAttr(isBusy)}>
        Quitar ajuste
      </button>
    `
    : "";

  return `
    <div class="admin-row__actions admin-row__actions--availability">
      ${mainButton}
      ${clearButton}
    </div>
  `;
}
