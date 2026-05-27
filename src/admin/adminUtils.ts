import type {
  AdminOperationalState,
  AuthApiResponse,
  AuthSession,
  AvailabilityTargetState,
  CatalogGroupState,
  CatalogItemOptionState,
  CatalogItemState,
  CatalogSectionState,
  GrillProfileGroup,
  PricingLabel,
  RpcResult,
  StaffRole,
} from "./adminTypes";

export function getTargetKey(target: {
  menu_id: string;
  section_id: string;
  group_id: string;
  item_id: string;
}): string {
  return `${target.menu_id}/${target.section_id}/${target.group_id}/${target.item_id}`;
}

export function getOverlayKey(overlay: {
  menu_id: string;
  section_id: string;
  group_id: string;
  item_id: string;
}): string {
  return `${overlay.menu_id}/${overlay.section_id}/${overlay.group_id}/${overlay.item_id}`;
}

export function createCatalogId(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u00f1/g, "n")
    .replace(/\u00d1/g, "n")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeAdminState(state: AdminOperationalState): AdminOperationalState {
  return {
    ...state,
    profiles: Array.isArray(state.profiles) ? state.profiles : [],
    service_settings: Array.isArray(state.service_settings) ? state.service_settings : [],
    daily_menu: Array.isArray(state.daily_menu) ? state.daily_menu : [],
    availability_targets: Array.isArray(state.availability_targets)
      ? state.availability_targets.map(normalizeAvailabilityTarget)
      : [],
    availability_overlays: Array.isArray(state.availability_overlays) ? state.availability_overlays : [],
    prices: {
      fixed: Array.isArray(state.prices?.fixed) ? state.prices.fixed : [],
      variants: Array.isArray(state.prices?.variants) ? state.prices.variants : [],
    },
    catalog_editor: {
      sections: Array.isArray(state.catalog_editor?.sections)
        ? state.catalog_editor.sections.map(normalizeCatalogSection)
        : [],
      groups: Array.isArray(state.catalog_editor?.groups)
        ? state.catalog_editor.groups.map(normalizeCatalogGroup)
        : [],
      items: Array.isArray(state.catalog_editor?.items)
        ? state.catalog_editor.items.map(normalizeCatalogItem)
        : [],
    },
  };
}

function normalizeCatalogSection(section: CatalogSectionState): CatalogSectionState {
  return {
    ...section,
    item_count: normalizeNonnegativeInteger(section.item_count),
  };
}

function normalizeCatalogGroup(group: CatalogGroupState): CatalogGroupState {
  return {
    ...group,
    item_count: normalizeNonnegativeInteger(group.item_count),
  };
}

function normalizeCatalogItem(item: CatalogItemState): CatalogItemState {
  const priceAmount = (item as { price_amount?: unknown }).price_amount;

  return {
    ...item,
    price_amount:
      typeof priceAmount === "number" && Number.isSafeInteger(priceAmount) && priceAmount >= 0
        ? priceAmount
        : null,
    option_count: normalizeNonnegativeInteger(item.option_count),
    options: Array.isArray(item.options) ? item.options.map(normalizeCatalogItemOption) : [],
  };
}

function normalizeCatalogItemOption(option: CatalogItemOptionState): CatalogItemOptionState {
  return {
    ...option,
    order_index: normalizeNonnegativeInteger(option.order_index),
  };
}

function normalizeAvailabilityTarget(target: AvailabilityTargetState): AvailabilityTargetState {
  const priceAmount = (target as { price_amount?: unknown }).price_amount;

  return {
    ...target,
    price_amount:
      typeof priceAmount === "number" && Number.isSafeInteger(priceAmount) && priceAmount >= 0
        ? priceAmount
        : null,
  };
}

