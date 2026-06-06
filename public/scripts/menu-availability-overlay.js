const technicalIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const unavailableText = "No disponible";

const getRequiredTechnicalId = (value) =>
  value && technicalIdPattern.test(value) ? value : undefined;

const getOverlayKey = (sectionId, itemId) => `${sectionId}/${itemId}`;

const getTrimmedValue = (value) => value?.trim() || undefined;

const getSupabaseProjectUrl = (value) =>
  value.replace(/\/+$/, "").replace(/\/(?:rest\/v1|auth\/v1|functions\/v1)$/, "");

const getSupabaseRestUrl = (supabaseUrl, menuId) => {
  const url = new URL(
    `${getSupabaseProjectUrl(supabaseUrl)}/rest/v1/menu_availability_overlays`,
  );

  url.searchParams.set("menu_id", `eq.${menuId}`);
  url.searchParams.set(
    "select",
    "menu_id,section_id,item_id,available_override",
  );

  return url;
};

const parseOverlayRow = (row, menuId) => {
  const rowMenuId = typeof row.menu_id === "string" ? row.menu_id : undefined;
  const sectionId = typeof row.section_id === "string" ? row.section_id : undefined;
  const itemId = typeof row.item_id === "string" ? row.item_id : undefined;
  const parsedSectionId = getRequiredTechnicalId(sectionId);
  const parsedItemId = getRequiredTechnicalId(itemId);

  if (
    rowMenuId !== menuId ||
    !parsedSectionId ||
    !parsedItemId ||
    typeof row.available_override !== "boolean"
  ) {
    return undefined;
  }

  return {
    key: getOverlayKey(parsedSectionId, parsedItemId),
    available: row.available_override,
  };
};

const createAvailabilityStatus = (item) => {
  const status = document.createElement("span");
  status.dataset.availabilityStatus = "";

  if (item.classList.contains("dish-row")) {
    status.className = "status-pill";
    item.querySelector(".dish-card__header")?.append(status);

    return status;
  }

  if (item.classList.contains("compact-item")) {
    status.className = "compact-availability-status";
    item.querySelector(".compact-item__header")?.append(status);

    return status;
  }

  if (item.classList.contains("dish-card__option")) {
    status.className = "dish-card__option-status";
    item.querySelector("span")?.append(status);

    return status;
  }

  status.className = "dish-card__variant-status";
  item.querySelector("span")?.append(status);

  return status;
};

const applyAvailability = (item, available) => {
  const existingStatus = item.querySelector("[data-availability-status]");

  if (available) {
    existingStatus?.remove();
    item.dataset.available = "true";

    return;
  }

  const status = existingStatus ?? createAvailabilityStatus(item);

  item.dataset.available = "false";
  status.dataset.state = "unavailable";
  status.textContent = unavailableText;
};

const loadAvailabilityOverlays = async () => {
  const root = document.querySelector("main[data-menu-id]");
  const menuId = getRequiredTechnicalId(root?.dataset.menuId);
  const supabaseUrl = getTrimmedValue(root?.dataset.supabaseUrl);
  const supabaseAnonKey = getTrimmedValue(root?.dataset.supabaseAnonKey);

  if (!root || !menuId || !supabaseUrl || !supabaseAnonKey) {
    return;
  }

  const items = Array.from(
    document.querySelectorAll("[data-section-id][data-item-id][data-available]"),
  ).filter((item) => item.dataset.menuId === menuId);

  if (items.length === 0) {
    return;
  }

  const itemsByKey = new Map();

  for (const item of items) {
    const sectionId = getRequiredTechnicalId(item.dataset.sectionId);
    const itemId = getRequiredTechnicalId(item.dataset.itemId);

    if (!sectionId || !itemId) {
      continue;
    }

    itemsByKey.set(getOverlayKey(sectionId, itemId), item);
  }

  if (itemsByKey.size === 0) {
    return;
  }

  const restUrl = getSupabaseRestUrl(supabaseUrl, menuId);
  const requestHeaders = {
    Accept: "application/json",
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${supabaseAnonKey}`,
  };

  const response = await fetch(restUrl, {
    headers: requestHeaders,
    credentials: "omit",
  });

  if (!response.ok) {
    return;
  }

  const rows = await response.json();

  if (!Array.isArray(rows)) {
    return;
  }

  for (const row of rows) {
    if (!row || typeof row !== "object") {
      continue;
    }

    const overlay = parseOverlayRow(row, menuId);

    if (!overlay) {
      continue;
    }

    const item = itemsByKey.get(overlay.key);

    if (item) {
      applyAvailability(item, overlay.available);
    }
  }
};

const startAvailabilityOverlay = () => {
  void loadAvailabilityOverlays().catch(() => undefined);
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startAvailabilityOverlay, { once: true });
} else {
  startAvailabilityOverlay();
}
