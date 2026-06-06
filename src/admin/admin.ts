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
  findAvailabilityFamilyTargets,
  ensureActiveTab,
  findAvailabilityTarget,
  findCatalogItem,
  findCatalogItemOption,
  findGrillFamily,
  findGrillItem,
  renderAuthenticated,
  renderConfigurationError,
  renderLogin,
  renderPasswordResetRequest,
  renderSetPassword,
  setAdminActiveTab,
  setAdminFilter,
  setAdminServiceSection,
  setAdminViewContext,
  isServiceSectionAvailable,
} from "./adminView";
import {
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
let requestedPublishHash = "";
let publishCooldownEndsAt = 0;

type AdminStatusText = string | ((state: AdminOperationalState) => string);
type RenderFocusMode = "preserve" | "view" | "tab";

interface RenderOptions {
  focus?: RenderFocusMode;
  tabId?: AdminTabId;
  revealStatus?: boolean;
}

interface InteractionSnapshot {
  scrollX: number;
  scrollY: number;
  formKind: string;
  fieldName: string;
  formKeys: Record<string, string>;
}

const formBaselines = new WeakMap<HTMLFormElement, string>();
const formKeyNames = [
  "profile_id",
  "section_id",
  "group_id",
  "item_id",
  "option_id",
  "family_id",
  "pricing_key",
  "variant_id",
  "fixed_pricing_key",
  "variant_pricing_key",
] as const;

if (!rootElement) {
  throw new Error("Admin root element was not found.");
}

const root: HTMLElement = rootElement;
const deployedContentHash = getTrimmedValue(root.dataset.deployedContentHash) ?? "";
const defaultPublishCooldownSeconds = 60;
const requestedPublishHashStorageKey = "el-faraon-admin-requested-publish-hash";
const publishCooldownStorageKey = "el-faraon-admin-publish-cooldown-ends-at";
requestedPublishHash = readRequestedPublishHash();
publishCooldownEndsAt = readPublishCooldownEndsAt();
const adminOperations = createAdminOperations({
  runBusy,
  callMutation,
  loadAdminState,
  requireSession,
  publishMenuChanges: (session) => publishMenuChangesRequest(adminApiConfig, session),
  markCurrentPublicationRequested,
  rememberPublishCooldown,
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

  if (!confirmUnsavedChanges(form)) {
    return;
  }

  void handleFormSubmit(form).catch(handleUnexpectedError);
});

root.addEventListener("keydown", (event) => {
  const tab = event.target instanceof HTMLElement
    ? event.target.closest<HTMLButtonElement>('.admin-tab[role="tab"]')
    : null;

  if (!tab || !root.contains(tab)) {
    return;
  }

  handleTabKeydown(event, tab);
});

root.addEventListener("change", (event) => {
  const checkbox = event.target instanceof HTMLInputElement ? event.target : null;

  if (checkbox?.dataset.adminDescriptionToggle !== undefined) {
    toggleCatalogDescriptionField(checkbox);
    return;
  }

  const field = event.target instanceof HTMLSelectElement ? event.target : null;

  if (!field?.dataset.adminFilter) {
    return;
  }

  if (!confirmUnsavedChanges()) {
    field.value = field.dataset.previousValue ?? "";
    return;
  }

  setAdminFilter(field.dataset.adminFilter, field.value);
  field.dataset.previousValue = field.value;
  renderCurrentView();
});

root.addEventListener("input", (event) => {
  const target = event.target;

  if (target instanceof HTMLInputElement) {
    markContainingFormDirty(target);
    return;
  }

  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
    markContainingFormDirty(target);
  }
});

void startAdmin().catch(handleUnexpectedError);

async function startAdmin(): Promise<void> {
  if (!supabaseUrl || !supabaseAnonKey) {
    syncAdminViewContext();
    renderConfigurationError();
    focusViewStart();
    return;
  }

  const passwordSession = readPasswordSessionFromLocation();

  if (passwordSession) {
    currentSession = passwordSession;
    authView = "set-password";
    currentStatus = { text: "Definí una nueva contraseña para activar tu acceso.", tone: "neutral" };
    renderCurrentView({ focus: "view" });
    return;
  }

  currentSession = await getValidSession();

  if (!currentSession) {
    authView = "login";
    renderCurrentView({ focus: "view" });
    return;
  }

  await loadAdminState(undefined, "neutral", "view");
}

