import type {
  AdminOperationalState,
  AdminTabId,
  AvailabilityOverlayState,
  AvailabilityTargetState,
  CatalogEditorState,
  CatalogGroupState,
  CatalogItemOptionState,
  CatalogItemState,
  CatalogSectionState,
  DailyMenuState,
  FixedMenuEditMode,
  FixedPriceState,
  GrillFamilyState,
  GrillItemState,
  PricingLabel,
  ProfileState,
  ServiceSectionId,
  ServiceKind,
  StatusMessage,
  VariantPriceState,
} from "./adminTypes";
import {
  escapeHtml,
  formatAmount,
  formatCatalogItemPrice,
  formatPricingLabel,
  getOverlayKey,
  getTargetKey,
  roleLabel,
} from "./adminUtils";

interface AdminViewContext {
  root: HTMLElement;
  currentState: AdminOperationalState | null;
  currentStatus: StatusMessage | null;
  currentBusyText: string | null;
  isBusy: boolean;
}

const regularDailyId = "menu-del-dia";
const vegetarianDailyId = "menu-vegetariano-del-dia";
const fixedOptionsOnlySectionRules: ReadonlyArray<{
  sectionId: string;
  title: string;
  itemIds: readonly string[];
}> = [
  {
    sectionId: "minutas-tartas-omelettes",
    title: "Tartas, tortillas y omelettes",
    itemIds: ["tartas", "tortilla", "omelette"],
  },
  {
    sectionId: "empanadas",
    title: "Empanadas",
    itemIds: ["empanadas"],
  },
];

let root: HTMLElement;
let currentState: AdminOperationalState | null = null;
let currentStatus: StatusMessage | null = null;
let currentBusyText: string | null = null;
let activeTab: AdminTabId = "service";
let activeServiceSection: ServiceSectionId = "active-service";
let isBusy = false;
let availabilityProfileFilter = "";
let availabilityGroupFilter = "";
let fixedSectionFilter = "";
let fixedGroupFilter = "";

export function setAdminViewContext(context: AdminViewContext): void {
  root = context.root;
  currentState = context.currentState;
  currentStatus = context.currentStatus;
  currentBusyText = context.currentBusyText;
  isBusy = context.isBusy;
}

export function setAdminActiveTab(tab: AdminTabId): void {
  activeTab = tab;
}

export function setAdminServiceSection(section: ServiceSectionId): void {
  activeServiceSection = section;
}

export function setAdminFilter(name: string, value: string): void {
  if (name === "availability-profile") {
    availabilityProfileFilter = value;
    availabilityGroupFilter = "";
    return;
  }

  if (name === "availability-group") {
    availabilityGroupFilter = value;
    return;
  }

  if (name === "fixed-section") {
    fixedSectionFilter = value;
    fixedGroupFilter = "";
    return;
  }

  if (name === "fixed-group") {
    fixedGroupFilter = value;
  }
}

export function renderConfigurationError(): void {
  root.innerHTML = `
    <section class="admin-denied">
      <p class="admin-kicker">Panel operativo</p>
      <h1 class="admin-title">Configuracion incompleta</h1>
      <div class="admin-denied__panel">
        <p class="admin-muted">Falta configurar el acceso publico necesario para cargar el panel. Avisale a quien administra el sitio.</p>
      </div>
    </section>
  `;
}

export function renderLogin(): void {
  root.innerHTML = `
    <section class="admin-login" aria-busy="${isBusy ? "true" : "false"}">
      <div>
        <p class="admin-kicker">Panel operativo</p>
        <h1 class="admin-title">Ingresar</h1>
      </div>
      ${renderStatus()}
      <form class="admin-login__form" data-admin-form="login">
        <label class="admin-field">
          <span class="admin-label">Email</span>
          <input class="admin-input" type="email" name="email" autocomplete="email" required />
        </label>
        <label class="admin-field">
          <span class="admin-label">Contrasena</span>
          <input class="admin-input" type="password" name="password" autocomplete="current-password" required />
        </label>
        <button class="admin-button" type="submit" ${isBusy ? "disabled" : ""}>Iniciar sesion</button>
        <button class="admin-link-button" type="button" data-admin-action="show-reset-request" ${isBusy ? "disabled" : ""}>Olvide mi contrasena</button>
      </form>
    </section>
  `;
}

export function renderPasswordResetRequest(): void {
  root.innerHTML = `
    <section class="admin-login" aria-busy="${isBusy ? "true" : "false"}">
      <div>
        <p class="admin-kicker">Panel operativo</p>
        <h1 class="admin-title">Recuperar acceso</h1>
        <p class="admin-muted">Te vamos a enviar un link para definir una nueva contrasena.</p>
      </div>
      ${renderStatus()}
      <form class="admin-login__form" data-admin-form="password-reset-request">
        <label class="admin-field">
          <span class="admin-label">Email</span>
          <input class="admin-input" type="email" name="email" autocomplete="email" required />
        </label>
        <button class="admin-button" type="submit" ${isBusy ? "disabled" : ""}>Enviar link</button>
        <button class="admin-link-button" type="button" data-admin-action="show-login" ${isBusy ? "disabled" : ""}>Volver al ingreso</button>
      </form>
    </section>
  `;
}

export function renderSetPassword(): void {
  root.innerHTML = `
    <section class="admin-login" aria-busy="${isBusy ? "true" : "false"}">
      <div>
        <p class="admin-kicker">Panel operativo</p>
        <h1 class="admin-title">Nueva contrasena</h1>
      </div>
      ${renderStatus()}
      <form class="admin-login__form" data-admin-form="set-password">
        <label class="admin-field">
          <span class="admin-label">Nueva contrasena</span>
          <input class="admin-input" type="password" name="password" autocomplete="new-password" minlength="8" required />
        </label>
        <label class="admin-field">
          <span class="admin-label">Confirmar contrasena</span>
          <input class="admin-input" type="password" name="password_confirmation" autocomplete="new-password" minlength="8" required />
        </label>
        <button class="admin-button" type="submit" ${isBusy ? "disabled" : ""}>Guardar contrasena</button>
      </form>
    </section>
  `;
}

