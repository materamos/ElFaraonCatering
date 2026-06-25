import { adminActions, adminForms } from "../core/contracts";
import {
  canDeleteFromList,
  catalogItemFormRequiresPrice,
  getFixedMenuEditMode,
  getFixedMenuLocations,
  getFixedSectionAdminTitle,
  isIncludedSideOptionItem,
  type FixedMenuLocation,
} from "../core/rules";
import { disabledAttr, hiddenInput, renderEmpty } from "./html";
import {
  getEffectiveFixedSection,
  getFixedLocationItems,
} from "../core/selectors";
import type {
  AdminOperationalState,
  CatalogItemOptionState,
  CatalogItemState,
  FixedMenuEditMode,
} from "../core/types";
import type { AdminViewState } from "../core/viewState";
import { escapeHtml, formatCatalogItemPrice } from "../core/format";
import { renderFixedPriceRow, renderVariantPriceRow } from "./prices";

export function renderFixedMenuTab(
  state: AdminOperationalState,
  viewState: AdminViewState,
  isBusy: boolean,
): string {
  const editor = state.catalog_editor;
  const section = getEffectiveFixedSection(editor, viewState.fixedSectionFilter);

  if (!state.permissions.can_edit_menu_content) {
    return `
      <section class="admin-section">
        <div class="admin-section__header">
          <h2 class="admin-section__title">Menú fijo</h2>
        <p class="admin-section__copy">Tu usuario no tiene permiso para editar items del menú fijo.</p>
        </div>
      </section>
    `;
  }

  if (!section) {
    return `
      <section class="admin-section">
        <div class="admin-section__header">
          <h2 class="admin-section__title">Menú fijo</h2>
          <p class="admin-section__copy">Administrá el catálogo estable compartido. Para crear secciones o cambiar el orden, avisale a quien administra el sitio.</p>
        </div>
        ${renderEmpty("No hay secciones del menú fijo disponibles.")}
      </section>
    `;
  }

  const items = getFixedLocationItems(editor, section);
  const editMode = getFixedMenuEditMode(section);
  const fixedLocations = getFixedMenuLocations(editor.sections);
  const sectionCopy = editMode === "options-only"
    ? "Administrá solo sabores de esta subcategoría. No se pueden agregar, editar ni eliminar items desde esta pantalla."
    : "Agregá, editá nombre/descripción o eliminá items puntuales del catálogo estable. Los cambios quedan guardados, pero el menú público se actualiza después de publicar.";

  return `
    <section class="admin-section admin-fixed">
      <div class="admin-section__header">
        <h2 class="admin-section__title">Menú fijo</h2>
        <p class="admin-section__copy">Administrá el catálogo estable compartido. ${escapeHtml(sectionCopy)}</p>
      </div>
      ${editMode === "items" ? `<div class="admin-row admin-callout admin-fixed-guide">
        <div class="admin-row__main">
          <p class="admin-row__title">Cómo usar esta pantalla</p>
          <p class="admin-row__meta">Elegí la ubicación, completá el nombre visible y agregá el item.</p>
        </div>
      </div>` : ""}
      <div class="admin-toolbar admin-fixed-toolbar">
        <label class="admin-field">
          <span class="admin-label">Sección</span>
          <select class="admin-select" data-admin-filter="fixed-section">
            ${fixedLocations
              .map((entry) => `<option value="${escapeHtml(entry.filter_id)}" ${entry.filter_id === section.filter_id ? "selected" : ""}>${escapeHtml(getFixedSectionAdminTitle(entry))}</option>`)
              .join("")}
          </select>
        </label>
      </div>
      ${editMode === "options-only" ? "" : renderCatalogItemForm(section, isBusy)}
      ${renderCatalogItemList(state, items, editMode, isBusy)}
    </section>
  `;
}

