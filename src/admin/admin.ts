type StaffRole = "operator" | "admin";
type ServiceKind = "daily-menu" | "grill";
type TargetKind = "daily-menu" | "grill" | "catalog";
type AdminTabId = "availability" | "daily" | "grill" | "fixed" | "prices" | "publish" | "account";
type StatusTone = "neutral" | "success" | "danger";
type AvailabilityScope = "availability" | "daily" | "grill";
type CatalogContentKind = "items" | "groups";
type AuthView = "login" | "reset-request" | "set-password";

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

interface CatalogSectionState {
  section_id: string;
  title: string;
  content_kind: CatalogContentKind;
  order_index: number;
  item_count: number;
}

interface CatalogGroupState {
  section_id: string;
  group_id: string;
  title: string;
  pricing_key: string | null;
  order_index: number;
  item_count: number;
}

interface CatalogItemState {
  section_id: string;
  section_title: string;
  group_id: string;
  group_title: string | null;
  item_id: string;
  name: string;
  description: string | null;
  pricing_key: string | null;
  price_amount: number | null;
  order_index: number;
  option_count: number;
  options: CatalogItemOptionState[];
}

interface CatalogItemOptionState {
  section_id: string;
  group_id: string;
  item_id: string;
  option_id: string;
  name: string;
  order_index: number;
}

interface CatalogEditorState {
  sections: CatalogSectionState[];
  groups: CatalogGroupState[];
  items: CatalogItemState[];
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
  catalog_editor: CatalogEditorState;
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
let authView: AuthView = "login";
let hasPendingPublication = false;
let isBusy = false;
let availabilityProfileFilter = "";
let dailyProfileFilter = "";
let grillProfileFilter = "";
let availabilityGroupFilter = "";
let dailyGroupFilter = "";
let grillGroupFilter = "";
let fixedSectionFilter = "";
let fixedGroupFilter = "";

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

  if (field.dataset.adminFilter === "fixed-section") {
    fixedSectionFilter = field.value;
    fixedGroupFilter = "";
  }

  if (field.dataset.adminFilter === "fixed-group") {
    fixedGroupFilter = field.value;
  }

  renderAuthenticated();
});

root.addEventListener("input", (event) => {
  const field = event.target instanceof HTMLInputElement ? event.target : null;

  if (!field) {
    return;
  }

  handleCatalogItemInput(field);
  handleCatalogOptionInput(field);
});

void startAdmin().catch(handleUnexpectedError);

async function startAdmin(): Promise<void> {
  if (!supabaseUrl || !supabaseAnonKey) {
    renderConfigurationError();
    return;
  }

  const passwordSession = readPasswordSessionFromLocation();

  if (passwordSession) {
    currentSession = passwordSession;
    authView = "set-password";
    currentStatus = { text: "Defini una nueva contrasena para activar tu acceso.", tone: "neutral" };
    renderSetPassword();
    return;
  }

  currentSession = await getValidSession();

  if (!currentSession) {
    authView = "login";
    renderLogin();
    return;
  }

  await loadAdminState();
}

async function handleAction(target: HTMLElement): Promise<void> {
  const action = target.dataset.adminAction;

  if (action === "show-reset-request") {
    authView = "reset-request";
    currentStatus = null;
    renderPasswordResetRequest();
    return;
  }

  if (action === "show-login") {
    authView = "login";
    currentStatus = null;
    renderLogin();
    return;
  }

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

  if (action === "delete-catalog-item") {
    const sectionId = target.dataset.sectionId;
    const groupId = target.dataset.groupId ?? "";
    const itemId = target.dataset.itemId;
    const item = sectionId && itemId ? findCatalogItem(sectionId, groupId, itemId) : undefined;

    if (!item) {
      setStatus("No se encontro el item seleccionado.", "danger");
      return;
    }

    if (!confirmDeleteCatalogItem(item)) {
      return;
    }

    await deleteCatalogItem(item);
    return;
  }

  if (action === "delete-catalog-option") {
    const sectionId = target.dataset.sectionId;
    const groupId = target.dataset.groupId ?? "";
    const itemId = target.dataset.itemId;
    const optionId = target.dataset.optionId;
    const option = sectionId && itemId && optionId
      ? findCatalogItemOption(sectionId, groupId, itemId, optionId)
      : undefined;

    if (!option) {
      setStatus("No se encontro la opcion seleccionada.", "danger");
      return;
    }

    if (!confirmDeleteCatalogOption(option)) {
      return;
    }

    await deleteCatalogOption(option);
    return;
  }

  if (action === "publish") {
    if (!confirmPublishChanges()) {
      return;
    }

    await publishChanges();
  }
}

async function handleFormSubmit(form: HTMLFormElement): Promise<void> {
  const formKind = form.dataset.adminForm;

  if (formKind === "login") {
    await login(form);
    return;
  }

  if (formKind === "password-reset-request") {
    await requestPasswordReset(form);
    return;
  }

  if (formKind === "set-password") {
    await setPassword(form);
    return;
  }

  if (!currentSession) {
    authView = "login";
    renderLogin();
    return;
  }

  if (formKind === "daily-menu") {
    await saveDailyMenu(form);
    return;
  }

  if (formKind === "service-kind") {
    if (!confirmServiceChange(form)) {
      return;
    }

    await saveServiceKind(form);
    return;
  }

  if (formKind === "fixed-price") {
    await saveFixedPrice(form);
    return;
  }

  if (formKind === "variant-price") {
    await saveVariantPrice(form);
    return;
  }

  if (formKind === "catalog-item") {
    await saveCatalogItem(form);
    return;
  }

  if (formKind === "catalog-item-edit") {
    await saveCatalogItemEdit(form);
    return;
  }

  if (formKind === "catalog-option") {
    await saveCatalogOption(form);
    return;
  }

  if (formKind === "catalog-option-edit") {
    await saveCatalogOptionEdit(form);
    return;
  }

  if (formKind === "change-password") {
    await changePassword(form);
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
    authView = "login";
    saveStoredSession(currentSession);
    await loadAdminState("Sesion iniciada.", "success");
  }, "Iniciando sesion...");
}

