import type {
  AdminOperationalState,
  AdminTabId,
  AuthSession,
  AuthView,
  RpcResult,
  StatusMessage,
  StatusTone,
} from "./adminTypes";
import {
  callMutation as callAdminMutation,
  loadAdminOperationalState,
  logoutRequest,
  publishMenuChanges as publishMenuChangesRequest,
  refreshSessionRequest,
  requestPasswordResetEmail,
  signInWithPassword,
  updatePasswordRequest,
} from "./adminApi";
import { createAdminOperations } from "./adminOperations";
import {
  clearStoredSession,
  getPasswordRedirectUrl,
  readPasswordSessionFromLocation,
  readStoredSession,
  saveStoredSession,
} from "./adminSession";
import {
  ensureActiveTab,
  findAvailabilityTarget,
  findCatalogItem,
  findCatalogItemOption,
  findGrillItem,
  renderAuthenticated,
  renderConfigurationError,
  renderLogin,
  renderPasswordResetRequest,
  renderSetPassword,
  setAdminActiveTab,
  setAdminFilter,
  setAdminViewContext,
} from "./adminView";
import {
  createCatalogId,
  getFormString,
  getTrimmedValue,
  normalizeAdminState,
  normalizeSupabaseProjectUrl,
  toOperationalErrorMessage,
} from "./adminUtils";

const rootElement = document.querySelector<HTMLElement>("[data-admin-root]");

const supabaseUrl = normalizeSupabaseProjectUrl(import.meta.env.PUBLIC_SUPABASE_URL);
const supabaseAnonKey = getTrimmedValue(import.meta.env.PUBLIC_SUPABASE_ANON_KEY);
const configuredSupabaseUrl = supabaseUrl ?? "";
const configuredSupabaseAnonKey = supabaseAnonKey ?? "";
const adminApiConfig = {
  supabaseUrl: configuredSupabaseUrl,
  supabaseAnonKey: configuredSupabaseAnonKey,
};

let currentSession: AuthSession | null = null;
let currentState: AdminOperationalState | null = null;
let currentStatus: StatusMessage | null = null;
let currentBusyText: string | null = null;
let authView: AuthView = "login";
let isBusy = false;

if (!rootElement) {
  throw new Error("Admin root element was not found.");
}

const root: HTMLElement = rootElement;
const adminOperations = createAdminOperations({
  runBusy,
  callMutation,
  loadAdminState,
  requireSession,
  publishMenuChanges: (session) => publishMenuChangesRequest(adminApiConfig, session),
});

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

  setAdminFilter(field.dataset.adminFilter, field.value);
  renderCurrentView();
});

root.addEventListener("input", (event) => {
  const field = event.target instanceof HTMLInputElement ? event.target : null;

  if (!field) {
    return;
  }

  handleCatalogItemInput(field);
  handleCatalogOptionInput(field);
  handleGrillItemInput(field);
});

void startAdmin().catch(handleUnexpectedError);

async function startAdmin(): Promise<void> {
  if (!supabaseUrl || !supabaseAnonKey) {
    syncAdminViewContext();
    renderConfigurationError();
    return;
  }

  const passwordSession = readPasswordSessionFromLocation();

  if (passwordSession) {
    currentSession = passwordSession;
    authView = "set-password";
    currentStatus = { text: "Defini una nueva contrasena para activar tu acceso.", tone: "neutral" };
    renderCurrentView();
    return;
  }

  currentSession = await getValidSession();

  if (!currentSession) {
    authView = "login";
    renderCurrentView();
    return;
  }

  await loadAdminState();
}

