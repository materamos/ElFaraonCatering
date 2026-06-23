import type { GrillFamilyState, GrillItemState, RpcResult } from "../core/types";
import { getFormInteger, getFormString } from "../core/forms";
import { resultMessage } from "../core/responses";
import { partialMutationError, publicationStatus } from "./helpers";
import type { AdminOperationContext } from "./types";

export function createGrillOperations(context: AdminOperationContext) {
  return {
    saveGrillItem(form: HTMLFormElement): Promise<void> {
      return context.runBusy(async () => {
        const result = await context.callMutation("add_grill_item", {
          family_id: getFormString(form, "family_id"),
          item_id: getFormString(form, "item_id"),
          name: getFormString(form, "variant_name"),
          variant_name: getFormString(form, "variant_name"),
          amount: getFormInteger(form, "amount"),
        });

        if (!result.ok) {
          throw new Error(resultMessage(result));
        }

        await context.loadAdminState(
          publicationStatus(
            result.changed,
            "Opción de parrilla agregada. Falta publicar los cambios.",
            "Opción de parrilla agregada. No hay cambios pendientes de publicación.",
          ),
          "success",
        );
      }, "Agregando opción de parrilla...");
    },

    saveGrillProduct(form: HTMLFormElement): Promise<void> {
      return context.runBusy(async () => {
        const result = await context.callMutation("add_grill_product", {
          family_id: getFormString(form, "family_id"),
          title: getFormString(form, "title"),
          item_id: getFormString(form, "item_id"),
          variant_name: getFormString(form, "variant_name"),
          amount: getFormInteger(form, "amount"),
        });

        if (!result.ok) {
          throw new Error(resultMessage(result));
        }

        await context.loadAdminState(
          publicationStatus(
            result.changed,
            "Producto de parrilla agregado. Falta publicar los cambios.",
            "Producto de parrilla agregado. No hay cambios pendientes de publicación.",
          ),
          "success",
        );
      }, "Agregando producto de parrilla...");
    },

    saveGrillProductEdit(form: HTMLFormElement): Promise<void> {
      return context.runBusy(async () => {
        const result = await context.callMutation("update_grill_product", {
          family_id: getFormString(form, "family_id"),
          title: getFormString(form, "title"),
        });

        if (!result.ok) {
          throw new Error(resultMessage(result));
        }

        await context.loadAdminState(
          publicationStatus(
            result.changed,
            "Producto de parrilla actualizado. Falta publicar los cambios.",
            "Producto de parrilla actualizado. No hay cambios pendientes de publicación.",
          ),
          "success",
        );
      }, "Guardando producto de parrilla...");
    },

    saveGrillItemEdit(form: HTMLFormElement): Promise<void> {
      return context.runBusy(async () => {
        const results: RpcResult[] = [];

        try {
          const optionName = getFormString(form, "variant_name");
          const result = await context.callMutation("update_grill_item", {
            item_id: getFormString(form, "item_id"),
            name: optionName,
            variant_name: optionName,
          });

          if (!result.ok) {
            throw new Error(resultMessage(result));
          }

          results.push(result);

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

          const changed = results.some((entry) => entry.changed);

          await context.loadAdminState(
            publicationStatus(
              changed,
              "Opción de parrilla actualizada. Falta publicar los cambios.",
              "Opción de parrilla actualizada. No hay cambios pendientes de publicación.",
            ),
            "success",
          );
        } catch (error) {
          throw partialMutationError(error, results);
        }
      }, "Guardando opción de parrilla...");
    },

    deleteGrillItem(item: GrillItemState): Promise<void> {
      return context.runBusy(async () => {
        const result = await context.callMutation("delete_grill_item", {
          item_id: item.item_id,
        });

        if (!result.ok) {
          throw new Error(resultMessage(result));
        }

        await context.loadAdminState(
          publicationStatus(
            result.changed,
            "Opción de parrilla eliminada. Falta publicar los cambios.",
            "Opción de parrilla eliminada. No hay cambios pendientes de publicación.",
          ),
          "success",
        );
      }, "Eliminando opción de parrilla...");
    },

    deleteGrillProduct(family: GrillFamilyState): Promise<void> {
      return context.runBusy(async () => {
        const result = await context.callMutation("delete_grill_product", {
          family_id: family.family_id,
        });

        if (!result.ok) {
          throw new Error(resultMessage(result));
        }

        await context.loadAdminState(
          publicationStatus(
            result.changed,
            "Producto de parrilla eliminado. Falta publicar los cambios.",
            "Producto de parrilla eliminado. No hay cambios pendientes de publicación.",
          ),
          "success",
        );
      }, "Eliminando producto de parrilla...");
    },
  };
}