async function handleAction(target: HTMLElement): Promise<void> {
  const action = target.dataset.adminAction;

  if (action === "show-reset-request") {
    if (!confirmUnsavedChanges()) {
      return;
    }

    authView = "reset-request";
    currentStatus = null;
    renderCurrentView({ focus: "view" });
    return;
  }

  if (action === "show-login") {
    if (!confirmUnsavedChanges()) {
      return;
    }

    authView = "login";
    currentStatus = null;
    renderCurrentView({ focus: "view" });
    return;
  }

  if (action === "logout") {
    if (!confirmUnsavedChanges()) {
      return;
    }

    await logout();
    return;
  }

  if (action === "retry-admin-state") {
    await runBusy(async () => {
      await loadAdminState();
    }, "Reintentando...");
    return;
  }

  if (action === "tab") {
    const tab = target.dataset.adminTab as AdminTabId | undefined;

    if (tab) {
      selectAdminTab(tab, "tab");
    }

    return;
  }

  if (action === "service-section") {
    const section = target.dataset.adminServiceSection;

    if (
      currentState
      && (section === "active-service" || section === "daily-menu" || section === "grill")
      && isServiceSectionAvailable(currentState, section)
    ) {
      if (!confirmUnsavedChanges()) {
        return;
      }

      setAdminServiceSection(section);
      renderCurrentView();
    }

    return;
  }

  if (action === "set-overlay") {
    if (!confirmUnsavedChanges()) {
      return;
    }

    const familyKey = target.dataset.familyKey;
    const targetKey = target.dataset.targetKey;
    const available = target.dataset.available === "true";

    if (familyKey) {
      const familyTargets = findAvailabilityFamilyTargets(familyKey);

      if (familyTargets.length === 0) {
        setStatus("No se encontró la familia seleccionada.", "danger");
        return;
      }

      if (available) {
        await adminOperations.clearAvailabilityOverlayBatch(familyTargets);
      } else {
        await adminOperations.saveAvailabilityOverlayBatch(familyTargets, false);
      }

      return;
    }

    const availabilityTarget = targetKey ? findAvailabilityTarget(targetKey) : undefined;

    if (!availabilityTarget) {
      setStatus("No se encontró el item seleccionado.", "danger");
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
    if (!confirmUnsavedChanges()) {
      return;
    }

    const familyKey = target.dataset.familyKey;
    const targetKey = target.dataset.targetKey;

    if (familyKey) {
      const familyTargets = findAvailabilityFamilyTargets(familyKey);

      if (familyTargets.length === 0) {
        setStatus("No se encontró la familia seleccionada.", "danger");
        return;
      }

      await adminOperations.clearAvailabilityOverlayBatch(familyTargets);
      return;
    }

    const availabilityTarget = targetKey ? findAvailabilityTarget(targetKey) : undefined;

    if (!availabilityTarget) {
      setStatus("No se encontró el item seleccionado.", "danger");
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
      setStatus("No se encontró el item seleccionado.", "danger");
      return;
    }

    if (!confirmUnsavedChanges() || !confirmDeleteCatalogItem(item.name)) {
      return;
    }

    await adminOperations.deleteCatalogItem(item);
    return;
  }

  if (action === "delete-grill-item") {
    const itemId = target.dataset.itemId;
    const item = itemId ? findGrillItem(itemId) : undefined;

    if (!item) {
      setStatus("No se encontró la opción de parrilla seleccionada.", "danger");
      return;
    }

    if (!confirmUnsavedChanges() || !confirmDeleteGrillItem(item.variant_name ?? item.name)) {
      return;
    }

    await adminOperations.deleteGrillItem(item);
    return;
  }

  if (action === "delete-grill-product") {
    const familyId = target.dataset.familyId;
    const family = familyId ? findGrillFamily(familyId) : undefined;

    if (!family) {
      setStatus("No se encontró el producto de parrilla seleccionado.", "danger");
      return;
    }

    if (!confirmUnsavedChanges() || !confirmDeleteGrillProduct(family.title)) {
      return;
    }

    await adminOperations.deleteGrillProduct(family);
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
      setStatus("No se encontró la opción seleccionada.", "danger");
      return;
    }

    if (!confirmUnsavedChanges() || !confirmDeleteCatalogOption(option.name)) {
      return;
    }

    await adminOperations.deleteCatalogOption(option);
    return;
  }

  if (action === "publish") {
    const cooldownSecondsRemaining = getPublishCooldownSecondsRemaining();

    if (cooldownSecondsRemaining > 0) {
      setStatus(
        `Ya se pidió una publicación hace poco (${cooldownSecondsRemaining} segundos restantes). Los cambios quedan guardados; volvé a publicar cuando esté disponible.`,
        "neutral",
      );
      return;
    }

    if (!confirmUnsavedChanges() || !confirmPublishChanges()) {
      return;
    }

    await adminOperations.publishChanges();
  }
}

