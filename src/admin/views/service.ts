import { adminActions, adminForms } from "../core/contracts";
import { canDeleteFromList, isServiceSectionAvailable, regularDailyId, vegetarianDailyId } from "../core/rules";
import { disabledAttr, hiddenInput, renderEmpty } from "./html";
import { findDailyItem, findServiceKind } from "../core/selectors";
import { renderFixedPriceRows } from "./prices";
import type {
  AdminOperationalState,
  DailyMenuState,
  GrillFamilyState,
  GrillItemState,
  ServiceSectionId,
} from "../core/types";
import type { AdminViewState } from "../core/viewState";
import { escapeHtml, formatAmount } from "../core/format";

export function renderServiceTab(
  state: AdminOperationalState,
  viewState: AdminViewState,
  isBusy: boolean,
): string {
  const serviceEditor = state.permissions.can_edit_menu_content;

  return `
    <section class="admin-section admin-service">
      <div class="admin-section__header">
        <h2 class="admin-section__title">Servicio</h2>
        <p class="admin-section__copy">Elegí qué servicio muestra cada local y editá el menú del día o la parrilla operativa. El menú fijo queda separado como catálogo estable compartido.</p>
      </div>
      ${serviceEditor ? `
        ${renderServiceSectionNav(state, viewState)}
        ${renderActiveServiceSection(state, viewState, isBusy)}
      ` : ""}
      ${!serviceEditor ? renderEmpty("No hay acciones de servicio disponibles para este rol.") : ""}
    </section>
  `;
}

function renderServiceSectionNav(state: AdminOperationalState, viewState: AdminViewState): string {
  const allSections: Array<{ id: ServiceSectionId; label: string; copy: string }> = [
    {
      id: "active-service",
      label: "Servicio activo",
      copy: "Definí si cada local muestra menú del día o parrilla.",
    },
    {
      id: "daily-menu",
      label: "Menú del día",
      copy: "Edita platos y precios globales del servicio diario.",
    },
    {
      id: "grill",
      label: "Parrilla",
      copy: "Administrá productos, opciones y precios de parrilla.",
    },
  ];
  const sections = allSections.filter((section) => isServiceSectionAvailable(state, section.id));

  return `
    <div class="admin-service-switcher">
      ${sections.map((section) => `
        <button
          class="admin-service-switcher__button"
          type="button"
          data-admin-action="${adminActions.serviceSection}"
          data-admin-service-section="${section.id}"
          data-current="${viewState.activeServiceSection === section.id ? "true" : "false"}"
        >
          <span>${escapeHtml(section.label)}</span>
          <small>${escapeHtml(section.copy)}</small>
        </button>
      `).join("")}
    </div>
  `;
}

function renderActiveServiceSection(
  state: AdminOperationalState,
  viewState: AdminViewState,
  isBusy: boolean,
): string {
  if (viewState.activeServiceSection === "daily-menu") {
    return renderDailyMenuEditor(state, isBusy);
  }

  if (viewState.activeServiceSection === "grill") {
    return renderGrillEditor(state, isBusy);
  }

  return renderServiceModeForms(state, isBusy);
}

function renderDailyMenuEditor(state: AdminOperationalState, isBusy: boolean): string {
  const regular = findDailyItem(state, regularDailyId);
  const vegetarian = findDailyItem(state, vegetarianDailyId);
  const dailyPriceKeys = new Set(state.daily_menu.map((item) => item.pricing_key));
  const dailyPrices = state.prices.fixed.filter((price) => dailyPriceKeys.has(price.pricing_key));

  return `
    <section class="admin-daily-panel">
      <div class="admin-daily-panel__header">
        <h3 class="admin-daily-panel__title">Menú del día</h3>
        <p class="admin-row__meta">Editá los dos platos y sus precios globales. Se verán en el menú público después de publicar cambios.</p>
      </div>
      <form class="admin-form-grid admin-daily-form" data-admin-form="${adminForms.dailyMenu}">
        ${renderDailyFieldset("Menu regular", "regular", regular)}
        ${renderDailyFieldset("Menu vegetariano", "vegetarian", vegetarian)}
        <div class="admin-row admin-callout admin-daily-submit">
          <div class="admin-row__main">
            <p class="admin-row__title">Guardar platos</p>
            <p class="admin-row__meta">Actualizá las dos opciones visibles del servicio diario.</p>
          </div>
          <div class="admin-row__actions">
            <button class="admin-button" type="submit" ${disabledAttr(isBusy)}>Guardar menú del día</button>
          </div>
        </div>
      </form>
      ${renderFixedPriceRows(dailyPrices, "No hay precios del menú del día editables.", isBusy)}
    </section>
  `;
}

