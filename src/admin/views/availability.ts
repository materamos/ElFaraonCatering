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
  getVisibleAvailabilityTargets,
} from "../core/selectors";
import { escapeHtml, getTargetKey } from "../core/utils";

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
      ${renderAvailabilityFilters(state, viewState)}
      ${renderAvailabilityRows(state, viewState, isBusy)}
    </section>
  `;
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
    ${renderAvailabilityTargetSection(state, "Menú fijo", catalogTargets, isBusy)}
  `;
}

function renderAvailabilityTargetSection(
  state: AdminOperationalState,
  title: string,
  targets: AvailabilityTargetState[],
  isBusy: boolean,
  options: { collapseGrillFamilies?: boolean } = {},
): string {
  const rows = options.collapseGrillFamilies
    ? buildAvailabilityRows(state, targets, isBusy)
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

function renderAvailabilityRow(
  state: AdminOperationalState,
  target: AvailabilityTargetState,
  isBusy: boolean,
): string {
  const overlay = findOverlay(state, target);
  const effectiveAvailable = overlay ? overlay.available_override : target.base_available;
  const key = getTargetKey(target);

  return `
    <div class="admin-row">
      <div class="admin-row__main">
        <p class="admin-row__title">${escapeHtml(target.name)}</p>
        <p class="admin-row__meta">
          ${escapeHtml(formatAvailabilityKindLabel(target))} &middot; ${escapeHtml(target.profile_title)} &middot; ${escapeHtml(target.section_title)}
          ${target.group_title ? ` &middot; ${escapeHtml(target.group_title)}` : ""}
        </p>
        ${target.description ? `<p class="admin-row__meta">${escapeHtml(target.description)}</p>` : ""}
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
        <p class="admin-row__title">${escapeHtml(familyTarget.group_title ?? familyTarget.name)}</p>
        <p class="admin-row__meta">
          ${escapeHtml(formatAvailabilityKindLabel(familyTarget))} &middot; ${escapeHtml(familyTarget.profile_title)} &middot; ${escapeHtml(familyTarget.section_title)}
        </p>
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

function formatAvailabilityKindLabel(target: AvailabilityTargetState): string {
  if (target.target_kind === "daily-menu") {
    return "Menú del día";
  }

  if (target.target_kind === "grill") {
    return "Parrilla";
  }

  return "Menú fijo";
}
