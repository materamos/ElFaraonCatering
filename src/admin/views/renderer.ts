import type {
  AdminOperationalState,
  AdminTabId,
  StatusMessage,
} from "../core/types";
import {
  renderConfigurationErrorHtml,
  renderDeniedView,
  renderLoginView,
  renderPasswordResetRequestView,
  renderSetPasswordView,
} from "./auth";
import { renderAdminShell } from "./shell";
import { renderAvailabilityTab } from "./availability";
import { renderServiceTab } from "./service";
import { renderFixedMenuTab } from "./fixedMenu";
import { renderAccountTab } from "./account";
import {
  getAdminViewState,
  setActiveServiceSectionFallback,
  setAdminActiveTab,
} from "../core/viewState";
import {
  getAllowedTabs,
  isServiceSectionAvailable,
} from "../core/rules";

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
