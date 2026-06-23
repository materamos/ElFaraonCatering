import type { CatalogItemOptionState, CatalogItemState, RpcResult } from "../core/types";
import {
  getFormInteger,
  getFormString,
  getNullableFormString,
} from "../core/forms";
import { resultMessage } from "../core/responses";
import { partialMutationError, publicationStatus } from "./helpers";
import type { AdminOperationContext } from "./types";

export function createCatalogOperations(context: AdminOperationContext) {
  return {
    saveCatalogItem(form: HTMLFormElement): Promise<void> {
      return context.runBusy(async () => {
        const amountValue = getNullableFormString(form, "amount");
        const result = await context.callMutation("add_catalog_item", {
          section_id: getFormString(form, "section_id"),
          item_id: getFormString(form, "item_id"),
          name: getFormString(form, "name"),
          description: getNullableFormString(form, "description"),
          amount: amountValue ? getFormInteger(form, "amount") : null,
        });

        if (!result.ok) {
          throw new Error(resultMessage(result));
        }

        await context.loadAdminState(
          publicationStatus(
            result.changed,
            "Item agregado. Falta publicar los cambios.",
            "Item agregado. No hay cambios pendientes de publicación.",
          ),
          "success",
        );
      }, "Agregando item...");
    },

    deleteCatalogItem(item: CatalogItemState): Promise<void> {
      return context.runBusy(async () => {
        const result = await context.callMutation("delete_catalog_item", {
          section_id: item.section_id,
          item_id: item.item_id,
        });

        if (!result.ok) {
          throw new Error(resultMessage(result));
        }

        await context.loadAdminState(
          publicationStatus(
            result.changed,
            "Item eliminado. Falta publicar los cambios.",
            "Item eliminado. No hay cambios pendientes de publicación.",
          ),
          "success",
        );
      }, "Eliminando item...");
    },

    saveCatalogItemEdit(form: HTMLFormElement): Promise<void> {
      return context.runBusy(async () => {
        const results: RpcResult[] = [];

        try {
          const itemResult = await context.callMutation("update_catalog_item", {
            section_id: getFormString(form, "section_id"),
            item_id: getFormString(form, "item_id"),
            name: getFormString(form, "name"),
            description: getNullableFormString(form, "description"),
          });

          if (!itemResult.ok) {
            throw new Error(resultMessage(itemResult));
          }

          results.push(itemResult);

          const fixedPricingKey = getFormString(form, "fixed_pricing_key");

          if (fixedPricingKey) {
            const priceResult = await context.callMutation("set_global_fixed_price", {
              pricing_key: fixedPricingKey,
              amount: getFormInteger(form, "fixed_price_amount"),
            });

            if (!priceResult.ok) {
              throw new Error(resultMessage(priceResult));
            }

            results.push(priceResult);
          }

          const variantPricingKey = getFormString(form, "variant_pricing_key");

          if (variantPricingKey) {
            const formData = new FormData(form);
            const variantIds = formData.getAll("variant_id");
            const variantAmounts = formData.getAll("variant_amount");

            for (let index = 0; index < variantIds.length; index += 1) {
              const variantId = variantIds[index];
              const amountValue = variantAmounts[index];

              if (typeof variantId !== "string" || typeof amountValue !== "string") {
                continue;
              }

              const amount = Number(amountValue.trim());

              if (!Number.isInteger(amount) || amount < 0) {
                throw new Error("El importe no es válido.");
              }

              const priceResult = await context.callMutation("set_global_price_variant", {
                pricing_key: variantPricingKey,
                variant_id: variantId,
                amount,
              });

              if (!priceResult.ok) {
                throw new Error(resultMessage(priceResult));
              }

              results.push(priceResult);
            }
          }

          const changed = results.some((result) => result.changed);

          await context.loadAdminState(
            publicationStatus(
              changed,
              "Item actualizado. Falta publicar los cambios.",
              "Item actualizado. No hay cambios pendientes de publicación.",
            ),
            "success",
          );
        } catch (error) {
          throw partialMutationError(error, results);
        }
      }, "Guardando item...");
    },

    saveCatalogOption(form: HTMLFormElement): Promise<void> {
      return context.runBusy(async () => {
        const result = await context.callMutation("add_catalog_item_option", {
          section_id: getFormString(form, "section_id"),
          item_id: getFormString(form, "item_id"),
          option_id: getFormString(form, "option_id"),
          name: getFormString(form, "name"),
        });

        if (!result.ok) {
          throw new Error(resultMessage(result));
        }

        await context.loadAdminState(
          publicationStatus(
            result.changed,
            "Opción agregada. Falta publicar los cambios.",
            "Opción agregada. No hay cambios pendientes de publicación.",
          ),
          "success",
        );
      }, "Agregando opción...");
    },

    saveCatalogOptionEdit(form: HTMLFormElement): Promise<void> {
      return context.runBusy(async () => {
        const result = await context.callMutation("update_catalog_item_option", {
          section_id: getFormString(form, "section_id"),
          item_id: getFormString(form, "item_id"),
          option_id: getFormString(form, "option_id"),
          name: getFormString(form, "name"),
        });

        if (!result.ok) {
          throw new Error(resultMessage(result));
        }

        await context.loadAdminState(
          publicationStatus(
            result.changed,
            "Opción actualizada. Falta publicar los cambios.",
            "Opción actualizada. No hay cambios pendientes de publicación.",
          ),
          "success",
        );
      }, "Guardando opción...");
    },

    deleteCatalogOption(option: CatalogItemOptionState): Promise<void> {
      return context.runBusy(async () => {
        const result = await context.callMutation("delete_catalog_item_option", {
          section_id: option.section_id,
          item_id: option.item_id,
          option_id: option.option_id,
        });

        if (!result.ok) {
          throw new Error(resultMessage(result));
        }

        await context.loadAdminState(
          publicationStatus(
            result.changed,
            "Opción eliminada. Falta publicar los cambios.",
            "Opción eliminada. No hay cambios pendientes de publicación.",
          ),
          "success",
        );
      }, "Eliminando opción...");
    },
  };
}