function renderGrillEditor(state: AdminOperationalState, isBusy: boolean): string {
  const editor = state.grill_editor;
  const families = editor.families;

  return `
    <section class="admin-daily-panel admin-grill-editor">
      <div class="admin-daily-panel__header">
        <h3 class="admin-daily-panel__title">Parrilla</h3>
        <p class="admin-row__meta">Administrá productos de parrilla y sus opciones de precio. El menú público se actualiza después de publicar cambios.</p>
      </div>
      ${renderGrillProductForm(isBusy)}
      ${families.length > 0
        ? families.map((family) => renderGrillProductEditor(state, family, isBusy)).join("")
        : renderEmpty("No hay productos de parrilla. Agrega el primero con el formulario.")}
    </section>
  `;
}

function renderGrillProductForm(isBusy: boolean): string {
  return `
    <form class="admin-card admin-fixed-form" data-admin-form="${adminForms.grillProduct}">
      <div class="admin-fixed-form__header">
        <h4 class="admin-card__legend">Agregar producto de parrilla</h4>
        <p class="admin-row__meta">Creá un producto nuevo con su primera opción y precio.</p>
      </div>
      <input type="hidden" name="family_id" data-grill-product-id />
      <input type="hidden" name="item_id" data-grill-id />
      <label class="admin-field">
        <span class="admin-label">Producto</span>
        <input class="admin-input" name="title" data-grill-product-name required />
      </label>
      <label class="admin-field">
        <span class="admin-label">Primera opción</span>
        <input class="admin-input" name="variant_name" data-grill-name required />
      </label>
      <label class="admin-field">
        <span class="admin-label">Precio</span>
        <input class="admin-input" type="number" name="amount" min="0" step="1" inputmode="numeric" required />
      </label>
      <div class="admin-row__actions admin-fixed-form__actions">
        <button class="admin-button" type="submit" ${disabledAttr(isBusy)}>Agregar producto</button>
      </div>
    </form>
  `;
}

function renderGrillProductEditor(
  state: AdminOperationalState,
  family: GrillFamilyState,
  isBusy: boolean,
): string {
  const items = state.grill_editor.items.filter((item) => item.family_id === family.family_id);

  return `
    <section class="admin-grill-family admin-grill-product">
      <form class="admin-fixed-edit-fields admin-grill-product-edit" data-admin-form="${adminForms.grillProductEdit}">
        ${hiddenInput("family_id", family.family_id)}
        <label class="admin-field">
          <span class="admin-grill-product-title">Producto</span>
          <input class="admin-input" name="title" value="${escapeHtml(family.title)}" required />
        </label>
        <div class="admin-row__actions admin-fixed-edit-actions">
          <button class="admin-button" type="submit" ${disabledAttr(isBusy)}>Guardar producto</button>
        </div>
      </form>
      <div class="admin-grid">
        ${items.length > 0
          ? items.map((item) => renderGrillOptionRow(item, canDeleteFromList(items.length), isBusy)).join("")
          : renderEmpty("No hay opciones en este producto. Agregá la primera con el formulario.")}
      </div>
      ${renderGrillOptionForm(family, isBusy)}
      <div class="admin-row__actions">
        <button
          class="admin-button admin-button--danger"
          type="button"
          data-admin-action="${adminActions.deleteGrillProduct}"
          data-family-id="${escapeHtml(family.family_id)}"
          ${disabledAttr(isBusy)}
        >
          Eliminar producto
        </button>
        <span class="admin-row__state-note admin-fixed-delete-note">Eliminá el producto completo y todas sus opciones después de publicar.</span>
      </div>
    </section>
  `;
}

function renderGrillOptionForm(family: GrillFamilyState, isBusy: boolean): string {
  return `
    <form class="admin-card admin-fixed-form admin-grill-option-add" data-admin-form="${adminForms.grillItem}">
      <div class="admin-fixed-form__header">
        <h4 class="admin-card__legend">Agregar opción</h4>
        <p class="admin-row__meta">Se agrega al final de ${escapeHtml(family.title)}.</p>
      </div>
      ${hiddenInput("family_id", family.family_id)}
      ${hiddenInput("product_name", family.title)}
      <input type="hidden" name="item_id" data-grill-id />
      <label class="admin-field">
        <span class="admin-label">Opción</span>
        <input class="admin-input" name="variant_name" data-grill-name required />
      </label>
      <label class="admin-field">
        <span class="admin-label">Precio</span>
        <input class="admin-input" type="number" name="amount" min="0" step="1" inputmode="numeric" required />
      </label>
      <div class="admin-row__actions admin-fixed-form__actions">
        <button class="admin-button" type="submit" ${disabledAttr(isBusy)}>Agregar opción</button>
      </div>
    </form>
  `;
}

