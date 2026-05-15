type StaffRole = "availability_editor" | "menu_editor" | "admin";
type ServiceKind = "daily-menu" | "grill";
type TargetKind = "daily-menu" | "grill" | "catalog";
type AdminTabId = "availability" | "daily" | "grill" | "prices" | "publish";
type StatusTone = "neutral" | "success" | "danger";
type AvailabilityScope = "availability" | "daily" | "grill";

interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface StaffState {
  user_id: string;
  display_name: string;
  role: StaffRole;
  profile_id: string | null;
  active: boolean;
}

interface PermissionState {
  can_edit_availability: boolean;
  can_edit_menu_content: boolean;
  can_publish_menu: boolean;
  can_manage_staff: boolean;
}

interface ProfileState {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  can_edit_availability: boolean;
}

interface ServiceSettingState {
  profile_id: string;
  service_kind: ServiceKind;
}

interface DailyMenuState {
  item_id: string;
  name: string;
  description: string | null;
  note: string | null;
  pricing_key: string;
  order_index: number;
}

interface AvailabilityTargetState {
  menu_id: string;
  profile_title: string;
  target_kind: TargetKind;
  section_id: string;
  section_title: string;
  group_id: string;
  group_title: string | null;
  item_id: string;
  name: string;
  description: string | null;
  base_available: boolean;
  price_amount: number | null;
}

interface AvailabilityOverlayState {
  menu_id: string;
  section_id: string;
  group_id: string;
  item_id: string;
  available_override: boolean;
  updated_at: string;
}

interface FixedPriceState {
  pricing_key: string;
  amount: number;
}

interface VariantPriceState {
  pricing_key: string;
  variant_id: string;
  name: string;
  amount: number;
  order_index: number;
}

interface AdminOperationalState {
  ok: boolean;
  message: string;
  staff: StaffState | null;
  permissions: PermissionState;
  profiles: ProfileState[];
  service_settings: ServiceSettingState[];
  daily_menu: DailyMenuState[];
  availability_targets: AvailabilityTargetState[];
  availability_overlays: AvailabilityOverlayState[];
  prices: {
    fixed: FixedPriceState[];
    variants: VariantPriceState[];
  };
}

interface RpcResult {
  ok: boolean;
  changed: boolean;
  requires_redeploy: boolean;
  operation: string;
  message: string;
  cooldown_seconds_remaining?: number;
}

interface StatusMessage {
  text: string;
  tone: StatusTone;
}

interface GrillProfileGroup {
  menuId: string;
  profileTitle: string;
  families: GrillFamilyGroup[];
}

interface GrillFamilyGroup {
  title: string;
  targets: AvailabilityTargetState[];
}

interface PricingLabel {
  title: string;
  tags: string[];
}

const rootElement = document.querySelector<HTMLElement>("[data-admin-root]");
const localStorageKey = "el-faraon-admin-session";
const regularDailyId = "menu-del-dia";
const vegetarianDailyId = "menu-vegetariano-del-dia";

const supabaseUrl = normalizeSupabaseProjectUrl(import.meta.env.PUBLIC_SUPABASE_URL);
const supabaseAnonKey = getTrimmedValue(import.meta.env.PUBLIC_SUPABASE_ANON_KEY);
const configuredSupabaseUrl = supabaseUrl ?? "";
const configuredSupabaseAnonKey = supabaseAnonKey ?? "";

let currentSession: AuthSession | null = null;
let currentState: AdminOperationalState | null = null;
let currentStatus: StatusMessage | null = null;
let currentBusyText: string | null = null;
let activeTab: AdminTabId = "daily";
let hasPendingPublication = false;
let isBusy = false;
let availabilityProfileFilter = "";
let dailyProfileFilter = "";
let grillProfileFilter = "";
let availabilityGroupFilter = "";
let dailyGroupFilter = "";
let grillGroupFilter = "";

if (!rootElement) {
  throw new Error("Admin root element was not found.");
}

const root: HTMLElement = rootElement;

root.addEventListener("click", (event) => {
  const target = event.target instanceof Element
    ? event.target.closest<HTMLElement>("[data-admin-action]")
    : null;

  if (!target || !root.contains(target)) {
    return;
  }

  event.preventDefault();
  void handleAction(target).catch(handleUnexpectedError);
});

root.addEventListener("submit", (event) => {
  const form = event.target instanceof HTMLFormElement ? event.target : null;

  if (!form) {
    return;
  }

  event.preventDefault();
  void handleFormSubmit(form).catch(handleUnexpectedError);
});

root.addEventListener("change", (event) => {
  const field = event.target instanceof HTMLSelectElement ? event.target : null;

  if (!field?.dataset.adminFilter) {
    return;
  }

  if (field.dataset.adminFilter === "availability-profile") {
    availabilityProfileFilter = field.value;
  }

  if (field.dataset.adminFilter === "availability-group") {
    availabilityGroupFilter = field.value;
  }

  if (field.dataset.adminFilter === "daily-profile") {
    dailyProfileFilter = field.value;
  }

  if (field.dataset.adminFilter === "daily-group") {
    dailyGroupFilter = field.value;
  }

  if (field.dataset.adminFilter === "grill-profile") {
    grillProfileFilter = field.value;
  }

  if (field.dataset.adminFilter === "grill-group") {
    grillGroupFilter = field.value;
  }

  renderAuthenticated();
});

void startAdmin().catch(handleUnexpectedError);

async function startAdmin(): Promise<void> {
  if (!supabaseUrl || !supabaseAnonKey) {
    renderConfigurationError();
    return;
  }

  currentSession = await getValidSession();

  if (!currentSession) {
    renderLogin();
    return;
  }

  await loadAdminState();
}

