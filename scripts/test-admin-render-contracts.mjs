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

test("availability rows show item name with profile only", () => {
  const html = availabilityView.renderAvailabilityTab(
    createState(),
    createViewState({
      availabilityProfileFilter: "corpo",
      availabilityGroupFilter: "section:guarniciones",
    }),
    false,
  );

  assert.ok(html.includes('Papas <span class="admin-row__title-meta">- corpo</span>'));
  assert.equal(html.includes("Menú fijo · corpo · guarniciones"), false);
  assert.equal(html.includes("guarniciones · Papas"), false);
});

test("availability view renders hidden summary before filters", () => {
  const html = availabilityView.renderAvailabilityTab(
    createHiddenAvailabilityState(),
    createViewState({
      availabilityProfileFilter: "corpo",
      availabilityGroupFilter: "section:guarniciones",
    }),
    false,
  );
  const summaryIndex = html.indexOf("admin-availability-summary");
  const filtersIndex = html.indexOf('data-admin-filter="availability-profile"');

  assert.ok(summaryIndex > -1);
  assert.ok(filtersIndex > -1);
  assert.ok(summaryIndex < filtersIndex);
});

test("availability hidden summary shows both profiles and ignores active filters", () => {
  const state = createHiddenAvailabilityState();
  const corpoHtml = availabilityView.renderAvailabilityTab(
    state,
    createViewState({
      availabilityProfileFilter: "corpo",
      availabilityGroupFilter: "section:guarniciones",
    }),
    false,
  );
  const teleindeHtml = availabilityView.renderAvailabilityTab(
    state,
    createViewState({
      availabilityProfileFilter: "teleinde",
      availabilityGroupFilter: "section:parrilla",
    }),
    false,
  );
  const summaryHtml = getSummaryHtml(corpoHtml);

  assert.equal(summaryHtml, getSummaryHtml(teleindeHtml));
  assert.ok(summaryHtml.includes("Items ocultos"));
  assert.ok(summaryHtml.includes("admin-availability-summary__header"));
  assert.ok(summaryHtml.includes(`data-admin-action="${adminActions.hiddenAvailabilityProfile}"`));
  assert.ok(summaryHtml.includes('data-current="true"'));
  assert.equal(summaryHtml.includes("Ver lista"), false);
  assert.ok(summaryHtml.includes("Corpo: 1"));
  assert.ok(summaryHtml.includes("Teleinde: 3"));
  assert.ok(summaryHtml.includes("admin-availability-chip-list"));
  assert.ok(summaryHtml.includes("admin-availability-chip"));
  assert.equal(summaryHtml.includes("Servicio activo"), false);
  assert.equal(summaryHtml.includes("Menu fijo"), false);
  assert.ok(summaryHtml.includes("Mostrar"));
  assert.ok(summaryHtml.includes(`data-admin-action="${adminActions.setOverlay}"`));
  assert.ok(summaryHtml.includes('data-available="true"'));
  assert.ok(summaryHtml.includes('data-target-key="corpo/guarniciones/papas"'));
  assert.equal(summaryHtml.includes('data-family-key="family:teleinde:parrilla:Parrilla"'), false);
  assert.equal(summaryHtml.includes("admin-availability-chip__profile"), false);
});

test("availability hidden summary profile filter selects one profile only", () => {
  const html = availabilityView.renderAvailabilityTab(
    createHiddenAvailabilityState(),
    createViewState({
      hiddenAvailabilityProfileFilter: "teleinde",
      availabilityProfileFilter: "corpo",
      availabilityGroupFilter: "section:guarniciones",
    }),
    false,
  );
  const summaryHtml = getSummaryHtml(html);

  assert.ok(summaryHtml.includes("Corpo: 1"));
  assert.ok(summaryHtml.includes("Teleinde: 3"));
  assert.ok(summaryHtml.includes('data-family-key="family:teleinde:parrilla:Parrilla"'));
  assert.ok(summaryHtml.includes('data-target-key="teleinde/guarniciones/ensalada"'));
  assert.equal(summaryHtml.includes('data-target-key="corpo/guarniciones/papas"'), false);
});

test("availability hidden summary restores grill as a family when partially hidden", () => {
  const html = availabilityView.renderAvailabilityTab(
    createState({
      availability_overlays: [
        {
          menu_id: "teleinde",
          section_id: "parrilla",
          item_id: "vacio",
          available_override: false,
          updated_at: "2026-01-01T00:00:00Z",
        },
      ],
    }),
    createViewState({ hiddenAvailabilityProfileFilter: "teleinde" }),
    false,
  );
  const summaryHtml = getSummaryHtml(html);

  assert.ok(summaryHtml.includes('data-family-key="family:teleinde:parrilla:Parrilla"'));
  assert.equal(summaryHtml.includes('data-target-key="teleinde/parrilla/vacio"'), false);
});

test("availability hidden summary renders an empty state", () => {
  const html = availabilityView.renderAvailabilityTab(
    createState(),
    createViewState(),
    false,
  );

  assert.ok(getSummaryHtml(html).includes("No hay items ocultos."));
});

test("availability view renders catalog options as nested rows", () => {
  const sectionId = "tartas-tortillas-omelettes";
  const state = createState({
    availability_targets: [
      createTarget("corpo", "catalog", sectionId, "tartas", "Tartas"),
      createTarget("corpo", "catalog", sectionId, "tartas-jamon-queso", "Tartas - Jamon y queso"),
      createTarget("corpo", "catalog", sectionId, "tartas-jamon-verdeo", "Tartas - Jamon y verdeo"),
      createTarget("corpo", "catalog", sectionId, "tortilla", "Tortilla"),
      createTarget("corpo", "catalog", sectionId, "omelette", "Omelette"),
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

function createHiddenAvailabilityState() {
  return createState({
    availability_overlays: [
      {
        menu_id: "corpo",
        section_id: "guarniciones",
        item_id: "papas",
        available_override: false,
        updated_at: "2026-01-01T00:00:00Z",
      },
      {
        menu_id: "teleinde",
        section_id: "parrilla",
        item_id: "vacio",
        available_override: false,
        updated_at: "2026-01-01T00:00:00Z",
      },
      {
        menu_id: "teleinde",
        section_id: "parrilla",
        item_id: "entrana",
        available_override: false,
        updated_at: "2026-01-01T00:00:00Z",
      },
      {
        menu_id: "teleinde",
        section_id: "guarniciones",
        item_id: "ensalada",
        available_override: false,
        updated_at: "2026-01-01T00:00:00Z",
      },
    ],
  });
}

function getSummaryHtml(html) {
  const startIndex = html.indexOf("admin-availability-summary");
  const endIndex = html.indexOf('data-admin-filter="availability-profile"');

  assert.ok(startIndex > -1);
  assert.ok(endIndex > startIndex);

  return html.slice(startIndex, endIndex);
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
