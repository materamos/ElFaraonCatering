import assert from "node:assert/strict";
import test from "node:test";
import {
  compileAdminModules,
  createForm,
  createState,
  installMockFormData,
  okResult,
} from "./test-admin-helpers.mjs";

const restoreFormData = installMockFormData();

test.after(() => {
  restoreFormData();
});

const { requireAdminModule } = await compileAdminModules("admin-operations-tests", [
  "src/admin/operations/index.ts",
  "src/admin/core/types.ts",
]);

const { createAdminOperations } = requireAdminModule("operations/index");

test("availability save calls set_menu_availability_overlay", async () => {
  const harness = createHarness();
  const operations = createAdminOperations(harness.context);
  const target = createState().availability_targets[0];

  await operations.saveAvailabilityOverlay(target, false);

  assert.deepEqual(harness.calls, [
    {
      name: "set_menu_availability_overlay",
      body: {
        menu_id: "corpo",
        section_id: "daily",
        item_id: "main",
        available_override: false,
      },
    },
  ]);
  assert.equal(harness.busyTexts[0], "Ocultando item...");
  assert.equal(harness.loads[0].tone, "success");
});

test("availability clear calls clear_menu_availability_overlay", async () => {
  const harness = createHarness();
  const operations = createAdminOperations(harness.context);
  const target = createState().availability_targets[0];

  await operations.clearAvailabilityOverlay(target);

  assert.deepEqual(harness.calls, [
    {
      name: "clear_menu_availability_overlay",
      body: {
        menu_id: "corpo",
        section_id: "daily",
        item_id: "main",
      },
    },
  ]);
  assert.equal(harness.busyTexts[0], "Quitando ajuste...");
});

test("daily menu save calls set_daily_menu", async () => {
  const harness = createHarness();
  const operations = createAdminOperations(harness.context);

  await operations.saveDailyMenu(createForm({
    regular_name: "Milanesa",
    regular_description: "Con pure",
    vegetarian_name: "Tarta",
    vegetarian_description: "",
  }));

  assert.deepEqual(harness.calls, [
    {
      name: "set_daily_menu",
      body: {
        regular_name: "Milanesa",
        regular_description: "Con pure",
        vegetarian_name: "Tarta",
        vegetarian_description: null,
      },
    },
  ]);
});

test("fixed price save calls set_global_fixed_price", async () => {
  const harness = createHarness();
  const operations = createAdminOperations(harness.context);

  await operations.saveFixedPrice(createForm({
    pricing_key: "catalog:guarniciones:item:papas",
    amount: "150",
  }));

  assert.deepEqual(harness.calls, [
    {
      name: "set_global_fixed_price",
      body: {
        pricing_key: "catalog:guarniciones:item:papas",
        amount: 150,
      },
    },
  ]);
});

test("publish queued marks current publication and remembers cooldown", async () => {
  const harness = createHarness({
    publishResult: okResult({
      operation: "publish-menu-changes",
      message: "publish_queued",
      cooldown_seconds_remaining: 30,
    }),
  });
  const operations = createAdminOperations(harness.context);

  await operations.publishChanges();

  assert.equal(harness.requiredSessions, 1);
  assert.equal(harness.markedPublicationRequested, 1);
  assert.deepEqual(harness.rememberedCooldowns, [30]);
  assert.equal(harness.loads[0].tone, "success");
});

test("partial mutation failure reports incomplete operation", async () => {
  const harness = createHarness({
    mutationResults: [
      okResult({ operation: "update_catalog_item", changed: true }),
      {
        ok: false,
        changed: false,
        requires_redeploy: false,
        operation: "set_global_fixed_price",
        message: "invalid_amount",
      },
    ],
  });
  const operations = createAdminOperations(harness.context);

  await assert.rejects(
    operations.saveCatalogItemEdit(createForm({
      section_id: "guarniciones",
      item_id: "papas",
      name: "Papas",
      description: "",
      fixed_pricing_key: "catalog:guarniciones:item:papas",
      fixed_price_amount: "120",
    })),
    /Algunos cambios pueden haberse guardado/,
  );

  assert.deepEqual(harness.calls.map((call) => call.name), [
    "update_catalog_item",
    "set_global_fixed_price",
  ]);
});

function createHarness(options = {}) {
  const calls = [];
  const loads = [];
  const busyTexts = [];
  const mutationResults = [...(options.mutationResults ?? [])];
  const loadState = createState({
    publication: {
      has_unpublished_changes: true,
    },
  });
  const harness = {
    calls,
    loads,
    busyTexts,
    requiredSessions: 0,
    markedPublicationRequested: 0,
    rememberedCooldowns: [],
    context: {
      async runBusy(action, busyText) {
        busyTexts.push(busyText ?? "");
        await action();
      },
      async callMutation(name, body) {
        calls.push({ name, body });
        return mutationResults.shift() ?? okResult({ operation: name });
      },
      async loadAdminState(statusText, statusTone) {
        loads.push({
          text: typeof statusText === "function" ? statusText(loadState) : statusText,
          tone: statusTone,
        });
        return loadState;
      },
      async requireSession() {
        harness.requiredSessions += 1;
        return {
          accessToken: "access-token",
          refreshToken: "refresh-token",
          expiresAt: Date.now() + 60_000,
        };
      },
      async publishMenuChanges() {
        return options.publishResult ?? okResult({ operation: "publish-menu-changes" });
      },
      markCurrentPublicationRequested() {
        harness.markedPublicationRequested += 1;
      },
      rememberPublishCooldown(result) {
        harness.rememberedCooldowns.push(result.cooldown_seconds_remaining);
      },
    },
  };

  return harness;
}