function renderCatalogItemForm(section: FixedMenuLocation, isBusy: boolean): string {
  const requiresPrice = catalogItemFormRequiresPrice(section);

  return `
    <form class="admin-card admin-fixed-form" data-admin-form="${adminForms.catalogItem}">
      <div class="admin-fixed-form__header">
        <h3 class="admin-card__legend">Agregar item nuevo</h3>
        <p class="admin-row__meta">Se agrega al final de ${escapeHtml(section.title)}. Para cambiar el orden, avisale a quien administra el sitio.</p>
      </div>
      ${hiddenInput("section_id", section.section_id)}
      <input type="hidden" name="item_id" data-catalog-id />
      <label class="admin-field">
        <span class="admin-label">Nombre visible</span>
        <input class="admin-input" name="name" data-catalog-name required />
        <span class="admin-help">Es el nombre que va a leer el cliente en el menú.</span>
      </label>
      ${requiresPrice ? `
        <label class="admin-field">
          <span class="admin-label">Precio</span>
          <input class="admin-input" type="number" name="amount" min="0" step="1" inputmode="numeric" required />
          <span class="admin-help">Usá números sin símbolo de peso.</span>
        </label>
      ` : ""}
        ${renderCatalogDescriptionField({
          fieldName: "description",
          description: null,
          helpText: "Texto corto debajo del nombre. Incluí aclaraciones acá si hacen falta.",
        })}
      <div class="admin-row__actions admin-fixed-form__actions">
        <button class="admin-button" type="submit" ${disabledAttr(isBusy)}>Agregar al menú fijo</button>
      </div>
    </form>
  `;
}

function renderCatalogItemList(
  state: AdminOperationalState,
  items: CatalogItemState[],
  editMode: FixedMenuEditMode,
  isBusy: boolean,
): string {
  if (items.length === 0) {
    return renderEmpty(editMode === "options-only"
      ? "No hay subcategorías con sabores editables en esta ubicación."
      : "No hay items en esta ubicación. Agregá el primero con el formulario de arriba.");
  }

  return `
    <div class="admin-list-header">
      <span>${items.length} ${editMode === "options-only" ? "subcategorías" : "items"}</span>
      <span>${editMode === "options-only" ? "Agregar, editar o eliminar sabores requiere publicar cambios." : "Editar o eliminar requiere publicar cambios."}</span>
    </div>
    <div class="admin-grid">
      ${items.map((item) => renderCatalogItemRow(state, item, canDeleteFromList(items.length), editMode, isBusy)).join("")}
    </div>
  `;
}

function renderCatalogItemRow(
  state: AdminOperationalState,
  item: CatalogItemState,
  canDelete: boolean,
  editMode: FixedMenuEditMode,
  isBusy: boolean,
): string {
  const showPriceChip = !catalogItemShowsCurrentPriceRows(state, item, editMode);
  const priceText = showPriceChip ? formatCatalogItemPrice(item) : "";
  const deleteHelp = canDelete
    ? "Se quitará del menú público después de publicar."
    : "No se puede eliminar porque debe quedar al menos un item en esta ubicación.";
  const editDescriptionField = renderCatalogDescriptionField({
    fieldName: "description",
    description: item.description,
    compact: true,
  });

  return `
    <div class="admin-row admin-fixed-row">
      <div class="admin-row__main">
        <p class="admin-row__title">${escapeHtml(item.name)}</p>
        ${showPriceChip ? `<div class="admin-price-tags">
          <span class="admin-price-tag">${escapeHtml(priceText)}</span>
        </div>` : ""}
        ${editMode === "items" ? `<form class="admin-fixed-edit-fields" data-admin-form="${adminForms.catalogItemEdit}">
          ${hiddenInput("section_id", item.section_id)}
          ${hiddenInput("item_id", item.item_id)}
          <label class="admin-field">
            <span class="admin-label">Nombre</span>
            <input class="admin-input" name="name" value="${escapeHtml(item.name)}" required />
          </label>
          ${isIncludedSideOptionItem(item) ? "" : renderCatalogItemIntegratedPriceFields(state, item)}
            ${editDescriptionField}
            <div class="admin-row__actions admin-fixed-edit-actions">
              <button class="admin-button" type="submit" ${disabledAttr(isBusy)}>
                Guardar
              </button>
            </div>
        </form>` : ""}
        ${editMode === "items" || isIncludedSideOptionItem(item) ? "" : renderCatalogItemPriceEditor(state, item, isBusy)}
        ${renderCatalogItemOptions(item, isBusy)}
      </div>
      ${editMode === "items" ? `<div class="admin-row__actions">
        <button
          class="admin-button admin-button--danger"
          type="button"
          data-admin-action="${adminActions.deleteCatalogItem}"
          data-section-id="${escapeHtml(item.section_id)}"
          data-item-id="${escapeHtml(item.item_id)}"
          ${disabledAttr(isBusy || !canDelete)}
        >
          Eliminar
        </button>
        <span class="admin-row__state-note admin-fixed-delete-note">${escapeHtml(deleteHelp)}</span>
      </div>` : ""}
    </div>
  `;
}