function handleTabKeydown(event: KeyboardEvent, currentTab: HTMLButtonElement): void {
  const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('.admin-tab[role="tab"]'));
  const currentIndex = tabs.indexOf(currentTab);

  if (currentIndex < 0) {
    return;
  }

  let nextIndex = currentIndex;

  if (event.key === "ArrowRight") {
    nextIndex = (currentIndex + 1) % tabs.length;
  } else if (event.key === "ArrowLeft") {
    nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
  } else if (event.key === "Home") {
    nextIndex = 0;
  } else if (event.key === "End") {
    nextIndex = tabs.length - 1;
  } else {
    return;
  }

  event.preventDefault();
  const tab = tabs[nextIndex]?.dataset.adminTab as AdminTabId | undefined;

  if (tab) {
    selectAdminTab(tab, "tab");
  }
}

function selectAdminTab(tab: AdminTabId, focus: RenderFocusMode = "preserve"): void {
  if (!confirmUnsavedChanges()) {
    return;
  }

  setAdminActiveTab(tab);
  renderCurrentView({ focus, tabId: tab });
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
    renderCurrentView({ focus: "view" });
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

  if (formKind === "grill-product") {
    await adminOperations.saveGrillProduct(form);
    return;
  }

  if (formKind === "grill-product-edit") {
    await adminOperations.saveGrillProductEdit(form);
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
    setStatus("Completa email y contraseña.", "danger");
    return;
  }

  await runBusy(async () => {
    currentSession = await signInWithPassword(adminApiConfig, email, password);
    authView = "login";
    saveStoredSession(currentSession);
    await loadAdminState("Sesión iniciada.", "success", "view");
  }, "Iniciando sesión...");
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
      text: "Te enviamos un link para definir una nueva contraseña. Revisá tu email.",
      tone: "success",
    };
    authView = "login";
    renderCurrentView({ focus: "view", revealStatus: true });
  }, "Enviando link...");
}

async function setPassword(form: HTMLFormElement): Promise<void> {
  const session = currentSession;

  if (!session) {
    authView = "login";
    renderCurrentView({ focus: "view" });
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
    await loadAdminState("Contraseña actualizada.", "success", "view");
  }, "Actualizando contraseña...");
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
    await loadAdminState("Contraseña actualizada.", "success");
  }, "Actualizando contraseña...");
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

  currentStatus = { text: "Sesión cerrada.", tone: "success" };
  renderCurrentView({ focus: "view", revealStatus: true });
}

async function loadAdminState(
  statusText?: AdminStatusText,
  statusTone: StatusTone = "neutral",
  focus: RenderFocusMode = "preserve",
): Promise<AdminOperationalState> {
  const session = await requireSession();
  const state = await loadAdminOperationalState(adminApiConfig, session);
  currentState = normalizeAdminState(state, deployedContentHash, requestedPublishHash);
  reconcileRequestedPublishHash(currentState);
  currentStatus = statusText ? { text: getAdminStatusText(statusText, currentState), tone: statusTone } : currentStatus;
  syncAdminViewContext();
  ensureActiveTab();
  renderCurrentView({ focus, revealStatus: Boolean(statusText) });
  return currentState;
}

function getAdminStatusText(statusText: AdminStatusText, state: AdminOperationalState): string {
  return typeof statusText === "function" ? statusText(state) : statusText;
}

async function callMutation(name: string, body: Record<string, unknown>): Promise<RpcResult> {
  const session = await requireSession();
  return callAdminMutation(adminApiConfig, session, name, body);
}

function markCurrentPublicationRequested(): void {
  const contentHash = currentState?.publication.current_content_hash;

  if (!contentHash) {
    return;
  }

  requestedPublishHash = contentHash;
  window.sessionStorage.setItem(requestedPublishHashStorageKey, contentHash);
}

function rememberPublishCooldown(result: RpcResult): void {
  const seconds = result.cooldown_seconds_remaining
    ?? (result.message === "publish_queued" ? defaultPublishCooldownSeconds : 0);

  if (typeof seconds !== "number" || !Number.isSafeInteger(seconds) || seconds <= 0) {
    return;
  }

  publishCooldownEndsAt = Date.now() + (seconds * 1000);
  window.localStorage.setItem(publishCooldownStorageKey, String(publishCooldownEndsAt));
}

