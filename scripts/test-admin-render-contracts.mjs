import assert from "node:assert/strict";
import test from "node:test";
import {
  compileAdminModules,
  createCatalogItem,
  createState,
  createTarget,
  createViewState,
} from "./test-admin-helpers.mjs";

const { requireAdminModule } = await compileAdminModules("admin-render-contracts-tests", [
  "src/admin/views/auth.ts",
  "src/admin/views/shell.ts",
  "src/admin/views/availability.ts",
  "src/admin/views/fixedMenu.ts",
  "src/admin/views/service.ts",
  "src/admin/core/contracts.ts",
  "src/admin/core/types.ts",
]);

const authView = requireAdminModule("views/auth");
const shellView = requireAdminModule("views/shell");
const availabilityView = requireAdminModule("views/availability");
const fixedMenuView = requireAdminModule("views/fixedMenu");
const serviceView = requireAdminModule("views/service");
const { adminForms, adminActions } = requireAdminModule("core/contracts");

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

test("availability view groups catalog options under their parent item", () => {
  const sectionId = "tartas-tortillas-omelettes";
  const state = createState({
    availability_targets: [
      createTarget("corpo", "catalog", sectionId, "tartas", "Tartas"),
      createTarget("corpo", "catalog", sectionId, "tartas-jamon-queso", "Tartas - Jamon y queso"),
      createTarget("corpo", "catalog", sectionId, "tortilla", "Tortilla"),
      createTarget("corpo", "catalog", sectionId, "omelette", "Omelette"),
      createTarget("corpo", "catalog", sectionId, "tartas-jamon-verdeo", "Tartas - Jamon y verdeo"),
    ],
    catalog_editor: {
      sections: [{ section_id: sectionId, title: "Tartas, tortillas y omelettes", order_index: 0, item_count: 3 }],
      items: [
        {
          ...createCatalogItem(sectionId, "tartas", "Tartas", ["jamon-queso", "jamon-verdeo"]),
          options: [
            {
              section_id: sectionId,
              item_id: "tartas",
              option_id: "jamon-queso",
              name: "Jamon y queso",
              order_index: 0,
            },
            {
              section_id: sectionId,
              item_id: "tartas",
              option_id: "jamon-verdeo",
              name: "Jamon y verdeo",
              order_index: 1,
            },
          ],
        },
        createCatalogItem(sectionId, "tortilla", "Tortilla", []),
        createCatalogItem(sectionId, "omelette", "Omelette", []),
      ],
    },
  });
  const html = availabilityView.renderAvailabilityTab(
    state,
    createViewState({
      availabilityProfileFilter: "corpo",
      availabilityGroupFilter: `section:${sectionId}`,
    }),
    false,
  );

  assert.ok(html.includes('data-target-key="corpo/tartas-tortillas-omelettes/tartas-jamon-queso"'));
  assert.ok(html.includes('class="admin-row admin-row--nested"'));
  assertOrder(html, [
    "Tartas",
    "Jamon y queso",
    "Jamon y verdeo",
    "Tortilla",
    "Omelette",
  ]);
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

function assertOrder(text, values) {
  let lastIndex = -1;

  for (const value of values) {
    const index = text.indexOf(value);

    assert.ok(index > lastIndex, `${value} should appear after the previous value`);
    lastIndex = index;
  }
}