export function renderAuthenticated(): void {
  if (!currentState?.ok || !currentState.staff) {
    renderDenied();
    return;
  }

  ensureActiveTab();
  const tabs = getAllowedTabs(currentState);

  root.innerHTML = `
    <section class="admin-shell" aria-busy="${isBusy ? "true" : "false"}">
      <header class="admin-header">
        <div class="admin-header__main">
          <div>
            <p class="admin-kicker">Panel operativo</p>
            <h1 class="admin-title">Admin El Faraon</h1>
            <p class="admin-header__copy">Prepara el servicio, controla disponibilidad y administra los menus editables. La disponibilidad se aplica al instante; contenido y precios necesitan publicacion.</p>
          </div>
          <div class="admin-header__identity">
            <span class="admin-user-name">${escapeHtml(currentState.staff.display_name)}</span>
            <span class="admin-role-pill">${escapeHtml(roleLabel(currentState.staff.role))}</span>
            <button class="admin-button admin-button--secondary" type="button" data-admin-action="logout" ${isBusy ? "disabled" : ""}>Salir</button>
          </div>
        </div>
        <nav class="admin-tabs" role="tablist" aria-label="Secciones del admin">
          ${tabs.map((tab) => `
            <button
              class="admin-tab"
              role="tab"
              type="button"
              data-admin-action="tab"
              data-admin-tab="${tab.id}"
              aria-selected="${activeTab === tab.id ? "true" : "false"}"
            >${escapeHtml(tab.label)}</button>
          `).join("")}
        </nav>
      </header>
      <div class="admin-main">
        ${renderPublishBanner(currentState)}
        ${renderStatus()}
        ${renderActiveTab(currentState)}
      </div>
    </section>
  `;
}

function renderDenied(): void {
  const message = currentState?.message === "staff_access_denied"
    ? "Tu usuario no tiene acceso activo al panel operativo."
    : "No se pudo cargar el panel operativo.";

  root.innerHTML = `
    <section class="admin-denied" aria-busy="${isBusy ? "true" : "false"}">
      <p class="admin-kicker">Panel operativo</p>
      <h1 class="admin-title">Sin acceso</h1>
      ${renderStatus()}
      <div class="admin-denied__panel">
        <p class="admin-muted">${escapeHtml(message)}</p>
        <div class="admin-row__actions">
          <button class="admin-button admin-button--secondary" type="button" data-admin-action="retry-admin-state" ${isBusy ? "disabled" : ""}>Reintentar</button>
          <button class="admin-button" type="button" data-admin-action="logout" ${isBusy ? "disabled" : ""}>Salir</button>
        </div>
      </div>
    </section>
  `;
}

function renderActiveTab(state: AdminOperationalState): string {
  if (activeTab === "service") {
    return renderServiceTab(state);
  }

  if (activeTab === "availability") {
    return renderAvailabilityTab(state);
  }

  if (activeTab === "fixed") {
    return renderFixedMenuTab(state);
  }

  return renderAccountTab();
}

function renderAvailabilityTab(state: AdminOperationalState): string {
  return `
    <section class="admin-section">
      <div class="admin-section__header">
        <h2 class="admin-section__title">Disponibilidad</h2>
        <p class="admin-section__copy">Oculta o vuelve a mostrar items visibles. El servicio muestra solo menu del dia o parrilla segun cada local; menu fijo queda separado.</p>
      </div>
      ${renderAvailabilityFilters(state)}
      ${renderAvailabilityRows(state)}
    </section>
  `;
}

function renderServiceTab(state: AdminOperationalState): string {
  const serviceEditor = state.permissions.can_edit_menu_content;

  return `
    <section class="admin-section admin-service">
      <div class="admin-section__header">
        <h2 class="admin-section__title">Servicio</h2>
        <p class="admin-section__copy">Elegi que servicio muestra cada local y edita el menu del dia o la parrilla operativa. El menu fijo queda separado como catalogo estable compartido.</p>
      </div>
      ${serviceEditor ? `
        ${renderServiceSectionNav()}
        ${renderActiveServiceSection(state)}
      ` : ""}
      ${!serviceEditor ? renderEmpty("No hay acciones de servicio disponibles para este rol.") : ""}
    </section>
  `;
}

function renderServiceSectionNav(): string {
  const sections: Array<{ id: ServiceSectionId; label: string; copy: string }> = [
    {
      id: "active-service",
      label: "Servicio activo",
      copy: "Define si cada local muestra menu del dia o parrilla.",
    },
    {
      id: "daily-menu",
      label: "Menu del dia",
      copy: "Edita platos y precios globales del servicio diario.",
    },
    {
      id: "grill",
      label: "Parrilla",
      copy: "Administra productos, opciones y precios de parrilla.",
    },
  ];

  return `
    <div class="admin-service-switcher">
      ${sections.map((section) => `
        <button
          class="admin-service-switcher__button"
          type="button"
          data-admin-action="service-section"
          data-admin-service-section="${section.id}"
          data-current="${activeServiceSection === section.id ? "true" : "false"}"
        >
          <span>${escapeHtml(section.label)}</span>
          <small>${escapeHtml(section.copy)}</small>
        </button>
      `).join("")}
    </div>
  `;
}

function renderActiveServiceSection(state: AdminOperationalState): string {
  if (activeServiceSection === "daily-menu") {
    return renderDailyMenuEditor(state);
  }

  if (activeServiceSection === "grill") {
    return renderGrillEditor(state);
  }

  return renderServiceModeForms(state);
}

function renderDailyMenuEditor(state: AdminOperationalState): string {
  const regular = findDailyItem(state, regularDailyId);
  const vegetarian = findDailyItem(state, vegetarianDailyId);
  const dailyPriceKeys = new Set(state.daily_menu.map((item) => item.pricing_key));
  const dailyPrices = state.prices.fixed.filter((price) => dailyPriceKeys.has(price.pricing_key));

  return `
    <section class="admin-daily-panel">
      <div class="admin-daily-panel__header">
        <h3 class="admin-daily-panel__title">Menu del dia</h3>
        <p class="admin-row__meta">Edita los dos platos y sus precios globales. Se veran en el menu publico despues de publicar cambios.</p>
      </div>
      <form class="admin-form-grid admin-daily-form" data-admin-form="daily-menu">
        ${renderDailyFieldset("Menu regular", "regular", regular)}
        ${renderDailyFieldset("Menu vegetariano", "vegetarian", vegetarian)}
        <div class="admin-row admin-callout admin-daily-submit">
          <div class="admin-row__main">
            <p class="admin-row__title">Guardar platos</p>
            <p class="admin-row__meta">Actualiza las dos opciones visibles del servicio diario.</p>
          </div>
          <div class="admin-row__actions">
            <button class="admin-button" type="submit" ${isBusy ? "disabled" : ""}>Guardar menu del dia</button>
          </div>
        </div>
      </form>
      ${renderFixedPriceRows(dailyPrices, "No hay precios del menu del dia editables.")}
    </section>
  `;
}

