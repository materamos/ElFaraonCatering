import type {
  AdminOperationalState,
  AdminTabId,
  RpcResult,
  StatusMessage,
  StatusTone,
} from "./core/types";
import {
  callMutation as callAdminMutation,
  loadAdminOperationalState,
  publishMenuChanges as publishMenuChangesRequest,
} from "./api/client";
import { createAdminFormState } from "./app/formState";
import { createAdminPublicationState } from "./app/publicationState";
import { createAdminSessionController } from "./app/session";
import { createAdminOperations } from "./operations/menuOperations";
import { adminActions, adminForms } from "./core/contracts";
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
} from "./views/renderer";
import {
  getTrimmedValue,
  normalizeAdminState,
  normalizeSupabaseProjectUrl,
  toOperationalErrorMessage,
} from "./core/utils";

const rootElement = document.querySelector<HTMLElement>("[data-admin-root]");

const supabaseUrl = normalizeSupabaseProjectUrl(import.meta.env.PUBLIC_SUPABASE_URL);
const supabaseAnonKey = getTrimmedValue(import.meta.env.PUBLIC_SUPABASE_ANON_KEY);
const configuredSupabaseUrl = supabaseUrl ?? "";
const configuredSupabaseAnonKey = supabaseAnonKey ?? "";
const adminApiConfig = {
  supabaseUrl: configuredSupabaseUrl,
  supabaseAnonKey: configuredSupabaseAnonKey,
};

let currentState: AdminOperationalState | null = null;
let currentStatus: StatusMessage | null = null;
let currentBusyText: string | null = null;
let isBusy = false;

type AdminStatusText = string | ((state: AdminOperationalState) => string);
type RenderFocusMode = "preserve" | "view" | "tab";

interface RenderOptions {
  focus?: RenderFocusMode;
  tabId?: AdminTabId;
  revealStatus?: boolean;
}

if (!rootElement) {
  throw new Error("Admin root element was not found.");
}

const root: HTMLElement = rootElement;
const deployedContentHash = getTrimmedValue(root.dataset.deployedContentHash) ?? "";
const formState = createAdminFormState(root);
const publicationState = createAdminPublicationState(deployedContentHash);
const sessionController = createAdminSessionController({
  config: adminApiConfig,
  hasApiConfig: Boolean(supabaseUrl && supabaseAnonKey),
  loadAdminState,
  renderCurrentView,
  runBusy,
  setAdminState,
  setStatus,
  setStatusMessage,
});
const adminOperations = createAdminOperations({
  runBusy,
  callMutation,
  loadAdminState,
  requireSession: sessionController.requireSession,
  publishMenuChanges: (session) => publishMenuChangesRequest(adminApiConfig, session),
  markCurrentPublicationRequested: () => publicationState.markCurrentPublicationRequested(currentState),
  rememberPublishCooldown: publicationState.rememberPublishCooldown,
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

  if (!formState.confirmUnsavedChanges(form)) {
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

  if (!formState.confirmUnsavedChanges()) {
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
    formState.markContainingFormDirty(target);
    return;
  }

  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
    formState.markContainingFormDirty(target);
  }
});

void sessionController.start(renderConfigurationProblem).catch(handleUnexpectedError);

function renderConfigurationProblem(): void {
  syncAdminViewContext();
  renderConfigurationError();
  formState.focusViewStart();
}

