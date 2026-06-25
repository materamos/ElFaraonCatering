import type { AdminTabId, ServiceSectionId } from "./types";

export interface AdminViewState {
  activeTab: AdminTabId;
  activeServiceSection: ServiceSectionId;
  availabilityProfileFilter: string;
  availabilityGroupFilter: string;
  hiddenAvailabilityProfileFilter: string;
  fixedSectionFilter: string;
}

let activeTab: AdminTabId = "availability";
let activeServiceSection: ServiceSectionId = "active-service";
let availabilityProfileFilter = "";
let availabilityGroupFilter = "";
let hiddenAvailabilityProfileFilter = "";
let fixedSectionFilter = "";

export function getAdminViewState(): AdminViewState {
  return {
    activeTab,
    activeServiceSection,
    availabilityProfileFilter,
    availabilityGroupFilter,
    hiddenAvailabilityProfileFilter,
    fixedSectionFilter,
  };
}

export function setAdminActiveTab(tab: AdminTabId): void {
  activeTab = tab;
}

export function setAdminServiceSection(section: ServiceSectionId): void {
  activeServiceSection = section;
}

export function setAdminFilter(name: string, value: string): void {
  if (name === "hidden-availability-profile") {
    hiddenAvailabilityProfileFilter = value;
    availabilityProfileFilter = value;
    availabilityGroupFilter = "";
    return;
  }

  if (name === "availability-profile") {
    availabilityProfileFilter = value;
    hiddenAvailabilityProfileFilter = value;
    availabilityGroupFilter = "";
    return;
  }

  if (name === "availability-group") {
    availabilityGroupFilter = value;
    return;
  }

  if (name === "fixed-section") {
    fixedSectionFilter = value;
  }
}

export function setActiveServiceSectionFallback(section: ServiceSectionId): void {
  activeServiceSection = section;
}
