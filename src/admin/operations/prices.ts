import { getFormInteger, getFormString } from "../core/forms";
import { resultMessage } from "../core/responses";
import { publicationStatus } from "./helpers";
import type { AdminOperationContext } from "./types";

export function createPriceOperations(context: AdminOperationContext) {
  return {
    saveFixedPrice(form: HTMLFormElement): Promise<void> {
      return context.runBusy(async () => {
        const result = await context.callMutation("set_global_fixed_price", {
          pricing_key: getFormString(form, "pricing_key"),
          amount: getFormInteger(form, "amount"),
        });

        if (!result.ok) {
          throw new Error(resultMessage(result));
        }

        await context.loadAdminState(
          publicationStatus(
            result.changed,
            "Precio guardado. Falta publicar los cambios.",
            "Precio guardado. No hay cambios pendientes de publicación.",
          ),
          "success",
        );
      }, "Guardando precio...");
    },

    saveVariantPrice(form: HTMLFormElement): Promise<void> {
      return context.runBusy(async () => {
        const pricingKey = getFormString(form, "pricing_key");
        const variantId = getFormString(form, "variant_id");

        const result = await context.callMutation("set_global_price_variant", {
          pricing_key: pricingKey,
          variant_id: variantId,
          amount: getFormInteger(form, "amount"),
        });

        if (!result.ok) {
          throw new Error(resultMessage(result));
        }

        await context.loadAdminState(
          publicationStatus(
            result.changed,
            "Variante guardada. Falta publicar los cambios.",
            "Variante guardada. No hay cambios pendientes de publicación.",
          ),
          "success",
        );
      }, "Guardando variante...");
    },
  };
}