async function handleAction(target: HTMLElement): Promise<void> {
  const action = target.dataset.adminAction;

  if (action === adminActions.showResetRequest) {
    if (!formState.confirmUnsavedChanges()) {
      return;
    }

    sessionController.setAuthView("reset-request");
    currentStatus = null;
    renderCurrentView({ focus: "view" });
    return;
  }

  if (action === adminActions.showLogin) {
    if (!formState.confirmUnsavedChanges()) {
      return;
    }

    sessionController.setAuthView("login");
    currentStatus = null;
    renderCurrentView({ focus: "view" });
    return;
  }

  if (action === adminActions.logout) {
    if (!formState.confirmUnsavedChanges()) {
      return;
    }

    await sessionController.logout();
    return;
  }

  if (action === adminActions.retryAdminState) {
    await runBusy(async () => {
      await loadAdminState();
    }, "Reintentando...");
    return;
  }

  if (action === adminActions.tab) {
    const tab = target.dataset.adminTab as AdminTabId | undefined;

    if (tab) {
      selectAdminTab(tab, "tab");
    }

    return;
  }

  if (action === adminActions.serviceSection) {
    const section = target.dataset.adminServiceSection;

    if (
      currentState
      && (section === "active-service" || section === "daily-menu" || section === "grill")
      && isServiceSectionAvailable(currentState, section)
    ) {
      if (!formState.confirmUnsavedChanges()) {
        return;
      }

      setAdminServiceSection(section);
      renderCurrentView();
    }

    return;
  }

  if (action === adminActions.setOverlay) {
    if (!formState.confirmUnsavedChanges()) {
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

  if (action === adminActions.clearOverlay) {
    if (!formState.confirmUnsavedChanges()) {
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

  if (action === adminActions.deleteCatalogItem) {
    const sectionId = target.dataset.sectionId;
    const itemId = target.dataset.itemId;
    const item = sectionId && itemId ? findCatalogItem(sectionId, itemId) : undefined;

    if (!item) {
      setStatus("No se encontró el item seleccionado.", "danger");
      return;
    }

    if (!formState.confirmUnsavedChanges() || !confirmDeleteCatalogItem(item.name)) {
      return;
    }

    await adminOperations.deleteCatalogItem(item);
    return;
  }

  if (action === adminActions.deleteGrillItem) {
    const itemId = target.dataset.itemId;
    const item = itemId ? findGrillItem(itemId) : undefined;

    if (!item) {
      setStatus("No se encontró la opción de parrilla seleccionada.", "danger");
      return;
    }

    if (!formState.confirmUnsavedChanges() || !confirmDeleteGrillItem(item.variant_name ?? item.name)) {
      return;
    }

    await adminOperations.deleteGrillItem(item);
    return;
  }

  if (action === adminActions.deleteGrillProduct) {
    const familyId = target.dataset.familyId;
    const family = familyId ? findGrillFamily(familyId) : undefined;

    if (!family) {
      setStatus("No se encontró el producto de parrilla seleccionado.", "danger");
      return;
    }

    if (!formState.confirmUnsavedChanges() || !confirmDeleteGrillProduct(family.title)) {
      return;
    }

    await adminOperations.deleteGrillProduct(family);
    return;
  }

  if (action === adminActions.deleteCatalogOption) {
    const sectionId = target.dataset.sectionId;
    const itemId = target.dataset.itemId;
    const optionId = target.dataset.optionId;
    const option = sectionId && itemId && optionId
      ? findCatalogItemOption(sectionId, itemId, optionId)
      : undefined;

    if (!option) {
      setStatus("No se encontró la opción seleccionada.", "danger");
      return;
    }

    if (!formState.confirmUnsavedChanges() || !confirmDeleteCatalogOption(option.name)) {
      return;
    }

    await adminOperations.deleteCatalogOption(option);
    return;
  }

  if (action === adminActions.publish) {
    const cooldownSecondsRemaining = publicationState.getCooldownSecondsRemaining();

    if (cooldownSecondsRemaining > 0) {
      setStatus(
        `Ya se pidió una publicación hace poco (${cooldownSecondsRemaining} segundos restantes). Los cambios quedan guardados; volvé a publicar cuando esté disponible.`,
        "neutral",
      );
      return;
    }

    if (!formState.confirmUnsavedChanges() || !confirmPublishChanges()) {
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
  if (!formState.confirmUnsavedChanges()) {
    return;
  }

  setAdminActiveTab(tab);
  renderCurrentView({ focus, tabId: tab });
}

async function handleFormSubmit(form: HTMLFormElement): Promise<void> {
  const formKind = form.dataset.adminForm;

  if (formKind === adminForms.login) {
    await sessionController.login(form);
    return;
  }

  if (formKind === adminForms.passwordResetRequest) {
    await sessionController.requestPasswordReset(form);
    return;
  }

  if (formKind === adminForms.setPassword) {
    await sessionController.setPassword(form);
    return;
  }

  if (!sessionController.getCurrentSession()) {
    sessionController.setAuthView("login");
    renderCurrentView({ focus: "view" });
    return;
  }

  if (formKind === adminForms.dailyMenu) {
    await adminOperations.saveDailyMenu(form);
    return;
  }

  if (formKind === adminForms.serviceKind) {
    await adminOperations.saveServiceKind(form);
    return;
  }

  if (formKind === adminForms.grillItem) {
    await adminOperations.saveGrillItem(form);
    return;
  }

  if (formKind === adminForms.grillProduct) {
    await adminOperations.saveGrillProduct(form);
    return;
  }

  if (formKind === adminForms.grillProductEdit) {
    await adminOperations.saveGrillProductEdit(form);
    return;
  }

  if (formKind === adminForms.grillItemEdit) {
    await adminOperations.saveGrillItemEdit(form);
    return;
  }

  if (formKind === adminForms.fixedPrice) {
    await adminOperations.saveFixedPrice(form);
    return;
  }

  if (formKind === adminForms.variantPrice) {
    await adminOperations.saveVariantPrice(form);
    return;
  }

  if (formKind === adminForms.catalogItem) {
    await adminOperations.saveCatalogItem(form);
    return;
  }

  if (formKind === adminForms.catalogItemEdit) {
    await adminOperations.saveCatalogItemEdit(form);
    return;
  }

  if (formKind === adminForms.catalogOption) {
    await adminOperations.saveCatalogOption(form);
    return;
  }

  if (formKind === adminForms.catalogOptionEdit) {
    await adminOperations.saveCatalogOptionEdit(form);
    return;
  }

  if (formKind === adminForms.changePassword) {
    await sessionController.changePassword(form);
  }
}

async function loadAdminState(
  statusText?: AdminStatusText,
  statusTone: StatusTone = "neutral",
  focus: RenderFocusMode = "preserve",
): Promise<AdminOperationalState> {
  const session = await sessionController.requireSession();
  const state = await loadAdminOperationalState(adminApiConfig, session);
  currentState = normalizeAdminState(state, deployedContentHash, publicationState.getRequestedPublishHash());
  currentState = publicationState.reconcileState(currentState);
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
  const session = await sessionController.requireSession();
  return callAdminMutation(adminApiConfig, session, name, body);
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

function setAdminState(state: AdminOperationalState | null): void {
  currentState = state;
}

function setStatusMessage(message: StatusMessage | null): void {
  currentStatus = message;
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
  const snapshot = focus === "preserve" ? formState.captureInteraction() : null;

  syncAdminViewContext();

  if (sessionController.getCurrentSession() && currentState) {
    renderAuthenticated();
  } else if (sessionController.getAuthView() === "reset-request") {
    renderPasswordResetRequest();
  } else if (sessionController.getAuthView() === "set-password") {
    renderSetPassword();
  } else {
    renderLogin();
  }

  formState.syncFormBaselines();
  formState.syncFilterValues();

  if (focus === "view") {
    formState.focusViewStart();
  } else if (focus === "tab" && options.tabId) {
    formState.focusTab(options.tabId);
  } else if (snapshot) {
    formState.restoreInteraction(snapshot);
  }

  if (options.revealStatus) {
    formState.revealStatus();
  }
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