async function requestPasswordReset(form: HTMLFormElement): Promise<void> {
  const email = getFormString(form, "email");

  if (!email) {
    setStatus("Ingresa tu email.", "danger");
    return;
  }

  await runBusy(async () => {
    const resetUrl = new URL(`${configuredSupabaseUrl}/auth/v1/recover`);
    resetUrl.searchParams.set("redirect_to", getPasswordRedirectUrl());

    const response = await fetch(resetUrl.toString(), {
      method: "POST",
      headers: {
        apikey: configuredSupabaseAnonKey,
        "Content-Type": "application/json",
      },
      credentials: "omit",
      body: JSON.stringify({ email }),
    });

    const body = await readJsonBody(response);

    if (!response.ok) {
      throw new Error(readErrorMessage(body));
    }

    currentStatus = {
      text: "Te enviamos un link para definir una nueva contrasena. Revisa tu email.",
      tone: "success",
    };
    authView = "login";
    renderLogin();
  }, "Enviando link...");
}

async function setPassword(form: HTMLFormElement): Promise<void> {
  const session = currentSession;

  if (!session) {
    authView = "login";
    renderLogin();
    return;
  }

  const password = getFormString(form, "password");
  const passwordConfirmation = getFormString(form, "password_confirmation");

  if (!isValidNewPassword(password, passwordConfirmation)) {
    return;
  }

  await runBusy(async () => {
    await updatePassword(session, password);
    saveStoredSession(session);
    authView = "login";
    await loadAdminState("Contrasena actualizada.", "success");
  }, "Actualizando contrasena...");
}

async function changePassword(form: HTMLFormElement): Promise<void> {
  const session = await requireSession();
  const password = getFormString(form, "password");
  const passwordConfirmation = getFormString(form, "password_confirmation");

  if (!isValidNewPassword(password, passwordConfirmation)) {
    return;
  }

  await runBusy(async () => {
    await updatePassword(session, password);
    await loadAdminState("Contrasena actualizada.", "success");
  }, "Actualizando contrasena...");
}

async function updatePassword(session: AuthSession, password: string): Promise<void> {
  const response = await fetch(`${configuredSupabaseUrl}/auth/v1/user`, {
    method: "PUT",
    headers: {
      apikey: configuredSupabaseAnonKey,
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
    },
    credentials: "omit",
    body: JSON.stringify({ password }),
  });

  const body = await readJsonBody(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body));
  }
}

async function logout(): Promise<void> {
  const session = currentSession;
  clearStoredSession();
  currentSession = null;
  currentState = null;
  hasPendingPublication = false;
  authView = "login";

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

    await loadAdminState(
      result.changed ? "Disponibilidad actualizada. Ya se ve en el menu publico." : "Sin cambios.",
      "success",
    );
  }, available ? "Mostrando item..." : "Ocultando item...");
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

    await loadAdminState(
      result.changed ? "Ajuste quitado. Ya se ve en el menu publico." : "Sin cambios.",
      "success",
    );
  }, "Quitando ajuste...");
}

async function saveDailyMenu(form: HTMLFormElement): Promise<void> {
  await runBusy(async () => {
    const result = await callMutation("set_daily_menu", {
      regular_name: getFormString(form, "regular_name"),
      regular_description: getNullableFormString(form, "regular_description"),
      vegetarian_name: getFormString(form, "vegetarian_name"),
      vegetarian_description: getNullableFormString(form, "vegetarian_description"),
    });

    if (!result.ok) {
      throw new Error(resultMessage(result));
    }

    markPendingIfNeeded(result);
    await loadAdminState(
      result.changed ? "Menu guardado. Para verlo en el menu publico, publica los cambios." : "Sin cambios.",
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
      result.changed ? "Servicio guardado. Para verlo en el menu publico, publica los cambios." : "Sin cambios.",
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
      result.changed ? "Precio guardado. Para verlo en el menu publico, publica los cambios." : "Sin cambios.",
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
      result.changed ? "Variante guardada. Para verla en el menu publico, publica los cambios." : "Sin cambios.",
      "success",
    );
  }, "Guardando variante...");
}

async function saveCatalogItem(form: HTMLFormElement): Promise<void> {
  await runBusy(async () => {
    const amountValue = getNullableFormString(form, "amount");
    const result = await callMutation("add_catalog_item", {
      section_id: getFormString(form, "section_id"),
      group_id: getFormString(form, "group_id"),
      item_id: getFormString(form, "item_id"),
      name: getFormString(form, "name"),
      description: getNullableFormString(form, "description"),
      amount: amountValue ? getFormInteger(form, "amount") : null,
    });

    if (!result.ok) {
      throw new Error(resultMessage(result));
    }

    markPendingIfNeeded(result);
    await loadAdminState(
      result.changed ? "Item agregado. Para verlo en el menu publico, publica los cambios." : "Sin cambios.",
      "success",
    );
  }, "Agregando item...");
}

async function deleteCatalogItem(item: CatalogItemState): Promise<void> {
  await runBusy(async () => {
    const result = await callMutation("delete_catalog_item", {
      section_id: item.section_id,
      group_id: item.group_id,
      item_id: item.item_id,
    });

    if (!result.ok) {
      throw new Error(resultMessage(result));
    }

    markPendingIfNeeded(result);
    await loadAdminState(
      result.changed ? "Item eliminado. Para quitarlo del menu publico, publica los cambios." : "Sin cambios.",
      "success",
    );
  }, "Eliminando item...");
}

