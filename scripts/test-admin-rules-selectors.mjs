import assert from "node:assert/strict";
import test from "node:test";
import {
  compileAdminModules,
  createState,
} from "./test-admin-helpers.mjs";

const { requireAdminModule } = await compileAdminModules("admin-rules-selectors-tests", [
  "src/admin/adminRules.ts",
  "src/admin/adminSelectors.ts",
  "src/admin/adminTypes.ts",
  "src/admin/adminUtils.ts",
]);

const rules = requireAdminModule("adminRules");
const selectors = requireAdminModule("adminSelectors");
const utils = requireAdminModule("adminUtils");

test("availability targets match each profile active service", () => {
  const state = createState();
  const targetKeys = selectors.getVisibleAvailabilityTargets(state).map((target) =>
    `${target.menu_id}:${target.target_kind}:${target.item_id}`
  );

  assert.deepEqual(targetKeys, [
    "corpo:daily-menu:main",
    "corpo:catalog:papas",
    "teleinde:grill:vacio",
    "teleinde:grill:entrana",
    "teleinde:catalog:ensalada",
  ]);
});

test("availability grouping collapses grill and keeps catalog groups", () => {
  const state = createState();
  const teleindeTargets = selectors.getVisibleAvailabilityTargets(state).filter((target) =>
    target.menu_id === "teleinde"
  );

  assert.deepEqual(selectors.getAvailabilityGroupOptions(teleindeTargets), [
    { key: "section:grill", label: "Parrilla" },
    { key: "section:guarniciones", label: "guarniciones" },
  ]);
});

test("invalid availability filters fall back to first editable profile and group", () => {
  const state = createState();
  const targets = selectors.getFilteredAvailabilityTargets(state, {
    profileFilter: "missing-profile",
    groupFilter: "missing-group",
  });

  assert.deepEqual(targets.map((target) => utils.getTargetKey(target)), [
    "corpo/daily/main",
  ]);
});

test("fixed options-only sections expose only allowed items", () => {
  const state = createState();
  const section = selectors.getEffectiveFixedSection(state.catalog_editor, "empanadas");
  const items = selectors.getFixedLocationItems(state.catalog_editor, section);

  assert.equal(rules.getFixedMenuEditMode(section), "options-only");
  assert.deepEqual(items.map((item) => item.item_id), ["empanadas"]);
});

test("missing fixed section filter falls back to first section", () => {
  const state = createState();
  const section = selectors.getEffectiveFixedSection(state.catalog_editor, "missing-section");

  assert.equal(section.section_id, "empanadas");
});

test("side option rules hide prices for included sides only", () => {
  const state = createState();
  const guarniciones = selectors.getEffectiveFixedSection(state.catalog_editor, "guarniciones");
  const papas = selectors.findCatalogItem(state, "guarniciones", "papas");
  const guarnicionSola = selectors.findCatalogItem(state, "guarniciones", "guarnicion-sola");

  assert.equal(rules.catalogItemFormRequiresPrice(guarniciones), false);
  assert.equal(rules.isIncludedSideOptionItem(papas), true);
  assert.equal(rules.isIncludedSideOptionItem(guarnicionSola), false);
});

test("delete controls are allowed only when another item remains", () => {
  assert.equal(rules.canDeleteFromList(2), true);
  assert.equal(rules.canDeleteFromList(1), false);
});

test("allowed tabs follow permissions and always include account", () => {
  assert.deepEqual(rules.getAllowedTabs(createState()).map((tab) => tab.id), [
    "availability",
    "service",
    "fixed",
    "account",
  ]);

  assert.deepEqual(
    rules.getAllowedTabs(createState({
      permissions: {
        can_edit_availability: false,
        can_edit_menu_content: false,
        can_publish_menu: false,
      },
    })).map((tab) => tab.id),
    ["account"],
  );

  assert.deepEqual(
    rules.getAllowedTabs(createState({
      permissions: {
        can_edit_availability: true,
        can_edit_menu_content: false,
      },
    })).map((tab) => tab.id),
    ["availability", "account"],
  );
});

test("service sections are available only when active in at least one profile", () => {
  const state = createState();

  assert.equal(rules.isServiceSectionAvailable(state, "active-service"), true);
  assert.equal(rules.isServiceSectionAvailable(state, "daily-menu"), true);
  assert.equal(rules.isServiceSectionAvailable(state, "grill"), true);

  const noServicesState = createState({ service_settings: [] });

  assert.equal(rules.isServiceSectionAvailable(noServicesState, "active-service"), true);
  assert.equal(rules.isServiceSectionAvailable(noServicesState, "daily-menu"), false);
  assert.equal(rules.isServiceSectionAvailable(noServicesState, "grill"), false);
});

test("selectors find availability targets and grill family targets", () => {
  const state = createState();
  const target = selectors.findAvailabilityTarget(state, "teleinde/grill/vacio");
  const familyTargets = selectors.findAvailabilityFamilyTargets(state, "family:teleinde:grill:Parrilla");

  assert.equal(target.name, "Vacio");
  assert.deepEqual(familyTargets.map((entry) => entry.item_id), ["vacio", "entrana"]);
});

test("selectors find catalog options and grill families", () => {
  const state = createState();

  assert.equal(selectors.findCatalogItemOption(state, "empanadas", "empanadas", "carne").name, "carne");
  assert.equal(selectors.findGrillFamily(state, "parrilla").title, "Parrilla");
  assert.equal(selectors.findGrillItem(state, "vacio").variant_name, "Vacio");
});
