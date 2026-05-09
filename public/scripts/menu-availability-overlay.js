const technicalIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const availableText = "Disponible";
const unavailableText = "No disponible";

const getRequiredTechnicalId = (value) =>
  value && technicalIdPattern.test(value) ? value : undefined;

const getOptionalTechnicalId = (value) => {
  if (!value) {
    return "";
  }

  return technicalIdPattern.test(value) ? value : undefined;
};

const getOverlayKey = (sectionId, groupId, itemId) =>
  `${sectionId}/${groupId}/${itemId}`;

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
    "menu_id,section_id,group_id,item_id,available_override",
  );

  return url;
};

const parseOverlayRow = (row, menuId) => {
  const rowMenuId = typeof row.menu_id === "string" ? row.menu_id : undefined;
  const sectionId = typeof row.section_id === "string" ? row.section_id : undefined;
  const groupId = row.group_id === null || typeof row.group_id === "string"
    ? row.group_id
    : undefined;
  const itemId = typeof row.item_id === "string" ? row.item_id : undefined;
  const parsedSectionId = getRequiredTechnicalId(sectionId);
  const parsedGroupId = getOptionalTechnicalId(groupId);
  const parsedItemId = getRequiredTechnicalId(itemId);

  if (
    rowMenuId !== menuId ||
    !parsedSectionId ||
    parsedGroupId === undefined ||
    !parsedItemId ||
    typeof row.available_override !== "boolean"
  ) {
    return undefined;
  }

  return {
    key: getOverlayKey(parsedSectionId, parsedGroupId, parsedItemId),
    available: row.available_override,
  };
};

const applyAvailability = (item, available) => {
  const status = item.querySelector("[data-availability-status]");

  if (!status) {
    return;
  }

  item.dataset.available = available ? "true" : "false";
  status.dataset.state = available ? "available" : "unavailable";
  status.textContent = available ? availableText : unavailableText;
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
    const groupId = getOptionalTechnicalId(item.dataset.groupId);
    const itemId = getRequiredTechnicalId(item.dataset.itemId);

    if (!sectionId || groupId === undefined || !itemId) {
      continue;
    }

    itemsByKey.set(getOverlayKey(sectionId, groupId, itemId), item);
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
