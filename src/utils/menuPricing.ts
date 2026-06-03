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
    return "Incluida como opción";
  }

  return null;
};

export const getVariantPricingText = (variant: MenuPricingVariant) =>
  formatMenuAmount(variant.price.amount);
