export const adminForms = {
  login: "login",
  passwordResetRequest: "password-reset-request",
  setPassword: "set-password",
  dailyMenu: "daily-menu",
  serviceKind: "service-kind",
  grillItem: "grill-item",
  grillProduct: "grill-product",
  grillProductEdit: "grill-product-edit",
  grillItemEdit: "grill-item-edit",
  fixedPrice: "fixed-price",
  variantPrice: "variant-price",
  catalogItem: "catalog-item",
  catalogItemEdit: "catalog-item-edit",
  catalogOption: "catalog-option",
  catalogOptionEdit: "catalog-option-edit",
  changePassword: "change-password",
} as const;

export type AdminForm = (typeof adminForms)[keyof typeof adminForms];

export const adminFilters = {
  availabilityProfile: "availability-profile",
  availabilityGroup: "availability-group",
  hiddenAvailabilityProfile: "hidden-availability-profile",
  fixedSection: "fixed-section",
} as const;

export type AdminFilter = (typeof adminFilters)[keyof typeof adminFilters];

export const adminActions = {
  showResetRequest: "show-reset-request",
  showLogin: "show-login",
  logout: "logout",
  retryAdminState: "retry-admin-state",
  tab: "tab",
  serviceSection: "service-section",
  hiddenAvailabilityProfile: "hidden-availability-profile",
  setOverlay: "set-overlay",
  clearOverlay: "clear-overlay",
  deleteCatalogItem: "delete-catalog-item",
  deleteGrillItem: "delete-grill-item",
  deleteGrillProduct: "delete-grill-product",
  deleteCatalogOption: "delete-catalog-option",
  publish: "publish",
} as const;

export type AdminAction = (typeof adminActions)[keyof typeof adminActions];
