import type { CatalogItemOptionState, CatalogItemState, RpcResult } from "../core/types";
import {
  getFormInteger,
  getFormString,
  getNullableFormString,
} from "../core/forms";
import {
  createMutationRunner,
  partialMutationError,
  publicationSaveStatus,
  requireOk,
} from "./helpers";
import type { AdminOperationContext } from "./types";

export function createCatalogOperations(context: AdminOperationContext) {
  const { runPublicationMutation } = createMutationRunner(context);

  return {
    saveCatalogItem(form: HTMLFormElement): Promise<void> {
      const amountValue = getNullableFormString(form, "amount");

      return runPublicationMutation({
        mutation: "add_catalog_item",
        body: {
          section_id: getFormString(form, "section_id"),
          // The RPC signature requires item_id, but the server ignores it and generates the id.
          item_id: "",
          name: getFormString(form, "name"),
          description: getNullableFormString(form, "description"),
          amount: amountValue ? getFormInteger(form, "amount") : null,
        },
        busyText: "Agregando item...",
        successPrefix: "Item agregado.",
      });
    },

    deleteCatalogItem(item: CatalogItemState): Promise<void> {
      return runPublicationMutation({
        mutation: "delete_catalog_item",
        body: {
          section_id: item.section_id,
          item_id: item.item_id,
        },
        busyText: "Eliminando item...",
        successPrefix: "Item eliminado.",
      });
    },

    saveCatalogItemEdit(form: HTMLFormElement): Promise<void> {
      return context.runBusy(async () => {
        const results: RpcResult[] = [];

        try {
          const itemResult = requireOk(await context.callMutation("update_catalog_item", {
            section_id: getFormString(form, "section_id"),
            item_id: getFormString(form, "item_id"),
            name: getFormString(form, "name"),
            description: getNullableFormString(form, "description"),
          }));

          results.push(itemResult);

          const fixedPricingKey = getFormString(form, "fixed_pricing_key");

          if (fixedPricingKey) {
            const priceResult = requireOk(await context.callMutation("set_global_fixed_price", {
              pricing_key: fixedPricingKey,
              amount: getFormInteger(form, "fixed_price_amount"),
            }));

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

              const priceResult = requireOk(await context.callMutation("set_global_price_variant", {
                pricing_key: variantPricingKey,
                variant_id: variantId,
                amount,
              }));

              results.push(priceResult);
            }
          }

          const changed = results.some((result) => result.changed);

          await context.loadAdminState(
            publicationSaveStatus("Item actualizado.", changed),
            "success",
          );
        } catch (error) {
          throw partialMutationError(error, results);
        }
      }, "Guardando item...");
    },

    saveCatalogOption(form: HTMLFormElement): Promise<void> {
      return runPublicationMutation({
        mutation: "add_catalog_item_option",
        body: {
          section_id: getFormString(form, "section_id"),
          item_id: getFormString(form, "item_id"),
          // The RPC signature requires option_id, but the server ignores it and generates the id.
          option_id: "",
          name: getFormString(form, "name"),
        },
        busyText: "Agregando opción...",
        successPrefix: "Opción agregada.",
      });
    },

    saveCatalogOptionEdit(form: HTMLFormElement): Promise<void> {
      return runPublicationMutation({
        mutation: "update_catalog_item_option",
        body: {
          section_id: getFormString(form, "section_id"),
          item_id: getFormString(form, "item_id"),
          option_id: getFormString(form, "option_id"),
          name: getFormString(form, "name"),
        },
        busyText: "Guardando opción...",
        successPrefix: "Opción actualizada.",
      });
    },

    deleteCatalogOption(option: CatalogItemOptionState): Promise<void> {
      return runPublicationMutation({
        mutation: "delete_catalog_item_option",
        body: {
          section_id: option.section_id,
          item_id: option.item_id,
          option_id: option.option_id,
        },
        busyText: "Eliminando opción...",
        successPrefix: "Opción eliminada.",
      });
    },
  };
}