function renderGrillEditor(state: AdminOperationalState): string {
  const editor = state.grill_editor;
  const families = editor.families;

  return `
    <section class="admin-daily-panel admin-grill-editor">
      <div class="admin-daily-panel__header">
        <h3 class="admin-daily-panel__title">Parrilla</h3>
        <p class="admin-row__meta">Administra productos de parrilla y sus opciones de precio. El menu publico se actualiza despues de publicar cambios.</p>
      </div>
      ${renderGrillProductForm()}
      ${families.length > 0
        ? families.map((family) => renderGrillProductEditor(state, family)).join("")
        : renderEmpty("No hay productos de parrilla. Agrega el primero con el formulario.")}
    </section>
  `;
}

function renderGrillProductForm(): string {
  return `
    <form class="admin-card admin-fixed-form" data-admin-form="grill-product">
      <div class="admin-fixed-form__header">
        <h4 class="admin-card__legend">Agregar producto de parrilla</h4>
        <p class="admin-row__meta">Crea un producto nuevo con su primera opcion y precio.</p>
      </div>
      <input type="hidden" name="family_id" data-grill-product-id />
      <input type="hidden" name="item_id" data-grill-id />
      <label class="admin-field">
        <span class="admin-label">Producto</span>
        <input class="admin-input" name="title" data-grill-product-name required />
      </label>
      <label class="admin-field">
        <span class="admin-label">Primera opcion</span>
        <input class="admin-input" name="variant_name" data-grill-name required />
      </label>
      <label class="admin-field">
        <span class="admin-label">Precio</span>
        <input class="admin-input" type="number" name="amount" min="0" step="1" inputmode="numeric" required />
      </label>
      <div class="admin-row__actions admin-fixed-form__actions">
        <button class="admin-button" type="submit" ${isBusy ? "disabled" : ""}>Agregar producto</button>
      </div>
    </form>
  `;
}

function renderGrillProductEditor(state: AdminOperationalState, family: GrillFamilyState): string {
  const items = state.grill_editor.items.filter((item) => item.family_id === family.family_id);

  return `
    <section class="admin-grill-family admin-grill-product">
      <form class="admin-fixed-edit-fields admin-grill-product-edit" data-admin-form="grill-product-edit">
        <input type="hidden" name="family_id" value="${escapeHtml(family.family_id)}" />
        <label class="admin-field">
          <span class="admin-grill-product-title">Producto</span>
          <input class="admin-input" name="title" value="${escapeHtml(family.title)}" required />
        </label>
        <div class="admin-row__actions admin-fixed-edit-actions">
          <button class="admin-button" type="submit" ${isBusy ? "disabled" : ""}>Guardar producto</button>
        </div>
      </form>
      ${renderGrillOptionForm(family)}
      <div class="admin-grid">
        ${items.length > 0
          ? items.map((item) => renderGrillOptionRow(item, items.length > 1)).join("")
          : renderEmpty("No hay opciones en este producto. Agrega la primera con el formulario.")}
      </div>
      <div class="admin-row__actions">
        <button
          class="admin-button admin-button--danger"
          type="button"
          data-admin-action="delete-grill-product"
          data-family-id="${escapeHtml(family.family_id)}"
          ${isBusy ? "disabled" : ""}
        >
          Eliminar producto
        </button>
        <span class="admin-row__state-note admin-fixed-delete-note">Elimina el producto completo y todas sus opciones despues de publicar.</span>
      </div>
    </section>
  `;
}

function renderGrillOptionForm(family: GrillFamilyState): string {
  return `
    <form class="admin-card admin-fixed-form admin-grill-option-add" data-admin-form="grill-item">
      <div class="admin-fixed-form__header">
        <h4 class="admin-card__legend">Agregar opcion</h4>
        <p class="admin-row__meta">Se agrega al final de ${escapeHtml(family.title)}.</p>
      </div>
      <input type="hidden" name="family_id" value="${escapeHtml(family.family_id)}" />
      <input type="hidden" name="product_name" value="${escapeHtml(family.title)}" />
      <input type="hidden" name="item_id" data-grill-id />
      <label class="admin-field">
        <span class="admin-label">Opcion</span>
        <input class="admin-input" name="variant_name" data-grill-name required />
      </label>
      <label class="admin-field">
        <span class="admin-label">Precio</span>
        <input class="admin-input" type="number" name="amount" min="0" step="1" inputmode="numeric" required />
      </label>
      <div class="admin-row__actions admin-fixed-form__actions">
        <button class="admin-button" type="submit" ${isBusy ? "disabled" : ""}>Agregar opcion</button>
      </div>
    </form>
  `;
}

function renderGrillOptionRow(item: GrillItemState, canDelete: boolean): string {
  const priceText = item.price_amount === null ? "Precio configurado" : formatAmount(item.price_amount);
  const optionName = item.variant_name ?? item.name;

  return `
    <div class="admin-row admin-fixed-row admin-grill-option-row">
      <form class="admin-grill-option-edit" data-admin-form="grill-item-edit">
        <input type="hidden" name="item_id" value="${escapeHtml(item.item_id)}" />
        <input type="hidden" name="fixed_pricing_key" value="${escapeHtml(item.pricing_key)}" />
        <div class="admin-row__main">
          <p class="admin-row__title">${escapeHtml(optionName)}</p>
          <div class="admin-price-tags">
            <span class="admin-price-tag">${escapeHtml(item.family_title)}</span>
            <span class="admin-price-tag">${escapeHtml(priceText)}</span>
          </div>
        </div>
        <label class="admin-field">
          <span class="admin-label">Opcion</span>
          <input class="admin-input" name="variant_name" value="${escapeHtml(optionName)}" required />
        </label>
        <label class="admin-field admin-price-field">
          <span class="admin-label">Importe</span>
          <input class="admin-input" type="number" name="fixed_price_amount" min="0" step="1" inputmode="numeric" value="${item.price_amount ?? 0}" required />
        </label>
        <div class="admin-row__actions admin-grill-option-actions">
          <button class="admin-button" type="submit" ${isBusy ? "disabled" : ""}>Guardar</button>
        </div>
      </form>
      <div class="admin-row__actions admin-grill-option-delete">
        <button
          class="admin-button admin-button--danger"
          type="button"
          data-admin-action="delete-grill-item"
          data-item-id="${escapeHtml(item.item_id)}"
          ${isBusy || !canDelete ? "disabled" : ""}
        >
          Eliminar
        </button>
        <span class="admin-row__state-note admin-fixed-delete-note">${canDelete ? "Se quitara del menu publico despues de publicar." : "Debe quedar al menos una opcion. Para quitar todo, elimina el producto."}</span>
      </div>
    </div>
  `;
}

