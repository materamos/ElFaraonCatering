import { getFormInteger, getFormString } from "../core/forms";
import { createMutationRunner } from "./helpers";
import type { AdminOperationContext } from "./types";

export function createPriceOperations(context: AdminOperationContext) {
  const { runPublicationMutation } = createMutationRunner(context);

  return {
    saveFixedPrice(form: HTMLFormElement): Promise<void> {
      return runPublicationMutation({
        mutation: "set_global_fixed_price",
        body: {
          pricing_key: getFormString(form, "pricing_key"),
          amount: getFormInteger(form, "amount"),
        },
        busyText: "Guardando precio...",
        successPrefix: "Precio guardado.",
      });
    },

    saveVariantPrice(form: HTMLFormElement): Promise<void> {
      return runPublicationMutation({
        mutation: "set_global_price_variant",
        body: {
          pricing_key: getFormString(form, "pricing_key"),
          variant_id: getFormString(form, "variant_id"),
          amount: getFormInteger(form, "amount"),
        },
        busyText: "Guardando variante...",
        successPrefix: "Variante guardada.",
      });
    },
  };
}
