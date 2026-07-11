import assert from "node:assert/strict";
import test from "node:test";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { JSDOM } from "jsdom";

const scriptUrl = pathToFileURL(
  path.join(process.cwd(), "public/scripts/menu-availability-overlay.js"),
).href;

// The script runs once when loaded. A query suffix creates a fresh module
// instance for each test case.
let importCounter = 0;

async function runOverlayScript({ html, rows = [], fetchOk = true }) {
  const dom = new JSDOM(`<!doctype html><html><body>${html}</body></html>`);
  const fetchCalls = [];

  globalThis.document = dom.window.document;
  globalThis.fetch = async (url, options) => {
    fetchCalls.push({ url: String(url), options });
    return {
      ok: fetchOk,
      json: async () => rows,
    };
  };

  try {
    importCounter += 1;
    await import(`${scriptUrl}?case=${importCounter}`);
    await new Promise((resolve) => setTimeout(resolve, 0));
  } finally {
    delete globalThis.document;
    delete globalThis.fetch;
  }

  return { document: dom.window.document, fetchCalls };
}

function menuRoot(items) {
  return `
    <main
      data-menu-id="corpo"
      data-supabase-url="https://example.supabase.co"
      data-supabase-anon-key="anon-key"
    >${items}</main>
  `;
}

function dishRow({ itemId, available, status = true }) {
  const statusHtml = status
    ? `<span class="status-pill" data-availability-status data-state="${available ? "available" : "unavailable"}" ${available ? 'aria-hidden="true"' : ""}>No disponible</span>`
    : "";

  return `
    <article class="dish-row" data-menu-id="corpo" data-section-id="guarniciones" data-item-id="${itemId}" data-available="${available}">
      <div class="dish-card__header">
        <div class="dish-card__main"><h3>Item</h3></div>
        <div class="dish-card__header-meta">${statusHtml}</div>
      </div>
    </article>
  `;
}

function overlayRow(itemId, available, extra = {}) {
  return {
    menu_id: "corpo",
    section_id: "guarniciones",
    item_id: itemId,
    available_override: available,
    ...extra,
  };
}

test("queries menu overlays with the public API key", async () => {
  const { fetchCalls } = await runOverlayScript({
    html: menuRoot(dishRow({ itemId: "pure", available: true })),
    rows: [],
  });

  assert.equal(fetchCalls.length, 1);
  const url = new URL(fetchCalls[0].url);
  assert.equal(url.pathname, "/rest/v1/menu_availability_overlays");
  assert.equal(url.searchParams.get("menu_id"), "eq.corpo");
  assert.equal(fetchCalls[0].options.headers.apikey, "anon-key");
  assert.equal(fetchCalls[0].options.credentials, "omit");
});

test("a false overlay marks the item unavailable and shows its status", async () => {
  const { document } = await runOverlayScript({
    html: menuRoot(dishRow({ itemId: "pure", available: true })),
    rows: [overlayRow("pure", false)],
  });

  const item = document.querySelector(".dish-row");
  const status = item.querySelector("[data-availability-status]");

  assert.equal(item.dataset.available, "false");
  assert.equal(item.hidden, false);
  assert.equal(status.dataset.state, "unavailable");
  assert.equal(status.hasAttribute("aria-hidden"), false);
  assert.equal(status.textContent, "No disponible");
});

test("a true overlay restores an item hidden at build time", async () => {
  const { document } = await runOverlayScript({
    html: menuRoot(dishRow({ itemId: "pure", available: false })),
    rows: [overlayRow("pure", true)],
  });

  const item = document.querySelector(".dish-row");
  const status = item.querySelector("[data-availability-status]");

  assert.equal(item.dataset.available, "true");
  assert.equal(status.dataset.state, "available");
  assert.equal(status.getAttribute("aria-hidden"), "true");
});

test("hide-when-unavailable options are hidden completely", async () => {
  const optionHtml = `
    <article class="dish-row">
      <ul>
        <li class="dish-card__option" data-menu-id="corpo" data-section-id="guarniciones" data-item-id="tartas-jamon" data-available="true" data-hide-when-unavailable="true">
          <span>Jamón</span>
        </li>
      </ul>
    </article>
  `;
  const { document } = await runOverlayScript({
    html: menuRoot(optionHtml),
    rows: [overlayRow("tartas-jamon", false)],
  });

  const option = document.querySelector(".dish-card__option");

  assert.equal(option.hidden, true);
  assert.equal(option.dataset.available, "false");
});

// A parent is available only when all its variants are available, matching the
// admin behavior that hides complete grill families.
test("the parent reflects the combined availability of its variants", async () => {
  const variantsHtml = (first, second) => `
    <article class="dish-row">
      <div class="dish-card__header">
        <div class="dish-card__main"><h3>Parrilla</h3></div>
      </div>
      <ul>
        <li class="dish-card__variant" data-menu-id="corpo" data-section-id="guarniciones" data-item-id="bife" data-available="${first}"><span>Bife</span></li>
        <li class="dish-card__variant" data-menu-id="corpo" data-section-id="guarniciones" data-item-id="entrana" data-available="${second}"><span>Entraña</span></li>
      </ul>
    </article>
  `;

  const allHidden = await runOverlayScript({
    html: menuRoot(variantsHtml("true", "true")),
    rows: [overlayRow("bife", false), overlayRow("entrana", false)],
  });
  const hiddenParent = allHidden.document.querySelector(".dish-row");
  const hiddenStatus = hiddenParent.querySelector(".dish-card__header-meta > [data-availability-status]");

  assert.equal(hiddenParent.dataset.available, "false");
  assert.equal(hiddenStatus.dataset.state, "unavailable");

  const allRestored = await runOverlayScript({
    html: menuRoot(variantsHtml("false", "false")),
    rows: [overlayRow("bife", true), overlayRow("entrana", true)],
  });
  const restoredParent = allRestored.document.querySelector(".dish-row");

  assert.equal(restoredParent.dataset.available, "true");
});

test("ignores rows with invalid ids or a different menu id", async () => {
  const { document } = await runOverlayScript({
    html: menuRoot(dishRow({ itemId: "pure", available: true })),
    rows: [
      overlayRow("pure", false, { menu_id: "teleinde" }),
      overlayRow("Pure_Invalido!", false),
      { menu_id: "corpo", section_id: "guarniciones" },
    ],
  });

  const item = document.querySelector(".dish-row");

  assert.equal(item.dataset.available, "true");
  assert.equal(item.querySelector("[data-availability-status]").dataset.state, "available");
});

test("an error response leaves build-time menu state unchanged", async () => {
  const { document } = await runOverlayScript({
    html: menuRoot(dishRow({ itemId: "pure", available: true })),
    rows: [overlayRow("pure", false)],
    fetchOk: false,
  });

  assert.equal(document.querySelector(".dish-row").dataset.available, "true");
});

test("does not query the API when menu configuration is missing", async () => {
  const { fetchCalls } = await runOverlayScript({
    html: `<main data-menu-id="corpo">${dishRow({ itemId: "pure", available: true })}</main>`,
    rows: [],
  });

  assert.equal(fetchCalls.length, 0);
});
