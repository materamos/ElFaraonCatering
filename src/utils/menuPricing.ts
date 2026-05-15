import type { MenuPricing, MenuPricingVariant } from "../types/menu";

const formatMenuAmount = (amount: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount);

export const getPricingText = (value: MenuPricing) => {
  if (value.kind === "fixed") {
    return formatMenuAmount(value.price.amount);
  }

  if (value.kind === "included") {
    return "Incluida como opci\u00f3n";
  }

  return null;
};

export const getVariantPricingText = (variant: MenuPricingVariant) =>
  formatMenuAmount(variant.price.amount);