async function handleAction(target: HTMLElement): Promise<void> {
  const action = target.dataset.adminAction;

  if (action === "logout") {
    await logout();
    return;
  }

  if (action === "reload") {
    await runBusy(async () => {
      await loadAdminState("Estado actualizado.", "success");
    }, "Actualizando estado...");
    return;
  }

  if (action === "tab") {
    const tab = target.dataset.adminTab as AdminTabId | undefined;

    if (tab) {
      activeTab = tab;
      renderAuthenticated();
    }

    return;
  }

  if (action === "set-overlay") {
    const targetKey = target.dataset.targetKey;
    const available = target.dataset.available === "true";
    const availabilityTarget = targetKey ? findAvailabilityTarget(targetKey) : undefined;

    if (!availabilityTarget) {
      setStatus("No se encontro el item seleccionado.", "danger");
      return;
    }

    if (available) {
      await clearAvailabilityOverlay(availabilityTarget);
    } else {
      await saveAvailabilityOverlay(availabilityTarget, false);
    }

    return;
  }

  if (action === "clear-overlay") {
    const targetKey = target.dataset.targetKey;
    const availabilityTarget = targetKey ? findAvailabilityTarget(targetKey) : undefined;

    if (!availabilityTarget) {
      setStatus("No se encontro el item seleccionado.", "danger");
      return;
    }

    await clearAvailabilityOverlay(availabilityTarget);
    return;
  }

  if (action === "publish") {
    await publishChanges();
  }
}

async function handleFormSubmit(form: HTMLFormElement): Promise<void> {
  const formKind = form.dataset.adminForm;

  if (formKind === "login") {
    await login(form);
    return;
  }

  if (!currentSession) {
    renderLogin();
    return;
  }

  if (formKind === "daily-menu") {
    await saveDailyMenu(form);
    return;
  }

  if (formKind === "service-kind") {
    await saveServiceKind(form);
    return;
  }

  if (formKind === "fixed-price") {
    await saveFixedPrice(form);
    return;
  }

  if (formKind === "variant-price") {
    await saveVariantPrice(form);
  }
}