async function saveCatalogItemEdit(form: HTMLFormElement): Promise<void> {
  await runBusy(async () => {
    const result = await callMutation("update_catalog_item", {
      section_id: getFormString(form, "section_id"),
      group_id: getFormString(form, "group_id"),
      item_id: getFormString(form, "item_id"),
      name: getFormString(form, "name"),
      description: getNullableFormString(form, "description"),
    });

    if (!result.ok) {
      throw new Error(resultMessage(result));
    }

    markPendingIfNeeded(result);
    await loadAdminState(
      result.changed ? "Item actualizado. Para verlo en el menu publico, publica los cambios." : "Sin cambios.",
      "success",
    );
  }, "Guardando item...");
}

async function saveCatalogOption(form: HTMLFormElement): Promise<void> {
  await runBusy(async () => {
    const result = await callMutation("add_catalog_item_option", {
      section_id: getFormString(form, "section_id"),
      group_id: getFormString(form, "group_id"),
      item_id: getFormString(form, "item_id"),
      option_id: getFormString(form, "option_id"),
      name: getFormString(form, "name"),
    });

    if (!result.ok) {
      throw new Error(resultMessage(result));
    }

    markPendingIfNeeded(result);
    await loadAdminState(
      result.changed ? "Opcion agregada. Para verla en el menu publico, publica los cambios." : "Sin cambios.",
      "success",
    );
  }, "Agregando opcion...");
}

async function saveCatalogOptionEdit(form: HTMLFormElement): Promise<void> {
  await runBusy(async () => {
    const result = await callMutation("update_catalog_item_option", {
      section_id: getFormString(form, "section_id"),
      group_id: getFormString(form, "group_id"),
      item_id: getFormString(form, "item_id"),
      option_id: getFormString(form, "option_id"),
      name: getFormString(form, "name"),
    });

    if (!result.ok) {
      throw new Error(resultMessage(result));
    }

    markPendingIfNeeded(result);
    await loadAdminState(
      result.changed ? "Opcion actualizada. Para verla en el menu publico, publica los cambios." : "Sin cambios.",
      "success",
    );
  }, "Guardando opcion...");
}

