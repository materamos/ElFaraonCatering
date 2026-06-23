import type {
  CatalogItemState,
  PricingLabel,
  StaffRole,
} from "./types";

export function roleLabel(role: StaffRole): string {
  if (role === "admin") {
    return "Admin";
  }

  return "Operador";
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
    const section = formatIdLabel(parts[1] ?? "Catálogo");
    const groupIndex = parts.indexOf("group");
    const itemIndex = parts.indexOf("item");
    const labelPart = groupIndex >= 0
      ? parts[groupIndex + 1]
      : itemIndex >= 0
        ? parts[itemIndex + 1]
        : parts[1];

    return {
      title: formatIdLabel(labelPart ?? value),
      tags: ["Catálogo", section, fallbackTag],
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
      tags: ["Menú del día", fallbackTag],
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
