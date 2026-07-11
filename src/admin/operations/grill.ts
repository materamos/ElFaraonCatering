import type { GrillFamilyState, GrillItemState, RpcResult } from "../core/types";
import { getFormInteger, getFormString } from "../core/forms";
import {
  createMutationRunner,
  partialMutationError,
  publicationSaveStatus,
  requireOk,
} from "./helpers";
import type { AdminOperationContext } from "./types";

export function createGrillOperations(context: AdminOperationContext) {
  const { runPublicationMutation } = createMutationRunner(context);

  return {
    saveGrillItem(form: HTMLFormElement): Promise<void> {
      return runPublicationMutation({
        mutation: "add_grill_item",
        body: {
          family_id: getFormString(form, "family_id"),
          // The RPC signature requires item_id, but the server ignores it and generates the id.
          item_id: "",
          name: getFormString(form, "variant_name"),
          variant_name: getFormString(form, "variant_name"),
          amount: getFormInteger(form, "amount"),
        },
        busyText: "Agregando opción de parrilla...",
        successPrefix: "Opción de parrilla agregada.",
      });
    },

    saveGrillProduct(form: HTMLFormElement): Promise<void> {
      return runPublicationMutation({
        mutation: "add_grill_product",
        body: {
          // The RPC signature requires family_id and item_id, but the server generates both ids.
          family_id: "",
          title: getFormString(form, "title"),
          item_id: "",
          variant_name: getFormString(form, "variant_name"),
          amount: getFormInteger(form, "amount"),
        },
        busyText: "Agregando producto de parrilla...",
        successPrefix: "Producto de parrilla agregado.",
      });
    },

    saveGrillProductEdit(form: HTMLFormElement): Promise<void> {
      return runPublicationMutation({
        mutation: "update_grill_product",
        body: {
          family_id: getFormString(form, "family_id"),
          title: getFormString(form, "title"),
        },
        busyText: "Guardando producto de parrilla...",
        successPrefix: "Producto de parrilla actualizado.",
      });
    },

    saveGrillItemEdit(form: HTMLFormElement): Promise<void> {
      return context.runBusy(async () => {
        const results: RpcResult[] = [];

        try {
          const optionName = getFormString(form, "variant_name");
          const result = requireOk(await context.callMutation("update_grill_item", {
            item_id: getFormString(form, "item_id"),
            name: optionName,
            variant_name: optionName,
          }));

          results.push(result);

          const fixedPricingKey = getFormString(form, "fixed_pricing_key");

          if (fixedPricingKey) {
            const priceResult = requireOk(await context.callMutation("set_global_fixed_price", {
              pricing_key: fixedPricingKey,
              amount: getFormInteger(form, "fixed_price_amount"),
            }));

            results.push(priceResult);
          }

          const changed = results.some((entry) => entry.changed);

          await context.loadAdminState(
            publicationSaveStatus("Opción de parrilla actualizada.", changed),
            "success",
          );
        } catch (error) {
          throw partialMutationError(error, results);
        }
      }, "Guardando opción de parrilla...");
    },

    deleteGrillItem(item: GrillItemState): Promise<void> {
      return runPublicationMutation({
        mutation: "delete_grill_item",
        body: {
          item_id: item.item_id,
        },
        busyText: "Eliminando opción de parrilla...",
        successPrefix: "Opción de parrilla eliminada.",
      });
    },

    deleteGrillProduct(family: GrillFamilyState): Promise<void> {
      return runPublicationMutation({
        mutation: "delete_grill_product",
        body: {
          family_id: family.family_id,
        },
        busyText: "Eliminando producto de parrilla...",
        successPrefix: "Producto de parrilla eliminado.",
      });
    },
  };
}