function renderFixedMenuTab(state: AdminOperationalState): string {
  const editor = state.catalog_editor;
  const section = getEffectiveFixedSection(editor);

  if (!state.permissions.can_edit_menu_content) {
    return `
      <section class="admin-section">
        <div class="admin-section__header">
          <h2 class="admin-section__title">Menu fijo</h2>
        <p class="admin-section__copy">Tu usuario no tiene permiso para editar items del menu fijo.</p>
        </div>
      </section>
    `;
  }

  if (!section) {
    return `
      <section class="admin-section">
        <div class="admin-section__header">
          <h2 class="admin-section__title">Menu fijo</h2>
          <p class="admin-section__copy">Administra el catalogo estable compartido. Para crear secciones o cambiar el orden, avisale a quien administra el sitio.</p>
        </div>
        ${renderEmpty("No hay secciones del menu fijo disponibles.")}
      </section>
    `;
  }

  const groups = getFixedSectionGroups(editor, section.section_id);
  const group = section.content_kind === "groups" ? getEffectiveFixedGroup(editor, section.section_id) : undefined;
  const items = getFixedLocationItems(editor, section, group);
  const editMode = getFixedMenuEditMode(section);
  const sectionCopy = editMode === "options-only"
    ? "Administra solo sabores de esta subcategoria. No se pueden agregar, editar ni eliminar items desde esta pantalla."
    : "Agrega, edita nombre/descripcion o elimina items puntuales del catalogo estable. Los cambios quedan guardados, pero el menu publico se actualiza despues de publicar.";

  return `
    <section class="admin-section admin-fixed">
      <div class="admin-section__header">
        <h2 class="admin-section__title">Menu fijo</h2>
        <p class="admin-section__copy">Administra el catalogo estable compartido. ${escapeHtml(sectionCopy)}</p>
      </div>
      ${editMode === "items" ? `<div class="admin-row admin-callout admin-fixed-guide">
        <div class="admin-row__main">
          <p class="admin-row__title">Como usar esta pantalla</p>
          <p class="admin-row__meta">Elegi la ubicacion, completa el nombre visible y agrega el item.</p>
        </div>
      </div>` : ""}
      <div class="admin-toolbar admin-fixed-toolbar">
        <label class="admin-field">
          <span class="admin-label">Seccion</span>
          <select class="admin-select" data-admin-filter="fixed-section">
            ${editor.sections
              .map((entry) => `<option value="${escapeHtml(entry.section_id)}" ${entry.section_id === section.section_id ? "selected" : ""}>${escapeHtml(getFixedSectionAdminTitle(entry))}</option>`)
              .join("")}
          </select>
        </label>
        ${section.content_kind === "groups" ? `
          <label class="admin-field">
            <span class="admin-label">Grupo</span>
            <select class="admin-select" data-admin-filter="fixed-group">
              ${groups
                .map((entry) => `<option value="${escapeHtml(entry.group_id)}" ${entry.group_id === group?.group_id ? "selected" : ""}>${escapeHtml(entry.title)}</option>`)
                .join("")}
            </select>
          </label>
        ` : ""}
      </div>
      ${renderFixedMenuSharedPriceEditor(state, group)}
      ${editMode === "options-only"
        ? ""
        : section.content_kind === "groups" && !group
        ? renderEmpty("La seccion seleccionada no tiene grupos disponibles para agregar items.")
        : renderCatalogItemForm(section, group)}
      ${renderCatalogItemList(state, items, editMode)}
    </section>
  `;
}

function renderFixedMenuSharedPriceEditor(
  state: AdminOperationalState,
  group: CatalogGroupState | undefined,
): string {
  if (!group?.pricing_key) {
    return "";
  }

  const fixedRows = state.prices.fixed.filter((price) => price.pricing_key === group.pricing_key);
  const variantRows = state.prices.variants.filter((variant) => variant.pricing_key === group.pricing_key);

  return renderPriceEditorSection(
    "Precio compartido del grupo",
    `Este precio aplica a todos los items de ${group.title}. Guardar requiere publicacion.`,
    fixedRows,
    variantRows,
  );
}

function renderPriceEditorSection(
  title: string,
  copy: string,
  fixedRows: FixedPriceState[],
  variantRows: VariantPriceState[],
): string {
  return `
    <section class="admin-price-panel">
      <div class="admin-daily-panel__header">
        <h3 class="admin-daily-panel__title">${escapeHtml(title)}</h3>
        <p class="admin-row__meta">${escapeHtml(copy)}</p>
      </div>
      <div class="admin-price-grid">
        ${renderFixedPriceRows(fixedRows, "No hay precios fijos editables en esta ubicacion.")}
        ${renderVariantPriceRows(variantRows, "No hay variantes editables en esta ubicacion.")}
      </div>
    </section>
  `;
}

function renderFixedPriceRows(rows: FixedPriceState[], emptyMessage: string): string {
  return `
    <div class="admin-grid">
      <p class="admin-kicker">Precios</p>
      ${rows.length > 0 ? rows.map(renderFixedPriceRow).join("") : renderEmpty(emptyMessage)}
    </div>
  `;
}

function renderVariantPriceRows(rows: VariantPriceState[], emptyMessage: string): string {
  return `
    <div class="admin-grid">
      <p class="admin-kicker">Variantes</p>
      ${rows.length > 0 ? rows.map(renderVariantPriceRow).join("") : renderEmpty(emptyMessage)}
    </div>
  `;
}

function renderAccountTab(): string {
  return `
    <section class="admin-section">
      <div class="admin-section__header">
        <h2 class="admin-section__title">Cuenta</h2>
        <p class="admin-section__copy">Actualiza tu contrasena de acceso al panel.</p>
      </div>
      <form class="admin-form-grid" data-admin-form="change-password">
        <label class="admin-field">
          <span class="admin-label">Nueva contrasena</span>
          <input class="admin-input" type="password" name="password" autocomplete="new-password" minlength="8" required />
        </label>
        <label class="admin-field">
          <span class="admin-label">Confirmar contrasena</span>
          <input class="admin-input" type="password" name="password_confirmation" autocomplete="new-password" minlength="8" required />
        </label>
        <div class="admin-row__actions">
          <button class="admin-button" type="submit" ${isBusy ? "disabled" : ""}>Guardar contrasena</button>
        </div>
      </form>
    </section>
  `;
}

function renderPublishBanner(state: AdminOperationalState): string {
  if (!hasPendingPublication(state) || !state.permissions.can_publish_menu) {
    return "";
  }

  return `
    <div class="admin-banner">
      <span>Falta publicar: hay cambios guardados que no estan publicados.</span>
      <button class="admin-button" type="button" data-admin-action="publish" ${isBusy ? "disabled" : ""}>Publicar ahora</button>
    </div>
  `;
}

function hasPendingPublication(state: AdminOperationalState): boolean {
  return state.publication.has_unpublished_changes;
}