function getPublishCooldownSecondsRemaining(): number {
  const millisecondsRemaining = publishCooldownEndsAt - Date.now();

  if (millisecondsRemaining <= 0) {
    publishCooldownEndsAt = 0;
    window.localStorage.removeItem(publishCooldownStorageKey);
    return 0;
  }

  return Math.ceil(millisecondsRemaining / 1000);
}

function reconcileRequestedPublishHash(state: AdminOperationalState): void {
  if (!requestedPublishHash) {
    return;
  }

  const currentContentHash = state.publication.current_content_hash;
  const activeDeployedContentHash = state.publication.deployed_content_hash;

  if (requestedPublishHash === currentContentHash && requestedPublishHash !== activeDeployedContentHash) {
    return;
  }

  requestedPublishHash = "";
  window.sessionStorage.removeItem(requestedPublishHashStorageKey);
  currentState = normalizeAdminState(state, deployedContentHash, requestedPublishHash);
}

function readRequestedPublishHash(): string {
  return window.sessionStorage.getItem(requestedPublishHashStorageKey) ?? "";
}

function readPublishCooldownEndsAt(): number {
  const value = Number(window.localStorage.getItem(publishCooldownStorageKey));
  return Number.isSafeInteger(value) && value > Date.now() ? value : 0;
}