function catalogItemShowsCurrentPriceRows(
  state: AdminOperationalState,
  item: CatalogItemState,
  editMode: FixedMenuEditMode,
): boolean {
  if (editMode === "items" || isIncludedSideOptionItem(item) || !item.pricing_key) {
    return false;
  }

  return state.prices.fixed.some((price) => price.pricing_key === item.pricing_key)
    || state.prices.variants.some((variant) => variant.pricing_key === item.pricing_key);
}

function renderCatalogDescriptionField(input: {
  fieldName: string;
  description: string | null;
  helpText?: string;
  compact?: boolean;
}): string {
  const hasDescription = Boolean(input.description?.trim());
  const textareaClass = input.compact
    ? "admin-textarea admin-textarea--compact"
    : "admin-textarea admin-textarea--short";

  return `
    <div class="admin-field admin-field--wide admin-description-field${hasDescription ? "" : " admin-description-field--hidden"}">
      <div class="admin-description-field__header">
        <span class="admin-label">Descripción</span>
        <label class="admin-description-toggle">
          <input
            class="admin-description-toggle__input"
            type="checkbox"
            data-admin-description-toggle
            ${hasDescription ? "checked" : ""}
          />
          <span class="admin-description-toggle__text">Mostrar descripción</span>
        </label>
      </div>
      <div class="admin-description-field__body" data-admin-description-body>
        <textarea class="${textareaClass}" name="${input.fieldName}">${escapeHtml(input.description ?? "")}</textarea>
        ${input.helpText ? `<span class="admin-help">${escapeHtml(input.helpText)}</span>` : ""}
      </div>
    </div>
  `;
}

function renderCatalogItemIntegratedPriceFields(state: AdminOperationalState, item: CatalogItemState): string {
  if (!item.pricing_key) {
    return `
      <div class="admin-fixed-form__note">
        <span class="admin-label">Precio</span>
        <p>No hay precio editable para este item.</p>
      </div>
    `;
  }

  const fixedRows = state.prices.fixed.filter((price) => price.pricing_key === item.pricing_key);
  const variantRows = state.prices.variants.filter((variant) => variant.pricing_key === item.pricing_key);

  if (fixedRows.length === 0 && variantRows.length === 0) {
    return `
      <div class="admin-fixed-form__note">
        <span class="admin-label">Precio</span>
        <p>No hay precio editable para este item.</p>
      </div>
    `;
  }

  if (fixedRows.length > 0) {
    const price = fixedRows[0];

    return `
      <label class="admin-field">
        <span class="admin-label">Precio</span>
        ${hiddenInput("fixed_pricing_key", price.pricing_key)}
        <input class="admin-input" type="number" name="fixed_price_amount" min="0" step="1" inputmode="numeric" value="${price.amount}" required />
      </label>
    `;
  }

  return `
    <fieldset class="admin-card admin-catalog-variant-prices">
      <legend class="admin-card__legend">Precios</legend>
      ${hiddenInput("variant_pricing_key", item.pricing_key)}
      ${variantRows.map((variant) => `
        <label class="admin-field">
          <span class="admin-label">${escapeHtml(variant.name)}</span>
          ${hiddenInput("variant_id", variant.variant_id)}
          <input class="admin-input" type="number" name="variant_amount" min="0" step="1" inputmode="numeric" value="${variant.amount}" required />
        </label>
      `).join("")}
    </fieldset>
  `;
}

