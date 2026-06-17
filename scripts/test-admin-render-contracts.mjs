import assert from "node:assert/strict";
import test from "node:test";
import {
  compileAdminModules,
  createState,
  createViewState,
} from "./test-admin-helpers.mjs";

const { requireAdminModule } = await compileAdminModules("admin-render-contracts-tests", [
  "src/admin/adminAuthView.ts",
  "src/admin/adminShellView.ts",
  "src/admin/adminAvailabilityView.ts",
  "src/admin/adminFixedMenuView.ts",
  "src/admin/adminServiceView.ts",
  "src/admin/adminContracts.ts",
  "src/admin/adminTypes.ts",
  "src/admin/adminUtils.ts",
]);

const authView = requireAdminModule("adminAuthView");
const shellView = requireAdminModule("adminShellView");
const availabilityView = requireAdminModule("adminAvailabilityView");
const fixedMenuView = requireAdminModule("adminFixedMenuView");
const serviceView = requireAdminModule("adminServiceView");
const { adminForms, adminActions } = requireAdminModule("adminContracts");

test("login view exposes the login form contract", () => {
  const html = authView.renderLoginView({
    isBusy: false,
    currentStatus: null,
    currentBusyText: null,
  });

  assert.ok(hasForm(html, adminForms.login));
});

test("admin shell tabs use the tab action contract", () => {
  const state = createState();
  const html = shellView.renderAdminShell({
    state,
    viewState: createViewState({ activeTab: "availability" }),
    tabs: [
      { id: "availability", label: "Disponibilidad" },
      { id: "account", label: "Cuenta" },
    ],
    tabContent: "<p>content</p>",
    currentStatus: null,
    currentBusyText: null,
    isBusy: false,
  });

  assert.ok(hasAction(html, adminActions.tab));
  assert.ok(html.includes('data-admin-tab="availability"'));
  assert.ok(html.includes('data-admin-tab="account"'));
});

test("availability view exposes set and clear overlay actions", () => {
  const html = availabilityView.renderAvailabilityTab(
    createState(),
    createViewState({
      availabilityProfileFilter: "corpo",
      availabilityGroupFilter: "section:guarniciones",
    }),
    false,
  );

  assert.ok(hasAction(html, adminActions.setOverlay));
  assert.ok(hasAction(html, adminActions.clearOverlay));
});

test("fixed menu view exposes item, option, and price form contracts", () => {
  const state = createState();
  const itemHtml = fixedMenuView.renderFixedMenuTab(
    state,
    createViewState({ activeTab: "fixed", fixedSectionFilter: "guarniciones" }),
    false,
  );
  const optionHtml = fixedMenuView.renderFixedMenuTab(
    state,
    createViewState({ activeTab: "fixed", fixedSectionFilter: "empanadas" }),
    false,
  );

  assert.ok(hasForm(itemHtml, adminForms.catalogItem));
  assert.ok(hasForm(itemHtml, adminForms.catalogItemEdit));
  assert.ok(hasForm(optionHtml, adminForms.catalogOption));
  assert.ok(hasForm(optionHtml, adminForms.catalogOptionEdit));
  assert.ok(hasForm(optionHtml, adminForms.variantPrice));
});

test("service view exposes daily menu and fixed price contracts", () => {
  const html = serviceView.renderServiceTab(
    createState(),
    createViewState({ activeTab: "service", activeServiceSection: "daily-menu" }),
    false,
  );

  assert.ok(hasForm(html, adminForms.dailyMenu));
  assert.ok(hasForm(html, adminForms.fixedPrice));
});

test("publish banner shows publish only when publication is pending and not requested", () => {
  const pendingState = createState({
    publication: {
      has_unpublished_changes: true,
      publish_requested: false,
    },
  });
  const requestedState = createState({
    publication: {
      has_unpublished_changes: true,
      publish_requested: true,
    },
  });
  const deniedState = createState({
    permissions: {
      can_publish_menu: false,
    },
    publication: {
      has_unpublished_changes: true,
      publish_requested: false,
    },
  });

  assert.ok(hasAction(renderShell(pendingState), adminActions.publish));
  assert.equal(hasAction(renderShell(requestedState), adminActions.publish), false);
  assert.equal(hasAction(renderShell(deniedState), adminActions.publish), false);
});

function renderShell(state) {
  return shellView.renderAdminShell({
    state,
    viewState: createViewState(),
    tabs: [{ id: "availability", label: "Disponibilidad" }],
    tabContent: "",
    currentStatus: null,
    currentBusyText: null,
    isBusy: false,
  });
}

function hasForm(html, form) {
  return html.includes(`data-admin-form="${form}"`);
}

function hasAction(html, action) {
  return html.includes(`data-admin-action="${action}"`);
}