function renderStatus(): string {
  const status: StatusMessage | null = currentBusyText
    ? { text: currentBusyText, tone: "neutral" }
    : currentStatus;

  if (!status) {
    return "";
  }

  return `
    <div class="admin-status" data-tone="${status.tone}" data-busy="${currentBusyText ? "true" : "false"}" aria-live="polite">
      <span>${escapeHtml(status.text)}</span>
    </div>
  `;
}

function renderAvailabilityFilters(state: AdminOperationalState): string {
  const profileFilter = getEffectiveAvailabilityProfileFilter(state);
  const profileOptions = getEditableAvailabilityProfiles(state);
  const profileTargets = getVisibleAvailabilityTargets(state).filter((target) => target.menu_id === profileFilter);
  const groupOptions = getAvailabilityGroupOptions(
    profileTargets,
  );
  const groupFilter = getEffectiveAvailabilityGroupFilter(groupOptions);

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
          <option value="">Todos</option>
          ${groupOptions
            .map((option) => `<option value="${escapeHtml(option.key)}" ${groupFilter === option.key ? "selected" : ""}>${escapeHtml(option.label)}</option>`)
            .join("")}
        </select>
      </label>
    </div>
  `;
}

function getEditableAvailabilityProfiles(state: AdminOperationalState): ProfileState[] {
  return state.profiles.filter((profile) => profile.can_edit_availability);
}

function getEffectiveAvailabilityProfileFilter(state: AdminOperationalState): string {
  const editableProfiles = getEditableAvailabilityProfiles(state);

  if (editableProfiles.some((profile) => profile.id === availabilityProfileFilter)) {
    return availabilityProfileFilter;
  }

  return editableProfiles[0]?.id ?? "";
}

function getAvailabilityGroupKey(target: AvailabilityTargetState): string {
  if (target.group_title) {
    return `group:${target.section_id}:${target.group_id}`;
  }

  return `section:${target.section_id}`;
}

function getAvailabilityGroupLabel(target: AvailabilityTargetState): string {
  if (target.target_kind === "grill" && !target.group_title) {
    return "Parrilla";
  }

  return target.group_title ?? target.section_title;
}

function getAvailabilityGroupOptions(
  targets: AvailabilityTargetState[],
): Array<{ key: string; label: string }> {
  const options: Array<{ key: string; label: string }> = [];
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

function renderAvailabilityRows(state: AdminOperationalState): string {
  const profileFilter = getEffectiveAvailabilityProfileFilter(state);
  const profileTargets = getVisibleAvailabilityTargets(state).filter((target) => target.menu_id === profileFilter);
  const groupFilter = getEffectiveAvailabilityGroupFilter(getAvailabilityGroupOptions(profileTargets));
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
    ${renderAvailabilityTargetSection(state, "Servicio activo", serviceTargets)}
    ${renderAvailabilityTargetSection(state, "Menu fijo", catalogTargets)}
  `;
}

function renderAvailabilityTargetSection(
  state: AdminOperationalState,
  title: string,
  targets: AvailabilityTargetState[],
): string {
  if (targets.length === 0) {
    return "";
  }

  return `
    <section class="admin-availability-group">
      <div class="admin-list-header">
        <span>${escapeHtml(title)}</span>
        <span>${targets.length} items &middot; cambios instantaneos</span>
      </div>
      <div class="admin-grid">${targets.map((target) => renderAvailabilityRow(state, target)).join("")}</div>
    </section>
  `;
}

