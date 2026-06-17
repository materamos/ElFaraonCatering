import type {
  AdminOperationalState,
  AdminTabId,
  AvailabilityTargetState,
  CatalogItemOptionState,
  CatalogItemState,
  GrillFamilyState,
  GrillItemState,
  StatusMessage,
} from "./adminTypes";
import {
  renderConfigurationErrorHtml,
  renderDeniedView,
  renderLoginView,
  renderPasswordResetRequestView,
  renderSetPasswordView,
} from "./adminAuthView";
import { renderAdminShell } from "./adminShellView";
import { renderAvailabilityTab } from "./adminAvailabilityView";
import { renderServiceTab } from "./adminServiceView";
import { renderFixedMenuTab } from "./adminFixedMenuView";
import { renderAccountTab } from "./adminAccountView";
import {
  getAdminViewState,
  setActiveServiceSectionFallback,
  setAdminActiveTab,
  setAdminFilter,
  setAdminServiceSection,
} from "./adminViewState";
import {
  getAllowedTabs,
  isServiceSectionAvailable,
} from "./adminRules";
import {
  findAvailabilityFamilyTargets as selectAvailabilityFamilyTargets,
  findAvailabilityTarget as selectAvailabilityTarget,
  findCatalogItem as selectCatalogItem,
  findCatalogItemOption as selectCatalogItemOption,
  findGrillFamily as selectGrillFamily,
  findGrillItem as selectGrillItem,
} from "./adminSelectors";

interface AdminViewContext {
  root: HTMLElement;
  currentState: AdminOperationalState | null;
  currentStatus: StatusMessage | null;
  currentBusyText: string | null;
  isBusy: boolean;
}

let root: HTMLElement;
let currentState: AdminOperationalState | null = null;
let currentStatus: StatusMessage | null = null;
let currentBusyText: string | null = null;
let isBusy = false;

export { setAdminActiveTab, setAdminFilter, setAdminServiceSection, isServiceSectionAvailable };

export function setAdminViewContext(context: AdminViewContext): void {
  root = context.root;
  currentState = context.currentState;
  currentStatus = context.currentStatus;
  currentBusyText = context.currentBusyText;
  isBusy = context.isBusy;
}

export function renderConfigurationError(): void {
  root.innerHTML = renderConfigurationErrorHtml();
}

export function renderLogin(): void {
  root.innerHTML = renderLoginView({ currentStatus, currentBusyText, isBusy });
}

export function renderPasswordResetRequest(): void {
  root.innerHTML = renderPasswordResetRequestView({ currentStatus, currentBusyText, isBusy });
}

export function renderSetPassword(): void {
  root.innerHTML = renderSetPasswordView({ currentStatus, currentBusyText, isBusy });
}

export function renderAuthenticated(): void {
  if (!currentState?.ok || !currentState.staff) {
    renderDenied();
    return;
  }

  ensureActiveTab();
  ensureActiveServiceSection(currentState);

  const viewState = getAdminViewState();
  const tabs = getAllowedTabs(currentState);

  root.innerHTML = renderAdminShell({
    state: currentState,
    viewState,
    tabs,
    tabContent: renderActiveTab(currentState, viewState.activeTab),
    currentStatus,
    currentBusyText,
    isBusy,
  });
}

function renderDenied(): void {
  const message = currentState?.message === "staff_access_denied"
    ? "Tu usuario no tiene acceso activo al panel operativo."
    : "No se pudo cargar el panel operativo.";

  root.innerHTML = renderDeniedView({
    message,
    currentStatus,
    currentBusyText,
    isBusy,
  });
}

function renderActiveTab(state: AdminOperationalState, activeTab: AdminTabId): string {
  const viewState = getAdminViewState();

  if (activeTab === "service") {
    return renderServiceTab(state, viewState, isBusy);
  }

  if (activeTab === "availability") {
    return renderAvailabilityTab(state, viewState, isBusy);
  }

  if (activeTab === "fixed") {
    return renderFixedMenuTab(state, viewState, isBusy);
  }

  return renderAccountTab(isBusy);
}

export function ensureActiveTab(): void {
  if (!currentState) {
    return;
  }

  const activeTab = getAdminViewState().activeTab;
  const allowedTabs = getAllowedTabs(currentState);

  if (!allowedTabs.some((tab) => tab.id === activeTab)) {
    setAdminActiveTab(allowedTabs[0]?.id ?? "account");
  }
}

export function ensureActiveServiceSection(state: AdminOperationalState): void {
  const activeServiceSection = getAdminViewState().activeServiceSection;

  if (isServiceSectionAvailable(state, activeServiceSection)) {
    return;
  }

  setActiveServiceSectionFallback("active-service");
}

export function findAvailabilityTarget(key: string): AvailabilityTargetState | undefined {
  return currentState ? selectAvailabilityTarget(currentState, key) : undefined;
}

export function findAvailabilityFamilyTargets(key: string): AvailabilityTargetState[] {
  return currentState ? selectAvailabilityFamilyTargets(currentState, key) : [];
}

export function findCatalogItem(
  sectionId: string,
  itemId: string,
): CatalogItemState | undefined {
  return currentState ? selectCatalogItem(currentState, sectionId, itemId) : undefined;
}

export function findCatalogItemOption(
  sectionId: string,
  itemId: string,
  optionId: string,
): CatalogItemOptionState | undefined {
  return currentState ? selectCatalogItemOption(currentState, sectionId, itemId, optionId) : undefined;
}

export function findGrillItem(itemId: string): GrillItemState | undefined {
  return currentState ? selectGrillItem(currentState, itemId) : undefined;
}

export function findGrillFamily(familyId: string): GrillFamilyState | undefined {
  return currentState ? selectGrillFamily(currentState, familyId) : undefined;
}