function renderGrillOptionRow(item: GrillItemState, canDelete: boolean, isBusy: boolean): string {
  const priceText = item.price_amount === null ? "Precio configurado" : formatAmount(item.price_amount);
  const optionName = item.variant_name ?? item.name;

  return `
    <div class="admin-row admin-fixed-row admin-grill-option-row">
      <form class="admin-grill-option-edit" data-admin-form="${adminForms.grillItemEdit}">
        ${hiddenInput("item_id", item.item_id)}
        ${hiddenInput("fixed_pricing_key", item.pricing_key)}
        <div class="admin-row__main">
          <p class="admin-row__title">${escapeHtml(item.family_title)}</p>
          <div class="admin-price-tags">
            <span class="admin-price-tag">${escapeHtml(priceText)}</span>
          </div>
        </div>
        <label class="admin-field">
          <span class="admin-label">Opción</span>
          <input class="admin-input" name="variant_name" value="${escapeHtml(optionName)}" required />
        </label>
        <label class="admin-field admin-price-field">
          <span class="admin-label">Importe</span>
          <input class="admin-input" type="number" name="fixed_price_amount" min="0" step="1" inputmode="numeric" value="${item.price_amount ?? 0}" required />
        </label>
        <div class="admin-row__actions admin-grill-option-actions">
          <button class="admin-button" type="submit" ${disabledAttr(isBusy)}>Guardar</button>
        </div>
      </form>
      <div class="admin-row__actions admin-grill-option-delete">
        <button
          class="admin-button admin-button--danger"
          type="button"
          data-admin-action="${adminActions.deleteGrillItem}"
          data-item-id="${escapeHtml(item.item_id)}"
          ${disabledAttr(isBusy || !canDelete)}
        >
          Eliminar
        </button>
        <span class="admin-row__state-note admin-fixed-delete-note">${canDelete ? "Se quitará del menú público después de publicar." : "Debe quedar al menos una opción. Para quitar todo, eliminá el producto."}</span>
      </div>
    </div>
  `;
}

function renderServiceModeForms(state: AdminOperationalState, isBusy: boolean): string {
  if (state.profiles.length === 0) {
    return `
      <section class="admin-daily-panel">
        <div class="admin-daily-panel__header">
          <h3 class="admin-daily-panel__title">Servicio activo por local</h3>
          <p class="admin-row__meta">Cambiar entre menú del día y parrilla se verá en el menú público después de publicar.</p>
        </div>
        ${renderEmpty("No hay locales para configurar.")}
      </section>
    `;
  }

  return `
    <section class="admin-daily-panel">
      <div class="admin-daily-panel__header">
        <h3 class="admin-daily-panel__title">Servicio activo por local</h3>
        <p class="admin-row__meta">Elegir el servicio activo cambia qué ve cada local. Se verá en el menú público después de publicar.</p>
      </div>
      <div class="admin-grid">
        ${state.profiles.map((profile) => {
          const currentService = findServiceKind(state, profile.id);
          const serviceLabel = currentService === "daily-menu" ? "Menú del día activo" : "Parrilla activa";

          return `
            <form class="admin-row admin-daily-service-row" data-admin-form="${adminForms.serviceKind}" data-current-service="${currentService}" data-profile-title="${escapeHtml(profile.title)}">
              <div class="admin-row__main">
                <p class="admin-row__title">${escapeHtml(profile.title)}</p>
                <div class="admin-row__status">
                  <span class="admin-pill" data-tone="${currentService === "daily-menu" ? "success" : "neutral"}">${escapeHtml(serviceLabel)}</span>
                  <span class="admin-row__state-note">Se verá después de publicar si cambia.</span>
                </div>
              </div>
              <div class="admin-row__actions">
                ${hiddenInput("profile_id", profile.id)}
                <select class="admin-select" name="service_kind" aria-label="Servicio activo para ${escapeHtml(profile.title)}">
                  <option value="daily-menu" ${currentService === "daily-menu" ? "selected" : ""}>Menú del día</option>
                  <option value="grill" ${currentService === "grill" ? "selected" : ""}>Parrilla</option>
                </select>
                <button class="admin-button" type="submit" ${disabledAttr(isBusy)}>Guardar</button>
              </div>
            </form>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderDailyFieldset(
  label: string,
  prefix: "regular" | "vegetarian",
  item: DailyMenuState | undefined,
): string {
  const fieldLabel = prefix === "regular" ? "menú regular" : "menú vegetariano";

  return `
    <fieldset class="admin-card admin-daily-card">
      <legend class="admin-card__legend">${escapeHtml(label)}</legend>
      <label class="admin-field">
        <span class="admin-label">Nombre del ${fieldLabel}</span>
        <input class="admin-input" name="${prefix}_name" value="${escapeHtml(item?.name ?? "")}" required />
      </label>
      <label class="admin-field admin-field--wide">
        <span class="admin-label">Descripción del ${fieldLabel}</span>
        <textarea class="admin-textarea" name="${prefix}_description">${escapeHtml(item?.description ?? "")}</textarea>
      </label>
    </fieldset>
  `;
}