function normalizeNonnegativeInteger(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

export function groupGrillTargets(targets: AvailabilityTargetState[]): GrillProfileGroup[] {
  const profiles: GrillProfileGroup[] = [];
  const profileMap = new Map<string, GrillProfileGroup>();

  for (const target of targets) {
    let profileGroup = profileMap.get(target.menu_id);

    if (!profileGroup) {
      profileGroup = {
        menuId: target.menu_id,
        profileTitle: target.profile_title,
        families: [],
      };
      profileMap.set(target.menu_id, profileGroup);
      profiles.push(profileGroup);
    }

    const familyTitle = target.group_title ?? "Sin familia";
    let family = profileGroup.families.find((entry) => entry.title === familyTitle);

    if (!family) {
      family = { title: familyTitle, targets: [] };
      profileGroup.families.push(family);
    }

    family.targets.push(target);
  }

  return profiles;
}

export function roleLabel(role: StaffRole): string {
  if (role === "admin") {
    return "Admin";
  }

  return "Operador";
}

export function resultMessage(result: RpcResult): string {
  const messages: Record<string, string> = {
    permission_denied: "No tenes permisos para esta accion.",
    publish_queued: "Publicacion solicitada. El menu publico puede tardar unos minutos en actualizarse.",
    publish_recently_queued: "Ya se pidio una publicacion hace poco.",
    publish_failed: "No se pudo publicar.",
    invalid_amount: "El importe no es valido.",
    daily_menu_name_required: "El nombre del menu es obligatorio.",
    daily_menu_available_required: "La disponibilidad del menu es obligatoria.",
    invalid_service_kind: "El servicio seleccionado no es valido.",
    catalog_item_id_required: "El codigo del item es obligatorio.",
    invalid_catalog_item_id: "El codigo del item debe usar minusculas, numeros y guiones.",
    catalog_item_name_required: "El nombre del item es obligatorio.",
    catalog_section_not_found: "La seccion seleccionada no existe.",
    invalid_catalog_group: "La seccion seleccionada no acepta grupo.",
    catalog_group_required: "Selecciona un grupo existente.",
    catalog_group_not_found: "El grupo seleccionado no existe.",
    catalog_item_exists: "Ya existe un item con ese codigo en esta ubicacion.",
    catalog_item_unchanged: "Sin cambios.",
    catalog_item_updated: "Item actualizado.",
    invalid_catalog_option_id: "El codigo del sabor debe usar minusculas, numeros y guiones.",
    catalog_option_exists: "Ya existe un sabor con ese codigo en esta subcategoria.",
    catalog_options_not_enabled: "Solo se pueden administrar sabores en subcategorias que ya usan opciones.",
    catalog_option_id_required: "El codigo de la opcion es obligatorio.",
    catalog_option_name_required: "El nombre de la opcion es obligatorio.",
    catalog_option_added: "Opcion agregada.",
    catalog_option_not_found: "La opcion seleccionada ya no existe.",
    catalog_option_unchanged: "Sin cambios.",
    catalog_option_updated: "Opcion actualizada.",
    catalog_option_deleted: "Opcion eliminada.",
    catalog_option_must_keep_one: "La subcategoria debe conservar al menos un sabor.",
    catalog_price_key_conflict: "Ya existe un precio incompatible para ese codigo.",
    catalog_item_not_found: "El item seleccionado ya no existe.",
    catalog_item_locked: "Esta seccion solo permite administrar sabores desde Menu fijo.",
    catalog_location_must_keep_item: "No se puede eliminar el ultimo item de una seccion o grupo.",
  };

  return messages[result.message] ?? result.message.replaceAll("_", " ");
}

export function formatCooldownSuffix(result: RpcResult): string {
  const seconds = result.cooldown_seconds_remaining;

  if (typeof seconds !== "number" || !Number.isSafeInteger(seconds) || seconds < 0) {
    return "";
  }

  return ` (${seconds} segundos restantes)`;
}

export function getFormString(form: HTMLFormElement, name: string): string {
  const value = new FormData(form).get(name);
  return typeof value === "string" ? value.trim() : "";
}

export function getNullableFormString(form: HTMLFormElement, name: string): string | null {
  const value = getFormString(form, name);
  return value.length > 0 ? value : null;
}

export function getFormInteger(form: HTMLFormElement, name: string): number {
  const value = Number(getFormString(form, name));

  if (!Number.isInteger(value) || value < 0) {
    throw new Error("El importe no es valido.");
  }

  return value;
}

export async function readJsonBody(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function readErrorMessage(body: unknown): string {
  if (body && typeof body === "object") {
    const message = (body as {
      error?: unknown;
      error_description?: unknown;
      message?: unknown;
      msg?: unknown;
    }).message
      ?? (body as { msg?: unknown }).msg
      ?? (body as { error_description?: unknown }).error_description
      ?? (body as { error?: unknown }).error;

    if (typeof message === "string" && message.trim()) {
      return toOperationalErrorMessage(message);
    }
  }

  return "No se pudo completar la operacion.";
}

export function toOperationalErrorMessage(message: string): string {
  const trimmedMessage = message.trim();
  const lowerMessage = trimmedMessage.toLowerCase();

  if (!trimmedMessage) {
    return "No se pudo completar la operacion.";
  }

  if (
    lowerMessage.includes("jwt")
    || lowerMessage.includes("token")
    || lowerMessage.includes("session")
    || lowerMessage.includes("expired")
  ) {
    return "La sesion expiro. Volve a iniciar sesion.";
  }

  if (
    lowerMessage.includes("permission denied")
    || lowerMessage.includes("42501")
    || lowerMessage.includes("row-level")
    || lowerMessage.includes("not authorized")
    || lowerMessage.includes("unauthorized")
  ) {
    return "No tenes permisos para esta accion.";
  }

  if (
    lowerMessage.includes("invalid input")
    || lowerMessage.includes("violates")
    || lowerMessage.includes("constraint")
  ) {
    return "Hay un dato invalido. Revisalo e intenta guardar de nuevo.";
  }

  if (
    lowerMessage.includes("supabase")
    || lowerMessage.includes("pgrst")
    || lowerMessage.includes("rpc")
    || lowerMessage.includes("schema")
    || lowerMessage.includes("function")
  ) {
    return "No se pudo completar la operacion. Actualiza el panel e intenta de nuevo.";
  }

  return trimmedMessage;
}

export function isRpcResult(value: unknown): value is RpcResult {
  return Boolean(
    value
      && typeof value === "object"
      && typeof (value as RpcResult).ok === "boolean"
      && typeof (value as RpcResult).changed === "boolean"
      && typeof (value as RpcResult).requires_redeploy === "boolean"
      && typeof (value as RpcResult).operation === "string"
      && typeof (value as RpcResult).message === "string",
  );
}

export function isAuthResponse(value: unknown): value is AuthApiResponse {
  return Boolean(
    value
      && typeof value === "object"
      && typeof (value as AuthApiResponse).access_token === "string"
      && typeof (value as AuthApiResponse).refresh_token === "string"
      && typeof (value as AuthApiResponse).expires_in === "number"
      && typeof (value as AuthApiResponse).user === "object",
  );
}

export function isStoredSession(value: unknown): value is AuthSession {
  return Boolean(
    value
      && typeof value === "object"
      && typeof (value as AuthSession).accessToken === "string"
      && typeof (value as AuthSession).refreshToken === "string"
      && typeof (value as AuthSession).expiresAt === "number",
  );
}

export function formatAmount(amount: number): string {
  return `$${new Intl.NumberFormat("es-AR").format(amount)}`;
}

export function formatOptionalAmount(amount: number | null): string {
  return typeof amount === "number" && Number.isSafeInteger(amount) && amount >= 0
    ? formatAmount(amount)
    : "";
}

export function formatCatalogItemPrice(item: CatalogItemState): string {
  if (typeof item.price_amount === "number" && Number.isSafeInteger(item.price_amount) && item.price_amount >= 0) {
    return formatAmount(item.price_amount);
  }

  return item.pricing_key ? "Precio configurado" : "Precio heredado";
}

export function formatPricingLabel(value: string, fallbackTag: string): PricingLabel {
  const parts = value.split(":").filter(Boolean);

  if (parts[0] === "catalog") {
    const section = formatIdLabel(parts[1] ?? "Catalogo");
    const groupIndex = parts.indexOf("group");
    const itemIndex = parts.indexOf("item");
    const labelPart = groupIndex >= 0
      ? parts[groupIndex + 1]
      : itemIndex >= 0
        ? parts[itemIndex + 1]
        : parts[1];

    return {
      title: formatIdLabel(labelPart ?? value),
      tags: ["Catalogo", section, fallbackTag],
    };
  }

  if (value.startsWith("parrilla-")) {
    return {
      title: formatIdLabel(value.replace(/^parrilla-/, "")),
      tags: ["Parrilla", fallbackTag],
    };
  }

  if (value.startsWith("menu-")) {
    return {
      title: formatIdLabel(value),
      tags: ["Menu del dia", fallbackTag],
    };
  }

  return {
    title: formatIdLabel(value.replace(/:price$/, "")),
    tags: ["Precio", fallbackTag],
  };
}

export function formatIdLabel(value: string): string {
  return value
    .replace(/:price$/g, "")
    .replace(/:/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function getTrimmedValue(value: string | undefined): string | undefined {
  const trimmedValue = value?.trim();
  return trimmedValue && trimmedValue.length > 0 ? trimmedValue : undefined;
}

export function trimTrailingSlash(value: string | undefined): string | undefined {
  return getTrimmedValue(value)?.replace(/\/+$/, "");
}

export function normalizeSupabaseProjectUrl(value: string | undefined): string | undefined {
  return trimTrailingSlash(value)?.replace(/\/(?:rest\/v1|auth\/v1|functions\/v1)$/, "");
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    if (character === "&") {
      return "&amp;";
    }

    if (character === "<") {
      return "&lt;";
    }

    if (character === ">") {
      return "&gt;";
    }

    if (character === "\"") {
      return "&quot;";
    }

    return "&#39;";
  });
}