async function deleteCatalogOption(option: CatalogItemOptionState): Promise<void> {
  await runBusy(async () => {
    const result = await callMutation("delete_catalog_item_option", {
      section_id: option.section_id,
      group_id: option.group_id,
      item_id: option.item_id,
      option_id: option.option_id,
    });

    if (!result.ok) {
      throw new Error(resultMessage(result));
    }

    markPendingIfNeeded(result);
    await loadAdminState(
      result.changed ? "Opcion eliminada. Para quitarla del menu publico, publica los cambios." : "Sin cambios.",
      "success",
    );
  }, "Eliminando opcion...");
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
      await loadAdminState("Publicacion solicitada. El menu publico puede tardar unos minutos en actualizarse.", "success");
      return;
    }

    if (result.message === "publish_recently_queued") {
      hasPendingPublication = true;
      await loadAdminState(
        `Ya se pidio una publicacion hace poco${formatCooldownSuffix(result)}. Los cambios quedan guardados; volve a publicar cuando este disponible.`,
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
    throw new Error("El panel recibio una respuesta inesperada. Actualiza e intenta de nuevo.");
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
        <p class="admin-muted">Falta configurar el acceso publico necesario para cargar el panel. Avisale a quien administra el sitio.</p>
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
        <button class="admin-link-button" type="button" data-admin-action="show-reset-request" ${isBusy ? "disabled" : ""}>Olvide mi contrasena</button>
      </form>
    </section>
  `;
}

function renderPasswordResetRequest(): void {
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

function renderSetPassword(): void {
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
            <p class="admin-header__copy">Prepara el servicio diario. La disponibilidad se aplica al instante; platos, parrilla y precios necesitan publicar cambios.</p>
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

  if (activeTab === "fixed") {
    return renderFixedMenuTab(state);
  }

  if (activeTab === "prices") {
    return renderPricesTab(state);
  }

  if (activeTab === "publish") {
    return renderPublishTab(state);
  }

  return renderAccountTab();
}

function renderAvailabilityTab(state: AdminOperationalState): string {
  return `
    <section class="admin-section">
      <div class="admin-section__header">
        <h2 class="admin-section__title">Disponibilidad</h2>
        <p class="admin-section__copy">Oculta o vuelve a mostrar items del catalogo general. Estos cambios se ven al instante y no necesitan publicacion.</p>
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
    <section class="admin-section admin-daily">
      <div class="admin-section__header">
        <h2 class="admin-section__title">Menu del dia</h2>
        <p class="admin-section__copy">Primero carga los platos y confirma que locales usan menu del dia. Despues ajusta disponibilidad si algo se agota.</p>
      </div>
      ${serviceEditor ? `
        <section class="admin-daily-panel">
          <div class="admin-daily-panel__header">
            <h3 class="admin-daily-panel__title">Editar platos del dia</h3>
            <p class="admin-row__meta">Guardar deja los platos preparados, pero se veran en el menu publico despues de publicar cambios.</p>
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
        </section>
        ${renderDailyServiceForms(state)}
      ` : ""}
      ${availabilityEditor ? renderDailyAvailabilitySection(state) : ""}
      ${!serviceEditor && !availabilityEditor ? renderEmpty("No hay acciones de menu del dia disponibles para este rol.") : ""}
    </section>
  `;
}

function renderGrillTab(state: AdminOperationalState): string {
  const serviceEditor = state.permissions.can_edit_menu_content;
  const availabilityEditor = state.permissions.can_edit_availability;

  return `
    <section class="admin-section admin-grill">
      <div class="admin-section__header">
        <h2 class="admin-section__title">Parrilla</h2>
        <p class="admin-section__copy">Activa parrilla por local cuando corresponda. Ese cambio necesita publicacion; ocultar o mostrar items se ve al instante.</p>
      </div>
      ${serviceEditor ? renderGrillServiceForms(state) : ""}
      ${availabilityEditor ? renderGrillAvailabilitySection(state) : ""}
      ${!serviceEditor && !availabilityEditor ? renderEmpty("No hay acciones de parrilla disponibles para este rol.") : ""}
    </section>
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
          <p class="admin-section__copy">Agrega, edita o elimina items dentro de secciones existentes. Para crear secciones o cambiar el orden, avisale a quien administra el sitio.</p>
        </div>
        ${renderEmpty("No hay secciones del menu fijo disponibles.")}
      </section>
    `;
  }

  const groups = getFixedSectionGroups(editor, section.section_id);
  const group = section.content_kind === "groups" ? getEffectiveFixedGroup(editor, section.section_id) : undefined;
  const items = getFixedLocationItems(editor, section, group);

  return `
    <section class="admin-section admin-fixed">
      <div class="admin-section__header">
        <h2 class="admin-section__title">Menu fijo</h2>
        <p class="admin-section__copy">Agrega, edita nombre/descripcion o elimina items puntuales del catalogo estable. Los cambios quedan guardados, pero el menu publico se actualiza despues de publicar.</p>
      </div>
      <div class="admin-row admin-callout admin-fixed-guide">
        <div class="admin-row__main">
          <p class="admin-row__title">Como usar esta pantalla</p>
          <p class="admin-row__meta">Elegi la ubicacion, completa el nombre visible y agrega el item. El codigo se propone automaticamente y solo sirve para evitar duplicados.</p>
        </div>
      </div>
      <div class="admin-toolbar admin-fixed-toolbar">
        <label class="admin-field">
          <span class="admin-label">Seccion</span>
          <select class="admin-select" data-admin-filter="fixed-section">
            ${editor.sections
              .map((entry) => `<option value="${escapeHtml(entry.section_id)}" ${entry.section_id === section.section_id ? "selected" : ""}>${escapeHtml(entry.title)}</option>`)
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
      ${section.content_kind === "groups" && !group
        ? renderEmpty("La seccion seleccionada no tiene grupos disponibles para agregar items.")
        : renderCatalogItemForm(section, group)}
      ${renderCatalogItemList(items)}
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
        <p class="admin-section__copy">Ajusta precios globales. Guardar no cambia el menu publico hasta que publiques cambios.</p>
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
        <p class="admin-section__copy">Publicar envia al menu publico los cambios guardados de platos, menu fijo, servicio activo y precios. Puede tardar unos minutos.</p>
      </div>
      <div class="admin-row">
        <div class="admin-row__main">
          <p class="admin-row__title">${hasPendingPublication ? "Hay cambios guardados por publicar" : "Sin cambios pendientes detectados en esta sesion"}</p>
          <p class="admin-row__meta">La disponibilidad no pasa por este paso porque se aplica al instante.</p>
        </div>
        <div class="admin-row__actions">
          <button class="admin-button" type="button" data-admin-action="publish" ${isBusy || !state.permissions.can_publish_menu ? "disabled" : ""}>Publicar ahora</button>
          <button class="admin-button admin-button--secondary" type="button" data-admin-action="reload" ${isBusy ? "disabled" : ""}>Actualizar estado</button>
        </div>
      </div>
    </section>
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
  if (!hasPendingPublication || !state.permissions.can_publish_menu) {
    return "";
  }

  return `
    <div class="admin-banner">
      <span>Falta publicar: hay cambios guardados que todavia no se ven en el menu publico.</span>
      <button class="admin-button" type="button" data-admin-action="publish" ${isBusy ? "disabled" : ""}>Publicar ahora</button>
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

function getDailyServiceProfiles(state: AdminOperationalState): ProfileState[] {
  return state.profiles.filter((profile) => findServiceKind(state, profile.id) === "daily-menu");
}

function getDailyAvailabilityTargets(state: AdminOperationalState): AvailabilityTargetState[] {
  const profileIds = new Set(
    getDailyServiceProfiles(state)
      .filter((profile) => profile.can_edit_availability)
      .map((profile) => profile.id),
  );

  return state.availability_targets.filter((target) =>
    target.target_kind === "daily-menu" && profileIds.has(target.menu_id)
  );
}

function renderDailyServiceForms(state: AdminOperationalState): string {
  if (state.profiles.length === 0) {
    return `
      <section class="admin-daily-panel">
        <div class="admin-daily-panel__header">
          <h3 class="admin-daily-panel__title">Locales con menu del dia</h3>
          <p class="admin-row__meta">Cambiar entre menu del dia y parrilla se vera en el menu publico despues de publicar.</p>
        </div>
        ${renderEmpty("No hay locales para configurar.")}
      </section>
    `;
  }

  return `
    <section class="admin-daily-panel">
      <div class="admin-daily-panel__header">
        <h3 class="admin-daily-panel__title">Locales con menu del dia</h3>
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

function renderDailyAvailabilitySection(state: AdminOperationalState): string {
  const profiles = getDailyServiceProfiles(state).filter((profile) => profile.can_edit_availability);
  const targets = getDailyAvailabilityTargets(state);

  if (profiles.length === 0) {
    return `
      <section class="admin-daily-panel">
        <div class="admin-daily-panel__header">
          <h3 class="admin-daily-panel__title">Disponibilidad de hoy</h3>
          <p class="admin-row__meta">Ocultar o mostrar se ve al instante en el menu publico.</p>
        </div>
        ${renderEmpty("No hay locales con menu del dia activo.")}
      </section>
    `;
  }

  const profileFilter = profiles.some((profile) => profile.id === dailyProfileFilter)
    ? dailyProfileFilter
    : profiles[0]?.id ?? "";
  const visibleTargets = targets.filter((target) => target.menu_id === profileFilter);
  const selectedProfile = profiles.find((profile) => profile.id === profileFilter);

  return `
    <section class="admin-daily-panel">
      <div class="admin-daily-panel__header">
        <h3 class="admin-daily-panel__title">Disponibilidad de hoy</h3>
        <p class="admin-row__meta">Usa esto cuando una opcion se agota o vuelve a estar disponible. No hace falta publicar.</p>
      </div>
      <div class="admin-toolbar admin-daily-toolbar">
        ${profiles.length > 1 ? `
          <label class="admin-field">
            <span class="admin-label">Local</span>
            <select class="admin-select" data-admin-filter="daily-profile">
              ${profiles
                .map((profile) => `<option value="${escapeHtml(profile.id)}" ${profileFilter === profile.id ? "selected" : ""}>${escapeHtml(profile.title)}</option>`)
                .join("")}
            </select>
          </label>
        ` : `
          <div class="admin-daily-context">
            <span class="admin-label">Local</span>
            <strong>${escapeHtml(selectedProfile?.title ?? "Menu del dia")}</strong>
          </div>
        `}
      </div>
      ${visibleTargets.length === 0 ? renderEmpty("No hay items de menu del dia para este local.") : `
        <div class="admin-list-header">
          <span>${visibleTargets.length} items</span>
          <span>Los cambios se aplican al instante.</span>
        </div>
        <div class="admin-grid">${visibleTargets.map((target) => renderDailyAvailabilityRow(state, target)).join("")}</div>
      `}
    </section>
  `;
}

function renderDailyAvailabilityRow(
  state: AdminOperationalState,
  target: AvailabilityTargetState,
): string {
  const overlay = findOverlay(state, target);
  const effectiveAvailable = overlay ? overlay.available_override : target.base_available;
  const key = getTargetKey(target);

  return `
    <div class="admin-row admin-daily-availability-row">
      <div class="admin-row__main">
        <p class="admin-row__title">${escapeHtml(target.name)}</p>
        ${target.description ? `<p class="admin-row__meta">${escapeHtml(target.description)}</p>` : ""}
        <div class="admin-row__status">
          ${renderAvailabilityStatus(effectiveAvailable, overlay)}
        </div>
      </div>
      ${renderAvailabilityActions(key, effectiveAvailable, overlay)}
    </div>
  `;
}

function getGrillServiceProfiles(state: AdminOperationalState): ProfileState[] {
  return state.profiles.filter((profile) => findServiceKind(state, profile.id) === "grill");
}

function getGrillAvailabilityTargets(state: AdminOperationalState): AvailabilityTargetState[] {
  const profileIds = new Set(
    getGrillServiceProfiles(state)
      .filter((profile) => profile.can_edit_availability)
      .map((profile) => profile.id),
  );

  return state.availability_targets.filter((target) =>
    target.target_kind === "grill" && profileIds.has(target.menu_id)
  );
}

function getEffectiveGrillProfileFilter(state: AdminOperationalState): string {
  const profiles = getGrillServiceProfiles(state).filter((profile) => profile.can_edit_availability);

  if (profiles.some((profile) => profile.id === grillProfileFilter)) {
    return grillProfileFilter;
  }

  return profiles[0]?.id ?? "";
}

function getGrillFamilyKey(target: AvailabilityTargetState): string {
  if (target.group_id) {
    return `group:${target.section_id}:${target.group_id}`;
  }

  if (target.group_title) {
    return `group-title:${target.section_id}:${target.group_title}`;
  }

  return `section:${target.section_id}`;
}

function getGrillFamilyOptions(
  targets: AvailabilityTargetState[],
): Array<{ key: string; label: string }> {
  const options: Array<{ key: string; label: string }> = [];
  const seenKeys = new Set<string>();

  for (const target of targets) {
    const key = getGrillFamilyKey(target);

    if (seenKeys.has(key)) {
      continue;
    }

    seenKeys.add(key);
    options.push({ key, label: getAvailabilityGroupLabel(target) });
  }

  return options;
}

function renderGrillServiceForms(state: AdminOperationalState): string {
  if (state.profiles.length === 0) {
    return `
      <section class="admin-grill-panel">
        <div class="admin-grill-panel__header">
          <h3 class="admin-grill-panel__title">Locales con parrilla</h3>
          <p class="admin-row__meta">Cambiar entre menu del dia y parrilla se vera en el menu publico despues de publicar.</p>
        </div>
        ${renderEmpty("No hay locales para configurar.")}
      </section>
    `;
  }

  return `
    <section class="admin-grill-panel">
      <div class="admin-grill-panel__header">
        <h3 class="admin-grill-panel__title">Locales con parrilla</h3>
        <p class="admin-row__meta">Elegir parrilla activa ese servicio para el local. Se vera en el menu publico despues de publicar.</p>
      </div>
      <div class="admin-grid">
        ${state.profiles.map((profile) => {
          const currentService = findServiceKind(state, profile.id);
          const serviceLabel = currentService === "grill" ? "Parrilla activa" : "Menu del dia activo";

          return `
            <form class="admin-row admin-grill-service-row" data-admin-form="service-kind" data-current-service="${currentService}" data-profile-title="${escapeHtml(profile.title)}">
              <div class="admin-row__main">
                <p class="admin-row__title">${escapeHtml(profile.title)}</p>
                <div class="admin-row__status">
                  <span class="admin-pill" data-tone="${currentService === "grill" ? "success" : "neutral"}">${escapeHtml(serviceLabel)}</span>
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

function renderGrillAvailabilitySection(state: AdminOperationalState): string {
  const profiles = getGrillServiceProfiles(state).filter((profile) => profile.can_edit_availability);
  const allTargets = getGrillAvailabilityTargets(state);

  if (profiles.length === 0) {
    return `
      <section class="admin-grill-panel">
        <div class="admin-grill-panel__header">
          <h3 class="admin-grill-panel__title">Disponibilidad de parrilla</h3>
          <p class="admin-row__meta">Ocultar o mostrar variantes se ve al instante en el menu publico.</p>
        </div>
        ${renderEmpty("No hay locales con parrilla activa.")}
      </section>
    `;
  }

  const profileFilter = getEffectiveGrillProfileFilter(state);
  const profileTargets = allTargets.filter((target) => target.menu_id === profileFilter);
  const familyOptions = getGrillFamilyOptions(profileTargets);
  const familyFilter = familyOptions.some((option) => option.key === grillGroupFilter) ? grillGroupFilter : "";
  const selectedProfile = profiles.find((profile) => profile.id === profileFilter);

  return `
    <section class="admin-grill-panel">
      <div class="admin-grill-panel__header">
        <h3 class="admin-grill-panel__title">Disponibilidad de parrilla</h3>
        <p class="admin-row__meta">Usa esto cuando una variante se agota o vuelve a estar disponible. No hace falta publicar.</p>
      </div>
      <div class="admin-toolbar admin-grill-toolbar">
        ${profiles.length > 1 ? `
          <label class="admin-field">
            <span class="admin-label">Local</span>
            <select class="admin-select" data-admin-filter="grill-profile">
              ${profiles
                .map((profile) => `<option value="${escapeHtml(profile.id)}" ${profileFilter === profile.id ? "selected" : ""}>${escapeHtml(profile.title)}</option>`)
                .join("")}
            </select>
          </label>
        ` : `
          <div class="admin-grill-context">
            <span class="admin-label">Local</span>
            <strong>${escapeHtml(selectedProfile?.title ?? "Parrilla")}</strong>
          </div>
        `}
        <label class="admin-field">
          <span class="admin-label">Familia</span>
          <select class="admin-select" data-admin-filter="grill-group">
            <option value="">Todas</option>
            ${familyOptions
              .map((option) => `<option value="${escapeHtml(option.key)}" ${familyFilter === option.key ? "selected" : ""}>${escapeHtml(option.label)}</option>`)
              .join("")}
          </select>
        </label>
      </div>
      ${renderGrillAvailabilityRows(state, profileTargets, familyFilter)}
    </section>
  `;
}

function renderGrillAvailabilityRows(
  state: AdminOperationalState,
  scopeTargets: AvailabilityTargetState[],
  familyFilter: string,
): string {
  const targets = scopeTargets.filter((target) =>
    !familyFilter || getGrillFamilyKey(target) === familyFilter
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
      ${groupGrillTargets(targets).flatMap((profileGroup) => profileGroup.families).map((family) => `
        <section class="admin-family admin-grill-family">
          <div class="admin-family__header">
            <h4 class="admin-family__title">${escapeHtml(family.title)}</h4>
            <span class="admin-family__count">${family.targets.length} variantes</span>
          </div>
          <div class="admin-family__variants">
            ${family.targets.map((target) => renderGrillAvailabilityVariant(state, target)).join("")}
          </div>
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
  const priceText = formatOptionalAmount(target.price_amount);

  return `
    <div class="admin-row admin-variant-row admin-grill-variant-row">
      <div class="admin-row__main">
        <div class="admin-variant-heading">
          <p class="admin-row__title">${escapeHtml(target.name)}</p>
          ${priceText ? `<span class="admin-variant-price">${escapeHtml(priceText)}</span>` : ""}
        </div>
        ${target.description ? `<p class="admin-row__meta">${escapeHtml(target.description)}</p>` : ""}
        <div class="admin-row__status">
          ${renderAvailabilityStatus(effectiveAvailable, overlay)}
        </div>
      </div>
      ${renderAvailabilityActions(key, effectiveAvailable, overlay)}
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
      <label class="admin-field">
        <span class="admin-label">Nombre visible</span>
        <input class="admin-input" name="name" data-catalog-name required />
        <span class="admin-help">Es el nombre que va a leer el cliente en el menu.</span>
      </label>
      <label class="admin-field">
        <span class="admin-label">Codigo del item</span>
        <input class="admin-input" name="item_id" data-catalog-id pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="se-completa-solo" autocomplete="off" required />
        <span class="admin-help">Se completa solo desde el nombre. Editalo solo si el panel avisa que ya existe.</span>
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

function renderCatalogItemList(items: CatalogItemState[]): string {
  if (items.length === 0) {
    return renderEmpty("No hay items en esta ubicacion. Agrega el primero con el formulario de arriba.");
  }

  return `
    <div class="admin-list-header">
      <span>${items.length} items</span>
      <span>Editar o eliminar requiere publicar cambios.</span>
    </div>
    <div class="admin-grid">
      ${items.map((item) => renderCatalogItemRow(item, items.length > 1)).join("")}
    </div>
  `;
}

function renderCatalogItemRow(item: CatalogItemState, canDelete: boolean): string {
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
        <form class="admin-fixed-edit-fields" data-admin-form="catalog-item-edit">
          <input type="hidden" name="section_id" value="${escapeHtml(item.section_id)}" />
          <input type="hidden" name="group_id" value="${escapeHtml(item.group_id)}" />
          <input type="hidden" name="item_id" value="${escapeHtml(item.item_id)}" />
          <label class="admin-field">
            <span class="admin-label">Nombre</span>
            <input class="admin-input" name="name" value="${escapeHtml(item.name)}" required />
          </label>
          <label class="admin-field admin-field--wide">
            <span class="admin-label">Descripcion</span>
            <textarea class="admin-textarea admin-textarea--compact" name="description">${escapeHtml(item.description ?? "")}</textarea>
          </label>
          <div class="admin-row__actions admin-fixed-edit-actions">
            <button class="admin-button" type="submit" ${isBusy ? "disabled" : ""}>
              Guardar
            </button>
          </div>
        </form>
        ${renderCatalogItemOptions(item)}
      </div>
      <div class="admin-row__actions">
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
      </div>
    </div>
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
        <label class="admin-field">
          <span class="admin-label">Nuevo sabor</span>
          <input class="admin-input" name="name" data-catalog-option-name required />
        </label>
        <label class="admin-field">
          <span class="admin-label">Codigo del sabor</span>
          <input class="admin-input" name="option_id" data-catalog-option-id pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="se-completa-solo" autocomplete="off" required />
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

  if (state.permissions.can_edit_menu_content || state.permissions.can_edit_availability) {
    tabs.push({ id: "daily", label: "Menu del dia" });
  }

  if (state.permissions.can_edit_availability || state.permissions.can_edit_menu_content) {
    tabs.push({ id: "grill", label: "Parrilla" });
  }

  if (state.permissions.can_edit_menu_content) {
    tabs.push({ id: "fixed", label: "Menu fijo" });
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

  tabs.push({ id: "account", label: "Cuenta" });

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

function findCatalogItem(
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

function findCatalogItemOption(
  sectionId: string,
  groupId: string,
  itemId: string,
  optionId: string,
): CatalogItemOptionState | undefined {
  return findCatalogItem(sectionId, groupId, itemId)?.options.find((option) => option.option_id === optionId);
}

function getEffectiveFixedSection(editor: CatalogEditorState): CatalogSectionState | undefined {
  return editor.sections.find((section) => section.section_id === fixedSectionFilter)
    ?? editor.sections[0];
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

  if (groupId === undefined) {
    return [];
  }

  return editor.items.filter((item) =>
    item.section_id === section.section_id
    && item.group_id === groupId
  );
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

function handleCatalogItemInput(field: HTMLInputElement): void {
  const form = field.closest<HTMLFormElement>('form[data-admin-form="catalog-item"]');

  if (!form) {
    return;
  }

  if (field.name === "item_id") {
    field.dataset.manual = "true";
    return;
  }

  if (field.name !== "name") {
    return;
  }

  const itemIdField = form.elements.namedItem("item_id");

  if (!(itemIdField instanceof HTMLInputElement) || itemIdField.dataset.manual === "true") {
    return;
  }

  itemIdField.value = createCatalogId(field.value);
}

function handleCatalogOptionInput(field: HTMLInputElement): void {
  const form = field.closest<HTMLFormElement>('form[data-admin-form="catalog-option"]');

  if (!form) {
    return;
  }

  if (field.name === "option_id") {
    field.dataset.manual = "true";
    return;
  }

  if (field.name !== "name") {
    return;
  }

  const optionIdField = form.elements.namedItem("option_id");

  if (!(optionIdField instanceof HTMLInputElement) || optionIdField.dataset.manual === "true") {
    return;
  }

  optionIdField.value = createCatalogId(field.value);
}

function createCatalogId(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u00f1/g, "n")
    .replace(/\u00d1/g, "n")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

function confirmPublishChanges(): boolean {
  return window.confirm(
    "Vas a publicar los cambios guardados de platos, menu fijo, servicio activo y precios. La disponibilidad ya se aplica al instante. Continuar?",
  );
}

function confirmDeleteCatalogItem(item: CatalogItemState): boolean {
  const optionText = item.option_count > 0
    ? ` Tambien se eliminan sus ${item.option_count} opciones.`
    : "";

  return window.confirm(
    `Vas a eliminar "${item.name}" del menu fijo.${optionText} El menu publico cambia despues de publicar. Continuar?`,
  );
}

function confirmDeleteCatalogOption(option: CatalogItemOptionState): boolean {
  return window.confirm(
    `Vas a eliminar el sabor "${option.name}". La subcategoria debe conservar al menos un sabor y el menu publico cambia despues de publicar. Continuar?`,
  );
}

function confirmServiceChange(form: HTMLFormElement): boolean {
  const currentService = form.dataset.currentService;
  const nextService = getFormString(form, "service_kind");

  if (!currentService || currentService === nextService) {
    return true;
  }

  const profileTitle = form.dataset.profileTitle ?? "este local";
  const nextLabel = nextService === "grill" ? "parrilla" : "menu del dia";

  return window.confirm(
    `Vas a cambiar ${profileTitle} a ${nextLabel}. El menu publico se actualiza despues de publicar cambios. Continuar?`,
  );
}

function setStatus(text: string, tone: StatusTone): void {
  currentStatus = { text, tone };
  renderCurrentView();
}

async function runBusy(action: () => Promise<void>, busyText = "Procesando..."): Promise<void> {
  isBusy = true;
  currentBusyText = busyText;
  renderCurrentView();

  try {
    await action();
  } catch (error) {
    currentBusyText = null;
    handleUnexpectedError(error);
  } finally {
    isBusy = false;
    currentBusyText = null;
    renderCurrentView();
  }
}

function handleUnexpectedError(error: unknown): void {
  const message = error instanceof TypeError && error.message === "Failed to fetch"
    ? "No se pudo conectar. Revisa la conexion e intenta de nuevo."
    : error instanceof Error
      ? toOperationalErrorMessage(error.message)
      : "Ocurrio un error inesperado.";
  currentStatus = { text: message, tone: "danger" };
  renderCurrentView();
}

function renderCurrentView(): void {
  if (currentSession && currentState) {
    renderAuthenticated();
    return;
  }

  if (authView === "reset-request") {
    renderPasswordResetRequest();
    return;
  }

  if (authView === "set-password") {
    renderSetPassword();
    return;
  }

  renderLogin();
}

function isValidNewPassword(password: string, passwordConfirmation: string): boolean {
  if (!password || !passwordConfirmation) {
    setStatus("Completa la nueva contrasena y su confirmacion.", "danger");
    return false;
  }

  if (password.length < 8) {
    setStatus("La contrasena debe tener al menos 8 caracteres.", "danger");
    return false;
  }

  if (password !== passwordConfirmation) {
    setStatus("Las contrasenas no coinciden.", "danger");
    return false;
  }

  return true;
}

function getPasswordRedirectUrl(): string {
  const url = new URL(window.location.href);
  url.pathname = "/admin/";
  url.search = "";
  url.hash = "";
  return url.toString();
}

function readPasswordSessionFromLocation(): AuthSession | null {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const params = hashParams.has("access_token") ? hashParams : new URLSearchParams(window.location.search);
  const type = params.get("type");

  if (type !== "recovery" && type !== "invite") {
    return null;
  }

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  const expiresIn = Number(params.get("expires_in") ?? "3600");

  if (!accessToken || !refreshToken || !Number.isFinite(expiresIn)) {
    return null;
  }

  window.history.replaceState({}, document.title, getPasswordRedirectUrl());

  return {
    accessToken,
    refreshToken,
    expiresAt: Date.now() + expiresIn * 1000,
  };
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
    catalog_editor: {
      sections: Array.isArray(state.catalog_editor?.sections)
        ? state.catalog_editor.sections.map(normalizeCatalogSection)
        : [],
      groups: Array.isArray(state.catalog_editor?.groups)
        ? state.catalog_editor.groups.map(normalizeCatalogGroup)
        : [],
      items: Array.isArray(state.catalog_editor?.items)
        ? state.catalog_editor.items.map(normalizeCatalogItem)
        : [],
    },
  };
}

function normalizeCatalogSection(section: CatalogSectionState): CatalogSectionState {
  return {
    ...section,
    item_count: normalizeNonnegativeInteger(section.item_count),
  };
}

function normalizeCatalogGroup(group: CatalogGroupState): CatalogGroupState {
  return {
    ...group,
    item_count: normalizeNonnegativeInteger(group.item_count),
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

  return "Operador";
}

function resultMessage(result: RpcResult): string {
  const messages: Record<string, string> = {
    permission_denied: "No tenes permisos para esta accion.",
    publish_queued: "Publicacion solicitada. El menu publico puede tardar unos minutos en actualizarse.",
    publish_recently_queued: "Ya se pidio una publicacion hace poco.",
    publish_failed: "No se pudo publicar.",
    invalid_amount: "El importe no es valido.",
    daily_menu_name_required: "El nombre del menu es obligatorio.",
    daily_menu_available_required: "La disponibilidad del menu es obligatoria.",
    invalid_service_kind: "El servicio seleccionado no es valido.",
    catalog_item_id_required: "El codigo del item es obligatorio.",
    invalid_catalog_item_id: "El codigo del item debe usar minusculas, numeros y guiones.",
    catalog_item_name_required: "El nombre del item es obligatorio.",
    catalog_section_not_found: "La seccion seleccionada no existe.",
    invalid_catalog_group: "La seccion seleccionada no acepta grupo.",
    catalog_group_required: "Selecciona un grupo existente.",
    catalog_group_not_found: "El grupo seleccionado no existe.",
    catalog_item_exists: "Ya existe un item con ese codigo en esta ubicacion.",
    catalog_item_unchanged: "Sin cambios.",
    catalog_item_updated: "Item actualizado.",
    invalid_catalog_option_id: "El codigo del sabor debe usar minusculas, numeros y guiones.",
    catalog_option_exists: "Ya existe un sabor con ese codigo en esta subcategoria.",
    catalog_options_not_enabled: "Solo se pueden administrar sabores en subcategorias que ya usan opciones.",
    catalog_option_id_required: "El codigo de la opcion es obligatorio.",
    catalog_option_name_required: "El nombre de la opcion es obligatorio.",
    catalog_option_added: "Opcion agregada.",
    catalog_option_not_found: "La opcion seleccionada ya no existe.",
    catalog_option_unchanged: "Sin cambios.",
    catalog_option_updated: "Opcion actualizada.",
    catalog_option_deleted: "Opcion eliminada.",
    catalog_option_must_keep_one: "La subcategoria debe conservar al menos un sabor.",
    catalog_price_key_conflict: "Ya existe un precio incompatible para ese codigo.",
    catalog_item_not_found: "El item seleccionado ya no existe.",
    catalog_location_must_keep_item: "No se puede eliminar el ultimo item de una seccion o grupo.",
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
  if (body && typeof body === "object") {
    const message = (body as {
      error?: unknown;
      error_description?: unknown;
      message?: unknown;
      msg?: unknown;
    }).message
      ?? (body as { msg?: unknown }).msg
      ?? (body as { error_description?: unknown }).error_description
      ?? (body as { error?: unknown }).error;

    if (typeof message === "string" && message.trim()) {
      return toOperationalErrorMessage(message);
    }
  }

  return "No se pudo completar la operacion.";
}

function toOperationalErrorMessage(message: string): string {
  const trimmedMessage = message.trim();
  const lowerMessage = trimmedMessage.toLowerCase();

  if (!trimmedMessage) {
    return "No se pudo completar la operacion.";
  }

  if (
    lowerMessage.includes("jwt")
    || lowerMessage.includes("token")
    || lowerMessage.includes("session")
    || lowerMessage.includes("expired")
  ) {
    return "La sesion expiro. Volve a iniciar sesion.";
  }

  if (
    lowerMessage.includes("permission denied")
    || lowerMessage.includes("42501")
    || lowerMessage.includes("row-level")
    || lowerMessage.includes("not authorized")
    || lowerMessage.includes("unauthorized")
  ) {
    return "No tenes permisos para esta accion.";
  }

  if (
    lowerMessage.includes("invalid input")
    || lowerMessage.includes("violates")
    || lowerMessage.includes("constraint")
  ) {
    return "Hay un dato invalido. Revisalo e intenta guardar de nuevo.";
  }

  if (
    lowerMessage.includes("supabase")
    || lowerMessage.includes("pgrst")
    || lowerMessage.includes("rpc")
    || lowerMessage.includes("schema")
    || lowerMessage.includes("function")
  ) {
    return "No se pudo completar la operacion. Actualiza el panel e intenta de nuevo.";
  }

  return trimmedMessage;
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

function formatCatalogItemPrice(item: CatalogItemState): string {
  if (typeof item.price_amount === "number" && Number.isSafeInteger(item.price_amount) && item.price_amount >= 0) {
    return formatAmount(item.price_amount);
  }

  return item.pricing_key ? "Precio configurado" : "Precio heredado";
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