function renderServiceModeForms(state: AdminOperationalState): string {
  if (state.profiles.length === 0) {
    return `
      <section class="admin-daily-panel">
        <div class="admin-daily-panel__header">
          <h3 class="admin-daily-panel__title">Servicio activo por local</h3>
          <p class="admin-row__meta">Cambiar entre menu del dia y parrilla se vera en el menu publico despues de publicar.</p>
        </div>
        ${renderEmpty("No hay locales para configurar.")}
      </section>
    `;
  }

  return `
    <section class="admin-daily-panel">
      <div class="admin-daily-panel__header">
        <h3 class="admin-daily-panel__title">Servicio activo por local</h3>
        <p class="admin-row__meta">Elegir el servicio activo cambia que ve cada local. Se vera en el menu publico despues de publicar.</p>
      </div>
      <div class="admin-grid">
        ${state.profiles.map((profile) => {
          const currentService = findServiceKind(state, profile.id);
          const serviceLabel = currentService === "daily-menu" ? "Menu del dia activo" : "Parrilla activa";

          return `
            <form class="admin-row admin-daily-service-row" data-admin-form="service-kind" data-current-service="${currentService}" data-profile-title="${escapeHtml(profile.title)}">
              <div class="admin-row__main">
                <p class="admin-row__title">${escapeHtml(profile.title)}</p>
                <div class="admin-row__status">
                  <span class="admin-pill" data-tone="${currentService === "daily-menu" ? "success" : "neutral"}">${escapeHtml(serviceLabel)}</span>
                  <span class="admin-row__state-note">Se vera despues de publicar si cambia.</span>
                </div>
              </div>
              <div class="admin-row__actions">
                <input type="hidden" name="profile_id" value="${escapeHtml(profile.id)}" />
                <select class="admin-select" name="service_kind" aria-label="Servicio activo para ${escapeHtml(profile.title)}">
                  <option value="daily-menu" ${currentService === "daily-menu" ? "selected" : ""}>Menu del dia</option>
                  <option value="grill" ${currentService === "grill" ? "selected" : ""}>Parrilla</option>
                </select>
                <button class="admin-button" type="submit" ${isBusy ? "disabled" : ""}>Guardar</button>
              </div>
            </form>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function getEffectiveAvailabilityGroupFilter(
  groupOptions: Array<{ key: string; label: string }>,
): string {
  return groupOptions.some((option) => option.key === availabilityGroupFilter) ? availabilityGroupFilter : "";
}

function renderAvailabilityRow(
  state: AdminOperationalState,
  target: AvailabilityTargetState,
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
          ${renderAvailabilityStatus(effectiveAvailable, overlay)}
        </div>
      </div>
      ${renderAvailabilityActions(key, effectiveAvailable, overlay)}
    </div>
  `;
}

function renderAvailabilityStatus(
  effectiveAvailable: boolean,
  overlay: AvailabilityOverlayState | undefined,
): string {
  return `
    <span class="admin-pill" data-tone="${effectiveAvailable ? "success" : "danger"}">
      ${effectiveAvailable ? "Se muestra en el menu" : "Oculto en el menu"}
    </span>
    <span class="admin-row__state-note">
      ${overlay ? "Cambio manual activo" : "Sin cambio manual"}
    </span>
  `;
}

function renderAvailabilityActions(
  key: string,
  effectiveAvailable: boolean,
  overlay: AvailabilityOverlayState | undefined,
): string {
  const mainButton = effectiveAvailable
    ? `
      <button class="admin-button admin-button--danger" type="button" data-admin-action="set-overlay" data-target-key="${escapeHtml(key)}" data-available="false" ${isBusy ? "disabled" : ""}>
        Ocultar ahora
      </button>
    `
    : `
      <button class="admin-button admin-button--secondary" type="button" data-admin-action="set-overlay" data-target-key="${escapeHtml(key)}" data-available="true" ${isBusy ? "disabled" : ""}>
        Volver a mostrar
      </button>
    `;

  const clearButton = overlay && effectiveAvailable
    ? `
      <button class="admin-button admin-button--secondary" type="button" data-admin-action="clear-overlay" data-target-key="${escapeHtml(key)}" ${isBusy ? "disabled" : ""}>
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

function renderDailyFieldset(
  label: string,
  prefix: "regular" | "vegetarian",
  item: DailyMenuState | undefined,
): string {
  const fieldLabel = prefix === "regular" ? "menu regular" : "menu vegetariano";

  return `
    <fieldset class="admin-card admin-daily-card">
      <legend class="admin-card__legend">${escapeHtml(label)}</legend>
      <label class="admin-field">
        <span class="admin-label">Nombre del ${fieldLabel}</span>
        <input class="admin-input" name="${prefix}_name" value="${escapeHtml(item?.name ?? "")}" required />
      </label>
      <label class="admin-field admin-field--wide">
        <span class="admin-label">Descripcion del ${fieldLabel}</span>
        <textarea class="admin-textarea" name="${prefix}_description">${escapeHtml(item?.description ?? "")}</textarea>
      </label>
    </fieldset>
  `;
}

function formatAvailabilityKindLabel(target: AvailabilityTargetState): string {
  if (target.target_kind === "daily-menu") {
    return "Menu del dia";
  }

  if (target.target_kind === "grill") {
    return "Parrilla";
  }

  return "Menu fijo";
}

function renderCatalogItemForm(
  section: CatalogSectionState,
  group: CatalogGroupState | undefined,
): string {
  const requiresPrice = section.content_kind === "items" || !group?.pricing_key;
  const locationTitle = group ? `${section.title} / ${group.title}` : section.title;

  return `
    <form class="admin-card admin-fixed-form" data-admin-form="catalog-item">
      <div class="admin-fixed-form__header">
        <h3 class="admin-card__legend">Agregar item nuevo</h3>
        <p class="admin-row__meta">Se agrega al final de ${escapeHtml(locationTitle)}. Para cambiar el orden, avisale a quien administra el sitio.</p>
      </div>
      <input type="hidden" name="section_id" value="${escapeHtml(section.section_id)}" />
      <input type="hidden" name="group_id" value="${escapeHtml(group?.group_id ?? "")}" />
      <input type="hidden" name="item_id" data-catalog-id />
      <label class="admin-field">
        <span class="admin-label">Nombre visible</span>
        <input class="admin-input" name="name" data-catalog-name required />
        <span class="admin-help">Es el nombre que va a leer el cliente en el menu.</span>
      </label>
      ${requiresPrice ? `
        <label class="admin-field">
          <span class="admin-label">Precio</span>
          <input class="admin-input" type="number" name="amount" min="0" step="1" inputmode="numeric" required />
          <span class="admin-help">Usa numeros sin simbolo de peso.</span>
        </label>
      ` : `
        <div class="admin-fixed-form__note">
          <span class="admin-label">Precio</span>
          <p>Usa el precio compartido de este grupo.</p>
        </div>
      `}
      <label class="admin-field admin-field--wide">
        <span class="admin-label">Descripcion</span>
        <textarea class="admin-textarea" name="description"></textarea>
        <span class="admin-help">Texto corto debajo del nombre. Inclui aclaraciones aca si hacen falta.</span>
      </label>
      <div class="admin-row__actions admin-fixed-form__actions">
        <button class="admin-button" type="submit" ${isBusy ? "disabled" : ""}>Agregar al menu fijo</button>
      </div>
    </form>
  `;
}

function renderCatalogItemList(
  state: AdminOperationalState,
  items: CatalogItemState[],
  editMode: FixedMenuEditMode,
): string {
  if (items.length === 0) {
    return renderEmpty(editMode === "options-only"
      ? "No hay subcategorias con sabores editables en esta ubicacion."
      : "No hay items en esta ubicacion. Agrega el primero con el formulario de arriba.");
  }

  return `
    <div class="admin-list-header">
      <span>${items.length} ${editMode === "options-only" ? "subcategorias" : "items"}</span>
      <span>${editMode === "options-only" ? "Agregar, editar o eliminar sabores requiere publicar cambios." : "Editar o eliminar requiere publicar cambios."}</span>
    </div>
    <div class="admin-grid">
      ${items.map((item) => renderCatalogItemRow(state, item, items.length > 1, editMode)).join("")}
    </div>
  `;
}

function renderCatalogItemRow(
  state: AdminOperationalState,
  item: CatalogItemState,
  canDelete: boolean,
  editMode: FixedMenuEditMode,
): string {
  const priceText = formatCatalogItemPrice(item);
  const optionText = item.option_count > 0
    ? `${item.option_count} opciones asociadas`
    : "Sin opciones";
  const deleteHelp = canDelete
    ? "Se quitara del menu publico despues de publicar."
    : "No se puede eliminar porque debe quedar al menos un item en esta ubicacion.";

  return `
    <div class="admin-row admin-fixed-row">
      <div class="admin-row__main">
        <p class="admin-row__title">${escapeHtml(item.name)}</p>
        <div class="admin-price-tags">
          <span class="admin-price-tag">${escapeHtml(priceText)}</span>
          <span class="admin-price-tag">${escapeHtml(optionText)}</span>
        </div>
        ${editMode === "items" ? `<form class="admin-fixed-edit-fields" data-admin-form="catalog-item-edit">
          <input type="hidden" name="section_id" value="${escapeHtml(item.section_id)}" />
          <input type="hidden" name="group_id" value="${escapeHtml(item.group_id)}" />
          <input type="hidden" name="item_id" value="${escapeHtml(item.item_id)}" />
          <label class="admin-field">
            <span class="admin-label">Nombre</span>
            <input class="admin-input" name="name" value="${escapeHtml(item.name)}" required />
          </label>
          ${renderCatalogItemIntegratedPriceFields(state, item)}
          <label class="admin-field admin-field--wide">
            <span class="admin-label">Descripcion</span>
            <textarea class="admin-textarea admin-textarea--compact" name="description">${escapeHtml(item.description ?? "")}</textarea>
          </label>
          <div class="admin-row__actions admin-fixed-edit-actions">
            <button class="admin-button" type="submit" ${isBusy ? "disabled" : ""}>
              Guardar
            </button>
          </div>
        </form>` : ""}
        ${editMode === "items" ? "" : renderCatalogItemPriceEditor(state, item)}
        ${renderCatalogItemOptions(item)}
      </div>
      ${editMode === "items" ? `<div class="admin-row__actions">
        <button
          class="admin-button admin-button--danger"
          type="button"
          data-admin-action="delete-catalog-item"
          data-section-id="${escapeHtml(item.section_id)}"
          data-group-id="${escapeHtml(item.group_id)}"
          data-item-id="${escapeHtml(item.item_id)}"
          ${isBusy || !canDelete ? "disabled" : ""}
        >
          Eliminar
        </button>
        <span class="admin-row__state-note admin-fixed-delete-note">${escapeHtml(deleteHelp)}</span>
      </div>` : ""}
    </div>
  `;
}

function renderCatalogItemIntegratedPriceFields(state: AdminOperationalState, item: CatalogItemState): string {
  if (!item.pricing_key) {
    return `
      <div class="admin-fixed-form__note">
        <span class="admin-label">Precio</span>
        <p>Usa el precio compartido del grupo seleccionado.</p>
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
        <input type="hidden" name="fixed_pricing_key" value="${escapeHtml(price.pricing_key)}" />
        <input class="admin-input" type="number" name="fixed_price_amount" min="0" step="1" inputmode="numeric" value="${price.amount}" required />
      </label>
    `;
  }

  return `
    <fieldset class="admin-card admin-catalog-variant-prices">
      <legend class="admin-card__legend">Precios</legend>
      <input type="hidden" name="variant_pricing_key" value="${escapeHtml(item.pricing_key)}" />
      ${variantRows.map((variant) => `
        <label class="admin-field">
          <span class="admin-label">${escapeHtml(variant.name)}</span>
          <input type="hidden" name="variant_id" value="${escapeHtml(variant.variant_id)}" />
          <input class="admin-input" type="number" name="variant_amount" min="0" step="1" inputmode="numeric" value="${variant.amount}" required />
        </label>
      `).join("")}
    </fieldset>
  `;
}

function renderCatalogItemPriceEditor(state: AdminOperationalState, item: CatalogItemState): string {
  if (!item.pricing_key) {
    return `
      <div class="admin-inline-price-panel">
        <p class="admin-label">Precio</p>
        <p class="admin-row__meta">Este item usa el precio compartido del grupo seleccionado.</p>
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
        <span class="admin-row__state-note">Guardar requiere publicacion.</span>
      </div>
      ${fixedRows.map(renderFixedPriceRow).join("")}
      ${variantRows.map(renderVariantPriceRow).join("")}
    </section>
  `;
}

function renderCatalogItemOptions(item: CatalogItemState): string {
  if (item.options.length === 0) {
    return "";
  }

  const canDeleteOptions = item.options.length > 1;
  const deleteHelp = canDeleteOptions
    ? "Puedes quitar sabores individuales; el cambio se publica despues."
    : "Debe quedar al menos un sabor en esta subcategoria.";

  return `
    <section class="admin-fixed-options">
      <div class="admin-fixed-options__header">
        <p class="admin-label">Opciones</p>
        <span class="admin-row__state-note">${item.options.length} disponibles</span>
      </div>
      <form class="admin-fixed-option-row" data-admin-form="catalog-option">
        <input type="hidden" name="section_id" value="${escapeHtml(item.section_id)}" />
        <input type="hidden" name="group_id" value="${escapeHtml(item.group_id)}" />
        <input type="hidden" name="item_id" value="${escapeHtml(item.item_id)}" />
        <input type="hidden" name="option_id" data-catalog-option-id />
        <label class="admin-field">
          <span class="admin-label">Nuevo sabor</span>
          <input class="admin-input" name="name" data-catalog-option-name required />
        </label>
        <div class="admin-row__actions">
          <button class="admin-button" type="submit" ${isBusy ? "disabled" : ""}>Agregar sabor</button>
        </div>
      </form>
      <div class="admin-fixed-options__list">
        ${item.options.map((option) => renderCatalogItemOptionRow(option, canDeleteOptions)).join("")}
      </div>
      <span class="admin-row__state-note">${escapeHtml(deleteHelp)}</span>
    </section>
  `;
}

function renderCatalogItemOptionRow(option: CatalogItemOptionState, canDelete: boolean): string {
  const deleteHelp = canDelete
    ? "Se quitara del menu publico despues de publicar."
    : "No se puede eliminar porque debe quedar al menos un sabor.";

  return `
    <form class="admin-fixed-option-row" data-admin-form="catalog-option-edit">
      <input type="hidden" name="section_id" value="${escapeHtml(option.section_id)}" />
      <input type="hidden" name="group_id" value="${escapeHtml(option.group_id)}" />
      <input type="hidden" name="item_id" value="${escapeHtml(option.item_id)}" />
      <input type="hidden" name="option_id" value="${escapeHtml(option.option_id)}" />
      <label class="admin-field">
        <span class="admin-label">Nombre</span>
        <input class="admin-input" name="name" value="${escapeHtml(option.name)}" required />
      </label>
      <div class="admin-row__actions">
        <button class="admin-button admin-button--secondary" type="submit" ${isBusy ? "disabled" : ""}>Guardar opcion</button>
        <button
          class="admin-button admin-button--danger"
          type="button"
          data-admin-action="delete-catalog-option"
          data-section-id="${escapeHtml(option.section_id)}"
          data-group-id="${escapeHtml(option.group_id)}"
          data-item-id="${escapeHtml(option.item_id)}"
          data-option-id="${escapeHtml(option.option_id)}"
          ${isBusy || !canDelete ? "disabled" : ""}
        >
          Eliminar sabor
        </button>
      </div>
      <span class="admin-row__state-note">${escapeHtml(deleteHelp)}</span>
    </form>
  `;
}

function renderFixedPriceRow(price: FixedPriceState): string {
  const label = formatPricingLabel(price.pricing_key, "Precio fijo");

  return `
    <form class="admin-row admin-price-row" data-admin-form="fixed-price">
      <div class="admin-row__main">
        <p class="admin-row__title">${escapeHtml(label.title)}</p>
        ${renderPriceTags(label)}
        <p class="admin-row__meta">Actual: ${escapeHtml(formatAmount(price.amount))}</p>
      </div>
      <div class="admin-row__actions">
        <input type="hidden" name="pricing_key" value="${escapeHtml(price.pricing_key)}" />
        <label class="admin-price-field">
          <span class="admin-label">Importe</span>
          <input class="admin-input" type="number" name="amount" min="0" step="1" inputmode="numeric" value="${price.amount}" required />
        </label>
        <button class="admin-button" type="submit" ${isBusy ? "disabled" : ""}>Guardar</button>
      </div>
    </form>
  `;
}

function renderVariantPriceRow(variant: VariantPriceState): string {
  const label = formatPricingLabel(variant.pricing_key, "Variantes");

  return `
    <form class="admin-row admin-price-row" data-admin-form="variant-price">
      <div class="admin-row__main">
        <p class="admin-row__title">${escapeHtml(label.title)}</p>
        ${renderPriceTags(label)}
        <p class="admin-row__meta">Variante: ${escapeHtml(variant.name)}</p>
        <p class="admin-row__meta">Actual: ${escapeHtml(formatAmount(variant.amount))}</p>
      </div>
      <div class="admin-row__actions">
        <input type="hidden" name="pricing_key" value="${escapeHtml(variant.pricing_key)}" />
        <input type="hidden" name="variant_id" value="${escapeHtml(variant.variant_id)}" />
        <label class="admin-price-field">
          <span class="admin-label">Importe</span>
          <input class="admin-input" type="number" name="amount" min="0" step="1" inputmode="numeric" value="${variant.amount}" required />
        </label>
        <button class="admin-button" type="submit" ${isBusy ? "disabled" : ""}>Guardar</button>
      </div>
    </form>
  `;
}

function renderPriceTags(label: PricingLabel): string {
  return `
    <div class="admin-price-tags">
      ${label.tags.map((tag) => `<span class="admin-price-tag">${escapeHtml(tag)}</span>`).join("")}
    </div>
  `;
}

function renderEmpty(message: string): string {
  return `<p class="admin-empty">${escapeHtml(message)}</p>`;
}

function getAllowedTabs(state: AdminOperationalState): Array<{ id: AdminTabId; label: string }> {
  const tabs: Array<{ id: AdminTabId; label: string }> = [];

  if (state.permissions.can_edit_menu_content) {
    tabs.push({ id: "service", label: "Servicio" });
  }

  if (state.permissions.can_edit_availability) {
    tabs.push({ id: "availability", label: "Disponibilidad" });
  }

  if (state.permissions.can_edit_menu_content) {
    tabs.push({ id: "fixed", label: "Menu fijo" });
  }

  tabs.push({ id: "account", label: "Cuenta" });

  return tabs;
}

export function ensureActiveTab(): void {
  if (!currentState) {
    return;
  }

  const allowedTabs = getAllowedTabs(currentState);

  if (!allowedTabs.some((tab) => tab.id === activeTab)) {
    activeTab = allowedTabs[0]?.id ?? "account";
  }
}

function findDailyItem(
  state: AdminOperationalState,
  itemId: string,
): DailyMenuState | undefined {
  return state.daily_menu.find((item) => item.item_id === itemId);
}

function findServiceKind(state: AdminOperationalState, profileId: string): ServiceKind {
  return state.service_settings.find((entry) => entry.profile_id === profileId)?.service_kind
    ?? "daily-menu";
}

function getVisibleAvailabilityTargets(state: AdminOperationalState): AvailabilityTargetState[] {
  return state.availability_targets.filter((target) =>
    target.target_kind === "catalog"
    || target.target_kind === findServiceKind(state, target.menu_id)
  );
}

function findOverlay(
  state: AdminOperationalState,
  target: AvailabilityTargetState,
): AvailabilityOverlayState | undefined {
  return state.availability_overlays.find((overlay) => getOverlayKey(overlay) === getTargetKey(target));
}

export function findAvailabilityTarget(key: string): AvailabilityTargetState | undefined {
  return currentState?.availability_targets.find((target) => getTargetKey(target) === key);
}

export function findCatalogItem(
  sectionId: string,
  groupId: string,
  itemId: string,
): CatalogItemState | undefined {
  return currentState?.catalog_editor.items.find((item) =>
    item.section_id === sectionId
    && item.group_id === groupId
    && item.item_id === itemId
  );
}

export function findCatalogItemOption(
  sectionId: string,
  groupId: string,
  itemId: string,
  optionId: string,
): CatalogItemOptionState | undefined {
  return findCatalogItem(sectionId, groupId, itemId)?.options.find((option) => option.option_id === optionId);
}

export function findGrillItem(itemId: string): GrillItemState | undefined {
  return currentState?.grill_editor.items.find((item) => item.item_id === itemId);
}

export function findGrillFamily(familyId: string): GrillFamilyState | undefined {
  return currentState?.grill_editor.families.find((family) => family.family_id === familyId);
}

function getEffectiveFixedSection(editor: CatalogEditorState): CatalogSectionState | undefined {
  return editor.sections.find((section) => section.section_id === fixedSectionFilter)
    ?? editor.sections[0];
}

function getFixedOptionsOnlyRule(sectionId: string): (typeof fixedOptionsOnlySectionRules)[number] | undefined {
  return fixedOptionsOnlySectionRules.find((rule) => rule.sectionId === sectionId);
}

function getFixedMenuEditMode(section: CatalogSectionState): FixedMenuEditMode {
  return getFixedOptionsOnlyRule(section.section_id) ? "options-only" : "items";
}

function getFixedSectionAdminTitle(section: CatalogSectionState): string {
  return getFixedOptionsOnlyRule(section.section_id)?.title ?? section.title;
}

function getFixedSectionGroups(
  editor: CatalogEditorState,
  sectionId: string,
): CatalogGroupState[] {
  return editor.groups.filter((group) => group.section_id === sectionId);
}

function getEffectiveFixedGroup(
  editor: CatalogEditorState,
  sectionId: string,
): CatalogGroupState | undefined {
  const groups = getFixedSectionGroups(editor, sectionId);

  return groups.find((group) => group.group_id === fixedGroupFilter) ?? groups[0];
}

function getFixedLocationItems(
  editor: CatalogEditorState,
  section: CatalogSectionState,
  group: CatalogGroupState | undefined,
): CatalogItemState[] {
  const groupId = section.content_kind === "groups" ? group?.group_id : "";
  const optionsOnlyRule = getFixedOptionsOnlyRule(section.section_id);

  if (groupId === undefined) {
    return [];
  }

  return editor.items.filter((item) =>
    item.section_id === section.section_id
    && item.group_id === groupId
    && (!optionsOnlyRule || optionsOnlyRule.itemIds.includes(item.item_id))
  );
}