async function requireSession(): Promise<AuthSession> {
  const session = await getValidSession();

  if (!session) {
    renderCurrentView({ focus: "view" });
    throw new Error("La sesión expiró. Volvé a iniciar sesión.");
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

function toggleCatalogDescriptionField(field: HTMLInputElement): void {
  const descriptionField = field.closest<HTMLElement>(".admin-description-field");

  if (!descriptionField) {
    return;
  }

  descriptionField.classList.toggle("admin-description-field--hidden", !field.checked);
}

function confirmPublishChanges(): boolean {
  return window.confirm(
    "Vas a publicar los cambios guardados de platos, parrilla, menú fijo, servicio activo y precios. La disponibilidad ya se aplica al instante. ¿Continuar?",
  );
}

function confirmDeleteGrillProduct(title: string): boolean {
  return window.confirm(
    `Vas a eliminar ${title} y todas sus opciones de parrilla. El cambio se verá después de publicar. ¿Continuar?`,
  );
}

function confirmDeleteCatalogItem(name: string): boolean {
  return window.confirm(
    `Vas a eliminar ${name} del menú fijo. El cambio se verá después de publicar. ¿Continuar?`,
  );
}

function confirmDeleteGrillItem(name: string): boolean {
  return window.confirm(
    `Vas a eliminar la opción ${name} de parrilla. El cambio se verá después de publicar. ¿Continuar?`,
  );
}

function confirmDeleteCatalogOption(name: string): boolean {
  return window.confirm(
    `Vas a eliminar el sabor ${name}. El cambio se verá después de publicar. ¿Continuar?`,
  );
}

function setStatus(text: string, tone: StatusTone): void {
  currentStatus = { text, tone };
  renderCurrentView({ revealStatus: true });
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
    ? "No se pudo conectar. Revisá la conexión e intentá de nuevo."
    : error instanceof Error
      ? toOperationalErrorMessage(error.message)
      : "Ocurrió un error inesperado.";
  currentStatus = { text: message, tone: "danger" };
  renderCurrentView({ revealStatus: true });
}

function renderCurrentView(options: RenderOptions = {}): void {
  const focus = options.focus ?? "preserve";
  const snapshot = focus === "preserve" ? captureInteraction() : null;

  syncAdminViewContext();

  if (currentSession && currentState) {
    renderAuthenticated();
  } else if (authView === "reset-request") {
    renderPasswordResetRequest();
  } else if (authView === "set-password") {
    renderSetPassword();
  } else {
    renderLogin();
  }

  syncFormBaselines();
  syncFilterValues();

  if (focus === "view") {
    focusViewStart();
  } else if (focus === "tab" && options.tabId) {
    focusTab(options.tabId);
  } else if (snapshot) {
    restoreInteraction(snapshot);
  }

  if (options.revealStatus) {
    revealStatus();
  }
}

function captureInteraction(): InteractionSnapshot {
  const activeElement = document.activeElement;
  const field = activeElement instanceof HTMLInputElement
    || activeElement instanceof HTMLSelectElement
    || activeElement instanceof HTMLTextAreaElement
    ? activeElement
    : null;
  const form = field?.closest<HTMLFormElement>("form");

  return {
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    formKind: form?.dataset.adminForm ?? "",
    fieldName: field?.name ?? "",
    formKeys: form ? getFormKeys(form) : {},
  };
}

function restoreInteraction(snapshot: InteractionSnapshot): void {
  window.scrollTo(snapshot.scrollX, snapshot.scrollY);

  if (!snapshot.formKind || !snapshot.fieldName) {
    return;
  }

  const form = findMatchingForm(snapshot);
  const field = form?.elements.namedItem(snapshot.fieldName);

  if (
    field instanceof HTMLInputElement
    || field instanceof HTMLSelectElement
    || field instanceof HTMLTextAreaElement
  ) {
    field.focus({ preventScroll: true });
  }
}

function findMatchingForm(snapshot: InteractionSnapshot): HTMLFormElement | null {
  const forms = Array.from(root.querySelectorAll<HTMLFormElement>("form"));

  return forms.find((form) =>
    form.dataset.adminForm === snapshot.formKind
    && formKeysMatch(getFormKeys(form), snapshot.formKeys)
  ) ?? null;
}

function formKeysMatch(current: Record<string, string>, expected: Record<string, string>): boolean {
  return Object.entries(expected).every(([key, value]) => current[key] === value);
}

function getFormKeys(form: HTMLFormElement): Record<string, string> {
  const keys: Record<string, string> = {};

  formKeyNames.forEach((key) => {
    const value = getFormValue(form, key);

    if (value) {
      keys[key] = value;
    }
  });

  return keys;
}

function getFormValue(form: HTMLFormElement, name: string): string {
  const field = form.elements.namedItem(name);

  if (
    field instanceof HTMLInputElement
    || field instanceof HTMLSelectElement
    || field instanceof HTMLTextAreaElement
  ) {
    return field.value;
  }

  return "";
}

function syncFormBaselines(): void {
  root.querySelectorAll<HTMLFormElement>("form").forEach((form) => {
    formBaselines.set(form, serializeForm(form));
    delete form.dataset.dirty;
  });
}

function syncFilterValues(): void {
  root.querySelectorAll<HTMLSelectElement>("select[data-admin-filter]").forEach((field) => {
    field.dataset.previousValue = field.value;
  });
}

function markContainingFormDirty(field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): void {
  const form = field.closest<HTMLFormElement>("form");

  if (!form) {
    return;
  }

  form.dataset.dirty = isDirtyForm(form) ? "true" : "false";
}

function isDirtyForm(form: HTMLFormElement): boolean {
  const baseline = formBaselines.get(form);

  if (baseline === undefined) {
    formBaselines.set(form, serializeForm(form));
    return false;
  }

  return serializeForm(form) !== baseline;
}

function getDirtyForms(exceptForm?: HTMLFormElement): HTMLFormElement[] {
  return Array.from(root.querySelectorAll<HTMLFormElement>("form"))
    .filter((form) => form !== exceptForm && isDirtyForm(form));
}

function confirmUnsavedChanges(exceptForm?: HTMLFormElement): boolean {
  if (getDirtyForms(exceptForm).length === 0) {
    return true;
  }

  return window.confirm(
    "Hay cambios sin guardar en otro formulario. Si continuás, esos cambios se van a perder. ¿Continuar?",
  );
}

function serializeForm(form: HTMLFormElement): string {
  return JSON.stringify(
    Array.from(new FormData(form).entries()).map(([key, value]) => [key, String(value)]),
  );
}

function focusViewStart(): void {
  const target = root.querySelector<HTMLElement>("[data-admin-initial-focus]")
    ?? root.querySelector<HTMLElement>("[data-admin-view-heading]");

  target?.focus({ preventScroll: true });
}

function focusTab(tabId: AdminTabId): void {
  root.querySelector<HTMLElement>(`[data-admin-tab="${tabId}"]`)?.focus({ preventScroll: true });
}

function revealStatus(): void {
  root.querySelector<HTMLElement>(".admin-status")?.scrollIntoView({ block: "nearest" });
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
    setStatus("Completa la nueva contraseña y su confirmación.", "danger");
    return false;
  }

  if (password.length < 8) {
    setStatus("La contraseña debe tener al menos 8 caracteres.", "danger");
    return false;
  }

  if (password !== passwordConfirmation) {
    setStatus("Las contraseñas no coinciden.", "danger");
    return false;
  }

  return true;
}