function renderCatalogItemPriceEditor(
  state: AdminOperationalState,
  item: CatalogItemState,
  isBusy: boolean,
): string {
  if (!item.pricing_key) {
    return `
      <div class="admin-inline-price-panel">
        <p class="admin-label">Precio</p>
        <p class="admin-row__meta">No hay precio editable para este item.</p>
      </div>
    `;
  }

  const fixedRows = state.prices.fixed.filter((price) => price.pricing_key === item.pricing_key);
  const variantRows = state.prices.variants.filter((variant) => variant.pricing_key === item.pricing_key);

  if (fixedRows.length === 0 && variantRows.length === 0) {
    return `
      <div class="admin-inline-price-panel">
        <p class="admin-label">Precio</p>
        <p class="admin-row__meta">No hay precio editable para este item.</p>
      </div>
    `;
  }

  return `
    <section class="admin-inline-price-panel">
      <div class="admin-fixed-options__header">
        <p class="admin-label">Precio</p>
        <span class="admin-row__state-note">Guardar requiere publicación.</span>
      </div>
      ${fixedRows.map((row) => renderFixedPriceRow(row, isBusy, { showTags: false })).join("")}
      ${variantRows.map((row) => renderVariantPriceRow(row, isBusy, { showTags: false })).join("")}
    </section>
  `;
}

function renderCatalogItemOptions(item: CatalogItemState, isBusy: boolean): string {
  if (item.options.length === 0) {
    return "";
  }

  const canDeleteOptions = canDeleteFromList(item.options.length);
  const deleteHelp = canDeleteOptions
    ? "Podés quitar sabores individuales; el cambio se publica después."
    : "Debe quedar al menos un sabor en esta subcategoría.";

  return `
    <section class="admin-fixed-options">
      <div class="admin-fixed-options__header">
        <p class="admin-label">Opciones</p>
        <span class="admin-row__state-note">${item.options.length} disponibles</span>
      </div>
      <form class="admin-fixed-option-row" data-admin-form="${adminForms.catalogOption}">
        ${hiddenInput("section_id", item.section_id)}
        ${hiddenInput("item_id", item.item_id)}
        <input type="hidden" name="option_id" data-catalog-option-id />
        <label class="admin-field">
          <span class="admin-label">Nuevo sabor</span>
          <input class="admin-input" name="name" data-catalog-option-name required />
        </label>
        <div class="admin-row__actions">
          <button class="admin-button" type="submit" ${disabledAttr(isBusy)}>Agregar sabor</button>
        </div>
      </form>
      <div class="admin-fixed-options__list">
        ${item.options.map((option) => renderCatalogItemOptionRow(option, canDeleteOptions, isBusy)).join("")}
      </div>
      <span class="admin-row__state-note">${escapeHtml(deleteHelp)}</span>
    </section>
  `;
}

function renderCatalogItemOptionRow(
  option: CatalogItemOptionState,
  canDelete: boolean,
  isBusy: boolean,
): string {
  const deleteHelp = canDelete
    ? "Se quitará del menú público después de publicar."
    : "No se puede eliminar porque debe quedar al menos un sabor.";

  return `
    <form class="admin-fixed-option-row" data-admin-form="${adminForms.catalogOptionEdit}">
      ${hiddenInput("section_id", option.section_id)}
      ${hiddenInput("item_id", option.item_id)}
      ${hiddenInput("option_id", option.option_id)}
      <label class="admin-field">
        <span class="admin-label">Nombre</span>
        <input class="admin-input" name="name" value="${escapeHtml(option.name)}" required />
      </label>
      <div class="admin-row__actions">
        <button class="admin-button admin-button--secondary" type="submit" ${disabledAttr(isBusy)}>Guardar opción</button>
        <button
          class="admin-button admin-button--danger"
          type="button"
          data-admin-action="${adminActions.deleteCatalogOption}"
          data-section-id="${escapeHtml(option.section_id)}"
          data-item-id="${escapeHtml(option.item_id)}"
          data-option-id="${escapeHtml(option.option_id)}"
          ${disabledAttr(isBusy || !canDelete)}
        >
          Eliminar sabor
        </button>
      </div>
      <span class="admin-row__state-note">${escapeHtml(deleteHelp)}</span>
    </form>
  `;
}