async function login(form: HTMLFormElement): Promise<void> {
  const email = getFormString(form, "email");
  const password = getFormString(form, "password");

  if (!email || !password) {
    setStatus("Completa email y contrasena.", "danger");
    renderLogin();
    return;
  }

  await runBusy(async () => {
    const response = await fetch(`${configuredSupabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: configuredSupabaseAnonKey,
        "Content-Type": "application/json",
      },
      credentials: "omit",
      body: JSON.stringify({ email, password }),
    });

    const body = await readJsonBody(response);

    if (!response.ok || !isAuthResponse(body)) {
      throw new Error("No se pudo iniciar sesion.");
    }

    currentSession = createSession(body);
    saveStoredSession(currentSession);
    await loadAdminState("Sesion iniciada.", "success");
  }, "Iniciando sesion...");
}

async function logout(): Promise<void> {
  const session = currentSession;
  clearStoredSession();
  currentSession = null;
  currentState = null;
  hasPendingPublication = false;

  if (session) {
    await fetch(`${configuredSupabaseUrl}/auth/v1/logout`, {
      method: "POST",
      headers: {
        apikey: configuredSupabaseAnonKey,
        Authorization: `Bearer ${session.accessToken}`,
      },
      credentials: "omit",
    }).catch(() => undefined);
  }

  currentStatus = { text: "Sesion cerrada.", tone: "success" };
  renderLogin();
}

async function loadAdminState(
  statusText?: string,
  statusTone: StatusTone = "neutral",
): Promise<void> {
  const state = await callRpc<AdminOperationalState>("get_admin_operational_state", {});
  currentState = normalizeAdminState(state);
  currentStatus = statusText ? { text: statusText, tone: statusTone } : currentStatus;
  ensureActiveTab();
  renderAuthenticated();
}

async function saveAvailabilityOverlay(
  target: AvailabilityTargetState,
  available: boolean,
): Promise<void> {
  await runBusy(async () => {
    const result = await callMutation("set_menu_availability_overlay", {
      menu_id: target.menu_id,
      section_id: target.section_id,
      group_id: target.group_id || null,
      item_id: target.item_id,
      available_override: available,
    });

    if (!result.ok) {
      throw new Error(resultMessage(result));
    }

    await loadAdminState(result.changed ? "Disponibilidad actualizada." : "Sin cambios.", "success");
  }, available ? "Marcando disponible..." : "Marcando no disponible...");
}

async function clearAvailabilityOverlay(target: AvailabilityTargetState): Promise<void> {
  await runBusy(async () => {
    const result = await callMutation("clear_menu_availability_overlay", {
      menu_id: target.menu_id,
      section_id: target.section_id,
      group_id: target.group_id || null,
      item_id: target.item_id,
    });

    if (!result.ok) {
      throw new Error(resultMessage(result));
    }

    await loadAdminState(result.changed ? "Ajuste eliminado." : "Sin cambios.", "success");
  }, "Limpiando ajuste...");
}

async function saveDailyMenu(form: HTMLFormElement): Promise<void> {
  await runBusy(async () => {
    const result = await callMutation("set_daily_menu", {
      regular_name: getFormString(form, "regular_name"),
      regular_description: getNullableFormString(form, "regular_description"),
      regular_note: getNullableFormString(form, "regular_note"),
      vegetarian_name: getFormString(form, "vegetarian_name"),
      vegetarian_description: getNullableFormString(form, "vegetarian_description"),
      vegetarian_note: getNullableFormString(form, "vegetarian_note"),
    });

    if (!result.ok) {
      throw new Error(resultMessage(result));
    }

    markPendingIfNeeded(result);
    await loadAdminState(
      result.changed ? "Guardado. Falta publicar para verlo en el menu." : "Sin cambios.",
      "success",
    );
  }, "Guardando menu del dia...");
}

async function saveServiceKind(form: HTMLFormElement): Promise<void> {
  await runBusy(async () => {
    const result = await callMutation("set_profile_service_kind", {
      profile_id: getFormString(form, "profile_id"),
      service_kind: getFormString(form, "service_kind"),
    });

    if (!result.ok) {
      throw new Error(resultMessage(result));
    }

    markPendingIfNeeded(result);
    await loadAdminState(
      result.changed ? "Servicio guardado. Falta publicar." : "Sin cambios.",
      "success",
    );
  }, "Guardando servicio...");
}

async function saveFixedPrice(form: HTMLFormElement): Promise<void> {
  await runBusy(async () => {
    const result = await callMutation("set_global_fixed_price", {
      pricing_key: getFormString(form, "pricing_key"),
      amount: getFormInteger(form, "amount"),
    });

    if (!result.ok) {
      throw new Error(resultMessage(result));
    }

    markPendingIfNeeded(result);
    await loadAdminState(
      result.changed ? "Precio guardado. Falta publicar." : "Sin cambios.",
      "success",
    );
  }, "Guardando precio...");
}

async function saveVariantPrice(form: HTMLFormElement): Promise<void> {
  await runBusy(async () => {
    const pricingKey = getFormString(form, "pricing_key");
    const variantId = getFormString(form, "variant_id");

    const result = await callMutation("set_global_price_variant", {
      pricing_key: pricingKey,
      variant_id: variantId,
      amount: getFormInteger(form, "amount"),
    });

    if (!result.ok) {
      throw new Error(resultMessage(result));
    }

    markPendingIfNeeded(result);
    await loadAdminState(
      result.changed ? "Variante guardada. Falta publicar." : "Sin cambios.",
      "success",
    );
  }, "Guardando variante...");
}

async function publishChanges(): Promise<void> {
  await runBusy(async () => {
    const session = await requireSession();
    const response = await fetch(`${configuredSupabaseUrl}/functions/v1/publish-menu-changes`, {
      method: "POST",
      headers: {
        apikey: configuredSupabaseAnonKey,
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
      },
      credentials: "omit",
    });
    const body = await readJsonBody(response);
    const result = isRpcResult(body) ? body : null;

    if (!response.ok || !result?.ok) {
      throw new Error(result ? resultMessage(result) : "No se pudo publicar.");
    }

    if (result.message === "publish_queued") {
      hasPendingPublication = false;
      await loadAdminState("Publicacion solicitada. El deploy puede tardar unos minutos.", "success");
      return;
    }

    if (result.message === "publish_recently_queued") {
      hasPendingPublication = true;
      await loadAdminState(
        `Ya hay una publicacion reciente encolada${formatCooldownSuffix(result)}. El cambio queda guardado; volve a publicar cuando termine el cooldown.`,
        "neutral",
      );
      return;
    }

    await loadAdminState(resultMessage(result), "success");
  }, "Publicando cambios...");
}

async function callMutation(name: string, body: Record<string, unknown>): Promise<RpcResult> {
  const response = await callRpc<unknown>(name, body);
  const result = Array.isArray(response) ? response[0] : response;

  if (!isRpcResult(result)) {
    throw new Error("Respuesta inesperada de Supabase.");
  }

  return result;
}

async function callRpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const session = await requireSession();
  const response = await fetch(`${configuredSupabaseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: configuredSupabaseAnonKey,
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
    },
    credentials: "omit",
    body: JSON.stringify(body),
  });
  const responseBody = await readJsonBody(response);

  if (response.status === 401) {
    clearStoredSession();
    currentSession = null;
    currentState = null;
    throw new Error("La sesion expiro. Volve a iniciar sesion.");
  }

  if (!response.ok) {
    throw new Error(readErrorMessage(responseBody));
  }

  return responseBody as T;
}

async function requireSession(): Promise<AuthSession> {
  const session = await getValidSession();

  if (!session) {
    renderLogin();
    throw new Error("La sesion expiro. Volve a iniciar sesion.");
  }

  currentSession = session;
  return session;
}

async function getValidSession(): Promise<AuthSession | null> {
  const storedSession = readStoredSession();

  if (!storedSession) {
    return null;
  }

  if (storedSession.expiresAt - Date.now() > 60_000) {
    return storedSession;
  }

  return refreshSession(storedSession);
}

async function refreshSession(session: AuthSession): Promise<AuthSession | null> {
  const response = await fetch(`${configuredSupabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: {
      apikey: configuredSupabaseAnonKey,
      "Content-Type": "application/json",
    },
    credentials: "omit",
    body: JSON.stringify({ refresh_token: session.refreshToken }),
  });
  const body = await readJsonBody(response);

  if (!response.ok || !isAuthResponse(body)) {
    clearStoredSession();
    return null;
  }

  const refreshedSession = createSession(body);
  saveStoredSession(refreshedSession);
  return refreshedSession;
}

function renderConfigurationError(): void {
  root.innerHTML = `
    <section class="admin-denied">
      <p class="admin-kicker">Panel operativo</p>
      <h1 class="admin-title">Configuracion incompleta</h1>
      <div class="admin-denied__panel">
        <p class="admin-muted">Faltan las variables publicas de Supabase para cargar el admin.</p>
      </div>
    </section>
  `;
}

function renderLogin(): void {
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
      </form>
    </section>
  `;
}

function renderAuthenticated(): void {
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
            <p class="admin-header__copy">Gestion diaria de menu del dia, parrilla, disponibilidad, precios y publicacion.</p>
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
          <button class="admin-button admin-button--secondary" type="button" data-admin-action="reload" ${isBusy ? "disabled" : ""}>Reintentar</button>
          <button class="admin-button" type="button" data-admin-action="logout" ${isBusy ? "disabled" : ""}>Salir</button>
        </div>
      </div>
    </section>
  `;
}

function renderActiveTab(state: AdminOperationalState): string {
  if (activeTab === "availability") {
    return renderAvailabilityTab(state);
  }

  if (activeTab === "daily") {
    return renderDailyTab(state);
  }

  if (activeTab === "grill") {
    return renderGrillTab(state);
  }

  if (activeTab === "prices") {
    return renderPricesTab(state);
  }

  return renderPublishTab(state);
}

function renderAvailabilityTab(state: AdminOperationalState): string {
  return `
    <section class="admin-section">
      <div class="admin-section__header">
        <h2 class="admin-section__title">Disponibilidad</h2>
        <p class="admin-section__copy">Disponibilidad runtime del catalogo general. Se aplica sin publicar.</p>
      </div>
      ${renderAvailabilityFilters(state, "availability")}
      ${renderAvailabilityRows(state, "catalog")}
    </section>
  `;
}

function renderDailyTab(state: AdminOperationalState): string {
  const regular = findDailyItem(state, regularDailyId);
  const vegetarian = findDailyItem(state, vegetarianDailyId);
  const serviceEditor = state.permissions.can_edit_menu_content;
  const availabilityEditor = state.permissions.can_edit_availability;

  return `
    <section class="admin-section">
      <div class="admin-section__header">
        <h2 class="admin-section__title">Menu del dia</h2>
        <p class="admin-section__copy">Contenido build-time del menu del dia.</p>
      </div>
      ${serviceEditor ? `
        <form class="admin-form-grid" data-admin-form="daily-menu">
          ${renderDailyFieldset("Menu regular", "regular", regular)}
          ${renderDailyFieldset("Menu vegetariano", "vegetarian", vegetarian)}
          <div class="admin-row admin-callout">
            <div class="admin-row__main">
              <p class="admin-row__title">Guardar menu del dia</p>
              <p class="admin-row__meta">Actualiza las dos opciones visibles del servicio diario.</p>
            </div>
            <div class="admin-row__actions">
              <button class="admin-button" type="submit" ${isBusy ? "disabled" : ""}>Guardar menu del dia</button>
            </div>
          </div>
        </form>
      ` : ""}
      ${availabilityEditor ? `
        ${renderAvailabilityFilters(state, "daily")}
        ${renderAvailabilityRows(state, "daily-menu")}
      ` : ""}
      ${!serviceEditor && !availabilityEditor ? renderEmpty("No hay acciones de menu del dia disponibles para este rol.") : ""}
    </section>
  `;
}

function renderGrillTab(state: AdminOperationalState): string {
  const serviceEditor = state.permissions.can_edit_menu_content;
  const availabilityEditor = state.permissions.can_edit_availability;

  return `
    <section class="admin-section">
      <div class="admin-section__header">
        <h2 class="admin-section__title">Parrilla</h2>
        <p class="admin-section__copy">Activar parrilla por local requiere publicar. La disponibilidad de items es runtime.</p>
      </div>
      ${serviceEditor ? renderServiceKindForms(state) : ""}
      ${availabilityEditor ? `
        ${renderAvailabilityFilters(state, "grill")}
        ${renderGrillAvailabilityRows(state)}
      ` : ""}
      ${!serviceEditor && !availabilityEditor ? renderEmpty("No hay acciones de parrilla disponibles para este rol.") : ""}
    </section>
  `;
}

function renderPricesTab(state: AdminOperationalState): string {
  const fixedRows = state.prices.fixed;
  const variantRows = state.prices.variants;

  return `
    <section class="admin-section">
      <div class="admin-section__header">
        <h2 class="admin-section__title">Precios</h2>
        <p class="admin-section__copy">Precios globales. Guardar requiere publicar para verse en el menu publico.</p>
      </div>
      <div class="admin-price-grid">
        <div class="admin-grid">
          <p class="admin-kicker">Precios fijos</p>
          ${fixedRows.length > 0 ? fixedRows.map(renderFixedPriceRow).join("") : renderEmpty("No hay precios fijos editables.")}
        </div>
        <div class="admin-grid">
          <p class="admin-kicker">Variantes</p>
          ${variantRows.length > 0 ? variantRows.map(renderVariantPriceRow).join("") : renderEmpty("No hay variantes editables.")}
        </div>
      </div>
    </section>
  `;
}

function renderPublishTab(state: AdminOperationalState): string {
  return `
    <section class="admin-section">
      <div class="admin-section__header">
        <h2 class="admin-section__title">Publicacion</h2>
        <p class="admin-section__copy">Publicar encola un deploy. No confirma que Vercel haya terminado.</p>
      </div>
      <div class="admin-row">
        <div class="admin-row__main">
          <p class="admin-row__title">${hasPendingPublication ? "Hay cambios guardados por publicar" : "Sin cambios pendientes detectados en esta sesion"}</p>
          <p class="admin-row__meta">Despues de publicar, el menu publico puede tardar unos minutos en reflejar cambios build-time.</p>
        </div>
        <div class="admin-row__actions">
          <button class="admin-button" type="button" data-admin-action="publish" ${isBusy || !state.permissions.can_publish_menu ? "disabled" : ""}>Publicar cambios</button>
          <button class="admin-button admin-button--secondary" type="button" data-admin-action="reload" ${isBusy ? "disabled" : ""}>Actualizar estado</button>
        </div>
      </div>
    </section>
  `;
}

function renderPublishBanner(state: AdminOperationalState): string {
  if (!hasPendingPublication || !state.permissions.can_publish_menu) {
    return "";
  }

  return `
    <div class="admin-banner">
      <span>Hay cambios guardados que requieren publicacion.</span>
      <button class="admin-button" type="button" data-admin-action="publish" ${isBusy ? "disabled" : ""}>Publicar cambios</button>
    </div>
  `;
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

function renderAvailabilityFilters(
  state: AdminOperationalState,
  scope: AvailabilityScope,
): string {
  const profileFilter = getEffectiveAvailabilityProfileFilter(state, scope);
  const groupFilter = getAvailabilityGroupFilter(scope);
  const profileOptions = getEditableAvailabilityProfiles(state);
  const groupOptions = getAvailabilityGroupOptions(
    getAvailabilityScopeTargets(state, getAvailabilityKindLimit(scope)).filter((target) =>
      target.menu_id === profileFilter
    ),
  );

  return `
    <div class="admin-toolbar">
      <label class="admin-field">
        <span class="admin-label">Local</span>
        <select class="admin-select" data-admin-filter="${getAvailabilityProfileFilterName(scope)}">
          ${profileOptions
            .map((profile) => `<option value="${escapeHtml(profile.id)}" ${profileFilter === profile.id ? "selected" : ""}>${escapeHtml(profile.title)}</option>`)
            .join("")}
        </select>
      </label>
      <label class="admin-field">
        <span class="admin-label">Familia / grupo</span>
        <select class="admin-select" data-admin-filter="${getAvailabilityGroupFilterName(scope)}">
          <option value="">Todos</option>
          ${groupOptions
            .map((option) => `<option value="${escapeHtml(option.key)}" ${groupFilter === option.key ? "selected" : ""}>${escapeHtml(option.label)}</option>`)
            .join("")}
        </select>
      </label>
    </div>
  `;
}

function getAvailabilityProfileFilter(scope: AvailabilityScope): string {
  if (scope === "daily") {
    return dailyProfileFilter;
  }

  if (scope === "grill") {
    return grillProfileFilter;
  }

  return availabilityProfileFilter;
}

function getEditableAvailabilityProfiles(state: AdminOperationalState): ProfileState[] {
  return state.profiles.filter((profile) => profile.can_edit_availability);
}

function getEffectiveAvailabilityProfileFilter(
  state: AdminOperationalState,
  scope: AvailabilityScope,
): string {
  const profileFilter = getAvailabilityProfileFilter(scope);
  const editableProfiles = getEditableAvailabilityProfiles(state);

  if (editableProfiles.some((profile) => profile.id === profileFilter)) {
    return profileFilter;
  }

  return editableProfiles[0]?.id ?? "";
}

function getAvailabilityProfileFilterName(scope: AvailabilityScope): string {
  if (scope === "daily") {
    return "daily-profile";
  }

  if (scope === "grill") {
    return "grill-profile";
  }

  return "availability-profile";
}

function getAvailabilityGroupFilter(scope: AvailabilityScope): string {
  if (scope === "daily") {
    return dailyGroupFilter;
  }

  if (scope === "grill") {
    return grillGroupFilter;
  }

  return availabilityGroupFilter;
}

function getAvailabilityGroupFilterName(scope: AvailabilityScope): string {
  if (scope === "daily") {
    return "daily-group";
  }

  if (scope === "grill") {
    return "grill-group";
  }

  return "availability-group";
}

function getAvailabilityKindLimit(scope: AvailabilityScope): TargetKind | undefined {
  if (scope === "daily") {
    return "daily-menu";
  }

  if (scope === "grill") {
    return "grill";
  }

  return "catalog";
}

function getAvailabilityScopeForKindLimit(kindLimit: TargetKind | undefined): AvailabilityScope {
  if (kindLimit === "daily-menu") {
    return "daily";
  }

  if (kindLimit === "grill") {
    return "grill";
  }

  return "availability";
}

function getAvailabilityScopeTargets(
  state: AdminOperationalState,
  kindLimit: TargetKind | undefined,
): AvailabilityTargetState[] {
  return state.availability_targets.filter((target) => !kindLimit || target.target_kind === kindLimit);
}

function getAvailabilityGroupKey(target: AvailabilityTargetState): string {
  if (target.group_title) {
    return `group:${target.section_id}:${target.group_id}`;
  }

  return `section:${target.section_id}`;
}

function getAvailabilityGroupLabel(target: AvailabilityTargetState): string {
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

function renderAvailabilityRows(
  state: AdminOperationalState,
  kindLimit: TargetKind | undefined,
): string {
  const profileFilter = getEffectiveAvailabilityProfileFilter(
    state,
    getAvailabilityScopeForKindLimit(kindLimit),
  );
  const groupFilter = kindLimit === "daily-menu"
    ? dailyGroupFilter
    : kindLimit === "grill"
      ? grillGroupFilter
      : availabilityGroupFilter;
  const scopeTargets = getAvailabilityScopeTargets(state, kindLimit);
  const targets = scopeTargets.filter((target) =>
    target.menu_id === profileFilter
    && (!groupFilter || getAvailabilityGroupKey(target) === groupFilter)
  );

  if (targets.length === 0) {
    return renderEmpty(
      scopeTargets.length > 0
        ? "No hay items para los filtros seleccionados."
        : "No hay items disponibles para este rol.",
    );
  }

  return `
    <div class="admin-list-header">
      <span>${targets.length} items</span>
      <span>Los cambios se aplican al instante.</span>
    </div>
    <div class="admin-grid">${targets.map((target) => renderAvailabilityRow(state, target)).join("")}</div>
  `;
}

function renderGrillAvailabilityRows(state: AdminOperationalState): string {
  const profileFilter = getEffectiveAvailabilityProfileFilter(state, "grill");
  const scopeTargets = getAvailabilityScopeTargets(state, "grill");
  const targets = scopeTargets.filter((target) =>
    target.menu_id === profileFilter
  ).filter((target) =>
    !grillGroupFilter || getAvailabilityGroupKey(target) === grillGroupFilter
  );

  if (targets.length === 0) {
    return renderEmpty(
      scopeTargets.length > 0
        ? "No hay variantes para los filtros seleccionados."
        : "No hay variantes de parrilla disponibles para este rol.",
    );
  }

  return `
    <div class="admin-list-header">
      <span>${targets.length} variantes</span>
      <span>Los cambios se aplican al instante.</span>
    </div>
    <div class="admin-grill-groups">
      ${groupGrillTargets(targets).map((profileGroup) => `
        <section class="admin-grill-profile">
          <div class="admin-grill-profile__header">
            <p class="admin-kicker">Local</p>
            <h3 class="admin-grill-profile__title">${escapeHtml(profileGroup.profileTitle)}</h3>
          </div>
          ${profileGroup.families.map((family) => `
            <section class="admin-family">
              <div class="admin-family__header">
                <h4 class="admin-family__title">${escapeHtml(family.title)}</h4>
                <span class="admin-family__count">${family.targets.length} variantes</span>
              </div>
              <div class="admin-family__variants">
                ${family.targets.map((target) => renderGrillAvailabilityVariant(state, target)).join("")}
              </div>
            </section>
          `).join("")}
        </section>
      `).join("")}
    </div>
  `;
}

function renderGrillAvailabilityVariant(
  state: AdminOperationalState,
  target: AvailabilityTargetState,
): string {
  const overlay = findOverlay(state, target);
  const effectiveAvailable = overlay ? overlay.available_override : target.base_available;
  const key = getTargetKey(target);
  const availableDisabled = isBusy || effectiveAvailable;
  const unavailableDisabled = isBusy || !effectiveAvailable;
  const priceText = formatOptionalAmount(target.price_amount);

  return `
    <div class="admin-row admin-variant-row">
      <div class="admin-row__main">
        <div class="admin-variant-heading">
          <p class="admin-row__title">${escapeHtml(target.name)}</p>
          ${priceText ? `<span class="admin-variant-price">${escapeHtml(priceText)}</span>` : ""}
        </div>
        ${target.description ? `<p class="admin-row__meta">${escapeHtml(target.description)}</p>` : ""}
        <div class="admin-row__status">
          <span class="admin-pill" data-tone="${effectiveAvailable ? "success" : "danger"}">${effectiveAvailable ? "Disponible" : "No disponible"}</span>
        </div>
      </div>
      <div class="admin-row__actions">
        <button class="admin-button admin-button--secondary" type="button" data-admin-action="set-overlay" data-target-key="${escapeHtml(key)}" data-available="true" data-current="${effectiveAvailable ? "true" : "false"}" aria-pressed="${effectiveAvailable ? "true" : "false"}" ${availableDisabled ? "disabled" : ""}>Disponible</button>
        <button class="admin-button admin-button--danger" type="button" data-admin-action="set-overlay" data-target-key="${escapeHtml(key)}" data-available="false" data-current="${!effectiveAvailable ? "true" : "false"}" aria-pressed="${!effectiveAvailable ? "true" : "false"}" ${unavailableDisabled ? "disabled" : ""}>No disponible</button>
      </div>
    </div>
  `;
}

function renderAvailabilityRow(
  state: AdminOperationalState,
  target: AvailabilityTargetState,
): string {
  const overlay = findOverlay(state, target);
  const effectiveAvailable = overlay ? overlay.available_override : target.base_available;
  const key = getTargetKey(target);
  const availableDisabled = isBusy || effectiveAvailable;
  const unavailableDisabled = isBusy || !effectiveAvailable;

  return `
    <div class="admin-row">
      <div class="admin-row__main">
        <p class="admin-row__title">${escapeHtml(target.name)}</p>
        <p class="admin-row__meta">
          ${escapeHtml(target.profile_title)} &middot; ${escapeHtml(target.section_title)}
          ${target.group_title ? ` &middot; ${escapeHtml(target.group_title)}` : ""}
        </p>
        ${target.description ? `<p class="admin-row__meta">${escapeHtml(target.description)}</p>` : ""}
        <div class="admin-row__status">
          <span class="admin-pill" data-tone="${effectiveAvailable ? "success" : "danger"}">${effectiveAvailable ? "Disponible" : "No disponible"}</span>
        </div>
      </div>
      <div class="admin-row__actions">
        <button class="admin-button admin-button--secondary" type="button" data-admin-action="set-overlay" data-target-key="${escapeHtml(key)}" data-available="true" data-current="${effectiveAvailable ? "true" : "false"}" aria-pressed="${effectiveAvailable ? "true" : "false"}" ${availableDisabled ? "disabled" : ""}>Disponible</button>
        <button class="admin-button admin-button--danger" type="button" data-admin-action="set-overlay" data-target-key="${escapeHtml(key)}" data-available="false" data-current="${!effectiveAvailable ? "true" : "false"}" aria-pressed="${!effectiveAvailable ? "true" : "false"}" ${unavailableDisabled ? "disabled" : ""}>No disponible</button>
      </div>
    </div>
  `;
}

function renderDailyFieldset(
  label: string,
  prefix: "regular" | "vegetarian",
  item: DailyMenuState | undefined,
): string {
  return `
    <fieldset class="admin-card">
      <legend class="admin-card__legend">${escapeHtml(label)}</legend>
      <label class="admin-field">
        <span class="admin-label">Nombre</span>
        <input class="admin-input" name="${prefix}_name" value="${escapeHtml(item?.name ?? "")}" required />
      </label>
      <label class="admin-field admin-field--wide">
        <span class="admin-label">Descripcion</span>
        <textarea class="admin-textarea" name="${prefix}_description">${escapeHtml(item?.description ?? "")}</textarea>
      </label>
      <label class="admin-field admin-field--wide">
        <span class="admin-label">Nota</span>
        <textarea class="admin-textarea" name="${prefix}_note">${escapeHtml(item?.note ?? "")}</textarea>
      </label>
    </fieldset>
  `;
}

function renderServiceKindForms(state: AdminOperationalState): string {
  if (state.profiles.length === 0) {
    return renderEmpty("No hay locales para configurar.");
  }

  return `
    <div class="admin-grid">
      <div class="admin-list-header">
        <span>Servicio activo por local</span>
        <span>Guardar requiere publicar.</span>
      </div>
      ${state.profiles.map((profile) => {
        const currentService = findServiceKind(state, profile.id);

        return `
          <form class="admin-row" data-admin-form="service-kind">
            <div class="admin-row__main">
              <p class="admin-row__title">${escapeHtml(profile.title)}</p>
              <p class="admin-row__meta">Cambiar este valor requiere publicacion.</p>
            </div>
            <div class="admin-row__actions">
              <input type="hidden" name="profile_id" value="${escapeHtml(profile.id)}" />
              <select class="admin-select" name="service_kind">
                <option value="daily-menu" ${currentService === "daily-menu" ? "selected" : ""}>Menu del dia</option>
                <option value="grill" ${currentService === "grill" ? "selected" : ""}>Parrilla</option>
              </select>
              <button class="admin-button" type="submit" ${isBusy ? "disabled" : ""}>Guardar</button>
            </div>
          </form>
        `;
      }).join("")}
    </div>
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

  if (state.permissions.can_edit_menu_content || state.permissions.can_edit_availability) {
    tabs.push({ id: "daily", label: "Menu del dia" });
  }

  if (state.permissions.can_edit_availability || state.permissions.can_edit_menu_content) {
    tabs.push({ id: "grill", label: "Parrilla" });
  }

  if (state.permissions.can_edit_availability) {
    tabs.push({ id: "availability", label: "Disponibilidad" });
  }

  if (state.permissions.can_edit_menu_content) {
    tabs.push({ id: "prices", label: "Precios" });
  }

  if (state.permissions.can_publish_menu) {
    tabs.push({ id: "publish", label: "Publicacion" });
  }

  return tabs;
}

function ensureActiveTab(): void {
  if (!currentState) {
    return;
  }

  const allowedTabs = getAllowedTabs(currentState);

  if (!allowedTabs.some((tab) => tab.id === activeTab)) {
    activeTab = allowedTabs[0]?.id ?? "availability";
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

function findOverlay(
  state: AdminOperationalState,
  target: AvailabilityTargetState,
): AvailabilityOverlayState | undefined {
  return state.availability_overlays.find((overlay) => getOverlayKey(overlay) === getTargetKey(target));
}

function findAvailabilityTarget(key: string): AvailabilityTargetState | undefined {
  return currentState?.availability_targets.find((target) => getTargetKey(target) === key);
}

function getTargetKey(target: {
  menu_id: string;
  section_id: string;
  group_id: string;
  item_id: string;
}): string {
  return `${target.menu_id}/${target.section_id}/${target.group_id}/${target.item_id}`;
}

function getOverlayKey(overlay: {
  menu_id: string;
  section_id: string;
  group_id: string;
  item_id: string;
}): string {
  return `${overlay.menu_id}/${overlay.section_id}/${overlay.group_id}/${overlay.item_id}`;
}

function markPendingIfNeeded(result: RpcResult): void {
  if (result.ok && result.changed && result.requires_redeploy) {
    hasPendingPublication = true;
  }
}

function setStatus(text: string, tone: StatusTone): void {
  currentStatus = { text, tone };

  if (currentSession && currentState) {
    renderAuthenticated();
  } else {
    renderLogin();
  }
}

async function runBusy(action: () => Promise<void>, busyText = "Procesando..."): Promise<void> {
  isBusy = true;
  currentBusyText = busyText;

  if (currentSession && currentState) {
    renderAuthenticated();
  } else {
    renderLogin();
  }

  try {
    await action();
  } catch (error) {
    currentBusyText = null;
    handleUnexpectedError(error);
  } finally {
    isBusy = false;
    currentBusyText = null;

    if (currentSession && currentState) {
      renderAuthenticated();
    } else {
      renderLogin();
    }
  }
}

function handleUnexpectedError(error: unknown): void {
  const message = error instanceof TypeError && error.message === "Failed to fetch"
    ? "No se pudo conectar. Revisa conexion y origen autorizado."
    : error instanceof Error
      ? error.message
      : "Ocurrio un error inesperado.";
  currentStatus = { text: message, tone: "danger" };

  if (currentSession && currentState) {
    renderAuthenticated();
  } else {
    renderLogin();
  }
}

function normalizeAdminState(state: AdminOperationalState): AdminOperationalState {
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

function groupGrillTargets(targets: AvailabilityTargetState[]): GrillProfileGroup[] {
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

function roleLabel(role: StaffRole): string {
  if (role === "admin") {
    return "Admin";
  }

  if (role === "menu_editor") {
    return "Editor de menu";
  }

  return "Editor de disponibilidad";
}

function resultMessage(result: RpcResult): string {
  const messages: Record<string, string> = {
    permission_denied: "No tenes permisos para esta accion.",
    publish_queued: "Publicacion solicitada. El deploy puede tardar unos minutos.",
    publish_recently_queued: "Ya hay una publicacion reciente encolada.",
    publish_failed: "No se pudo publicar.",
    invalid_amount: "El importe no es valido.",
    daily_menu_name_required: "El nombre del menu es obligatorio.",
    daily_menu_available_required: "La disponibilidad del menu es obligatoria.",
    invalid_service_kind: "El servicio seleccionado no es valido.",
  };

  return messages[result.message] ?? result.message.replaceAll("_", " ");
}

function formatCooldownSuffix(result: RpcResult): string {
  const seconds = result.cooldown_seconds_remaining;

  if (typeof seconds !== "number" || !Number.isSafeInteger(seconds) || seconds < 0) {
    return "";
  }

  return ` (${seconds} segundos restantes)`;
}

function getFormString(form: HTMLFormElement, name: string): string {
  const value = new FormData(form).get(name);
  return typeof value === "string" ? value.trim() : "";
}

function getNullableFormString(form: HTMLFormElement, name: string): string | null {
  const value = getFormString(form, name);
  return value.length > 0 ? value : null;
}

function getFormInteger(form: HTMLFormElement, name: string): number {
  const value = Number(getFormString(form, name));

  if (!Number.isInteger(value) || value < 0) {
    throw new Error("El importe no es valido.");
  }

  return value;
}

function readStoredSession(): AuthSession | null {
  try {
    const rawValue = localStorage.getItem(localStorageKey);

    if (!rawValue) {
      return null;
    }

    const parsedValue: unknown = JSON.parse(rawValue);

    if (!isStoredSession(parsedValue)) {
      return null;
    }

    return parsedValue;
  } catch {
    return null;
  }
}

function saveStoredSession(session: AuthSession): void {
  localStorage.setItem(localStorageKey, JSON.stringify(session));
}

function clearStoredSession(): void {
  localStorage.removeItem(localStorageKey);
}

function createSession(body: AuthApiResponse): AuthSession {
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: Date.now() + body.expires_in * 1000,
  };
}

async function readJsonBody(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function readErrorMessage(body: unknown): string {
  if (body && typeof body === "object" && "message" in body) {
    const message = (body as { message?: unknown }).message;

    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return "No se pudo completar la operacion.";
}

function isRpcResult(value: unknown): value is RpcResult {
  return Boolean(
    value
      && typeof value === "object"
      && typeof (value as RpcResult).ok === "boolean"
      && typeof (value as RpcResult).changed === "boolean"
      && typeof (value as RpcResult).requires_redeploy === "boolean"
      && typeof (value as RpcResult).operation === "string"
      && typeof (value as RpcResult).message === "string",
  );
}

interface AuthApiResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: object;
}

function isAuthResponse(value: unknown): value is AuthApiResponse {
  return Boolean(
    value
      && typeof value === "object"
      && typeof (value as AuthApiResponse).access_token === "string"
      && typeof (value as AuthApiResponse).refresh_token === "string"
      && typeof (value as AuthApiResponse).expires_in === "number"
      && typeof (value as AuthApiResponse).user === "object",
  );
}

function isStoredSession(value: unknown): value is AuthSession {
  return Boolean(
    value
      && typeof value === "object"
      && typeof (value as AuthSession).accessToken === "string"
      && typeof (value as AuthSession).refreshToken === "string"
      && typeof (value as AuthSession).expiresAt === "number",
  );
}

function formatAmount(amount: number): string {
  return `$${new Intl.NumberFormat("es-AR").format(amount)}`;
}

function formatOptionalAmount(amount: number | null): string {
  return typeof amount === "number" && Number.isSafeInteger(amount) && amount >= 0
    ? formatAmount(amount)
    : "";
}

function formatPricingLabel(value: string, fallbackTag: string): PricingLabel {
  const parts = value.split(":").filter(Boolean);

  if (parts[0] === "catalog") {
    const section = formatIdLabel(parts[1] ?? "Catalogo");
    const groupIndex = parts.indexOf("group");
    const itemIndex = parts.indexOf("item");
    const labelPart = groupIndex >= 0
      ? parts[groupIndex + 1]
      : itemIndex >= 0
        ? parts[itemIndex + 1]
        : parts[1];

    return {
      title: formatIdLabel(labelPart ?? value),
      tags: ["Catalogo", section, fallbackTag],
    };
  }

  if (value.startsWith("parrilla-")) {
    return {
      title: formatIdLabel(value.replace(/^parrilla-/, "")),
      tags: ["Parrilla", fallbackTag],
    };
  }

  if (value.startsWith("menu-")) {
    return {
      title: formatIdLabel(value),
      tags: ["Menu del dia", fallbackTag],
    };
  }

  return {
    title: formatIdLabel(value.replace(/:price$/, "")),
    tags: ["Precio", fallbackTag],
  };
}

function formatIdLabel(value: string): string {
  return value
    .replace(/:price$/g, "")
    .replace(/:/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getTrimmedValue(value: string | undefined): string | undefined {
  const trimmedValue = value?.trim();
  return trimmedValue && trimmedValue.length > 0 ? trimmedValue : undefined;
}

function trimTrailingSlash(value: string | undefined): string | undefined {
  return getTrimmedValue(value)?.replace(/\/+$/, "");
}

function normalizeSupabaseProjectUrl(value: string | undefined): string | undefined {
  return trimTrailingSlash(value)?.replace(/\/(?:rest\/v1|auth\/v1|functions\/v1)$/, "");
}

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    if (character === "&") {
      return "&amp;";
    }

    if (character === "<") {
      return "&lt;";
    }

    if (character === ">") {
      return "&gt;";
    }

    if (character === "\"") {
      return "&quot;";
    }

    return "&#39;";
  });
}