async function handleAction(target: HTMLElement): Promise<void> {
  const action = target.dataset.adminAction;

  if (action === "show-reset-request") {
    authView = "reset-request";
    currentStatus = null;
    renderCurrentView();
    return;
  }

  if (action === "show-login") {
    authView = "login";
    currentStatus = null;
    renderCurrentView();
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
      setAdminActiveTab(tab);
      renderCurrentView();
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
      await adminOperations.clearAvailabilityOverlay(availabilityTarget);
    } else {
      await adminOperations.saveAvailabilityOverlay(availabilityTarget, false);
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

    await adminOperations.clearAvailabilityOverlay(availabilityTarget);
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

    await adminOperations.deleteCatalogItem(item);
    return;
  }

  if (action === "delete-grill-item") {
    const itemId = target.dataset.itemId;
    const item = itemId ? findGrillItem(itemId) : undefined;

    if (!item) {
      setStatus("No se encontro el item de parrilla seleccionado.", "danger");
      return;
    }

    await adminOperations.deleteGrillItem(item);
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

    await adminOperations.deleteCatalogOption(option);
    return;
  }

  if (action === "publish") {
    if (!confirmPublishChanges()) {
      return;
    }

    await adminOperations.publishChanges();
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
    renderCurrentView();
    return;
  }

  if (formKind === "daily-menu") {
    await adminOperations.saveDailyMenu(form);
    return;
  }

  if (formKind === "service-kind") {
    await adminOperations.saveServiceKind(form);
    return;
  }

  if (formKind === "grill-item") {
    await adminOperations.saveGrillItem(form);
    return;
  }

  if (formKind === "grill-item-edit") {
    await adminOperations.saveGrillItemEdit(form);
    return;
  }

  if (formKind === "fixed-price") {
    await adminOperations.saveFixedPrice(form);
    return;
  }

  if (formKind === "variant-price") {
    await adminOperations.saveVariantPrice(form);
    return;
  }

  if (formKind === "catalog-item") {
    await adminOperations.saveCatalogItem(form);
    return;
  }

  if (formKind === "catalog-item-edit") {
    await adminOperations.saveCatalogItemEdit(form);
    return;
  }

  if (formKind === "catalog-option") {
    await adminOperations.saveCatalogOption(form);
    return;
  }

  if (formKind === "catalog-option-edit") {
    await adminOperations.saveCatalogOptionEdit(form);
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
    return;
  }

  await runBusy(async () => {
    currentSession = await signInWithPassword(adminApiConfig, email, password);
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
    await requestPasswordResetEmail(adminApiConfig, email, getPasswordRedirectUrl());
    currentStatus = {
      text: "Te enviamos un link para definir una nueva contrasena. Revisa tu email.",
      tone: "success",
    };
    authView = "login";
    renderCurrentView();
  }, "Enviando link...");
}

async function setPassword(form: HTMLFormElement): Promise<void> {
  const session = currentSession;

  if (!session) {
    authView = "login";
    renderCurrentView();
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
  await updatePasswordRequest(adminApiConfig, session, password);
}

async function logout(): Promise<void> {
  const session = currentSession;
  clearStoredSession();
  currentSession = null;
  currentState = null;
  authView = "login";

  if (session) {
    await logoutRequest(adminApiConfig, session);
  }

  currentStatus = { text: "Sesion cerrada.", tone: "success" };
  renderCurrentView();
}

async function loadAdminState(
  statusText?: string,
  statusTone: StatusTone = "neutral",
): Promise<void> {
  const session = await requireSession();
  const state = await loadAdminOperationalState(adminApiConfig, session);
  currentState = normalizeAdminState(state);
  currentStatus = statusText ? { text: statusText, tone: statusTone } : currentStatus;
  syncAdminViewContext();
  ensureActiveTab();
  renderAuthenticated();
}

async function callMutation(name: string, body: Record<string, unknown>): Promise<RpcResult> {
  const session = await requireSession();
  return callAdminMutation(adminApiConfig, session, name, body);
}

async function requireSession(): Promise<AuthSession> {
  const session = await getValidSession();

  if (!session) {
    renderCurrentView();
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
  const refreshedSession = await refreshSessionRequest(adminApiConfig, session);

  if (!refreshedSession) {
    clearStoredSession();
    return null;
  }

  saveStoredSession(refreshedSession);
  return refreshedSession;
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

function handleGrillItemInput(field: HTMLInputElement): void {
  const form = field.closest<HTMLFormElement>('form[data-admin-form="grill-item"]');

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

function confirmPublishChanges(): boolean {
  return window.confirm(
    "Vas a publicar los cambios guardados de platos, parrilla, menu fijo, servicio activo y precios. La disponibilidad ya se aplica al instante. Continuar?",
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
  syncAdminViewContext();

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

function syncAdminViewContext(): void {
  setAdminViewContext({
    root,
    currentState,
    currentStatus,
    currentBusyText,
    isBusy,
  });
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
