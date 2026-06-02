import type {
  AdminOperationalState,
  AuthSession,
  AvailabilityTargetState,
  CatalogItemOptionState,
  CatalogItemState,
  GrillFamilyState,
  GrillItemState,
  RpcResult,
  StatusTone,
} from "./adminTypes";
import {
  formatCooldownSuffix,
  getFormInteger,
  getFormString,
  getNullableFormString,
  resultMessage,
} from "./adminUtils";

interface AdminOperationContext {
  runBusy(action: () => Promise<void>, busyText?: string): Promise<void>;
  callMutation(name: string, body: Record<string, unknown>): Promise<RpcResult>;
  loadAdminState(
    statusText?: string | ((state: AdminOperationalState) => string),
    statusTone?: StatusTone,
  ): Promise<AdminOperationalState>;
  requireSession(): Promise<AuthSession>;
  publishMenuChanges(session: AuthSession): Promise<RpcResult>;
}

export function createAdminOperations(context: AdminOperationContext) {
  return {
    saveAvailabilityOverlay(target: AvailabilityTargetState, available: boolean): Promise<void> {
      return context.runBusy(async () => {
        const result = await context.callMutation("set_menu_availability_overlay", {
          menu_id: target.menu_id,
          section_id: target.section_id,
          group_id: target.group_id || null,
          item_id: target.item_id,
          available_override: available,
        });

        if (!result.ok) {
          throw new Error(resultMessage(result));
        }

        await context.loadAdminState(
          result.changed ? "Disponibilidad actualizada. Ya se ve en el menu publico." : "Sin cambios.",
          "success",
        );
      }, available ? "Mostrando item..." : "Ocultando item...");
    },

    clearAvailabilityOverlay(target: AvailabilityTargetState): Promise<void> {
      return context.runBusy(async () => {
        const result = await context.callMutation("clear_menu_availability_overlay", {
          menu_id: target.menu_id,
          section_id: target.section_id,
          group_id: target.group_id || null,
          item_id: target.item_id,
        });

        if (!result.ok) {
          throw new Error(resultMessage(result));
        }

        await context.loadAdminState(
          result.changed ? "Ajuste quitado. Ya se ve en el menu publico." : "Sin cambios.",
          "success",
        );
      }, "Quitando ajuste...");
    },

    saveDailyMenu(form: HTMLFormElement): Promise<void> {
      return context.runBusy(async () => {
        const result = await context.callMutation("set_daily_menu", {
          regular_name: getFormString(form, "regular_name"),
          regular_description: getNullableFormString(form, "regular_description"),
          vegetarian_name: getFormString(form, "vegetarian_name"),
          vegetarian_description: getNullableFormString(form, "vegetarian_description"),
        });

        if (!result.ok) {
          throw new Error(resultMessage(result));
        }

        await context.loadAdminState(
          publicationStatus(
            result.changed,
            "Menu guardado. Falta publicar los cambios.",
            "Menu guardado. No hay cambios pendientes de publicacion.",
          ),
          "success",
        );
      }, "Guardando menu del dia...");
    },

    saveServiceKind(form: HTMLFormElement): Promise<void> {
      return context.runBusy(async () => {
        const result = await context.callMutation("set_profile_service_kind", {
          profile_id: getFormString(form, "profile_id"),
          service_kind: getFormString(form, "service_kind"),
        });

        if (!result.ok) {
          throw new Error(resultMessage(result));
        }

        await context.loadAdminState(
          publicationStatus(
            result.changed,
            "Servicio guardado. Falta publicar los cambios.",
            "Servicio guardado. No hay cambios pendientes de publicacion.",
          ),
          "success",
        );
      }, "Guardando servicio...");
    },

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
            "Opcion de parrilla agregada. Falta publicar los cambios.",
            "Opcion de parrilla agregada. No hay cambios pendientes de publicacion.",
          ),
          "success",
        );
      }, "Agregando opcion de parrilla...");
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
            "Producto de parrilla agregado. No hay cambios pendientes de publicacion.",
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
            "Producto de parrilla actualizado. No hay cambios pendientes de publicacion.",
          ),
          "success",
        );
      }, "Guardando producto de parrilla...");
    },

    saveGrillItemEdit(form: HTMLFormElement): Promise<void> {
      return context.runBusy(async () => {
        const results: RpcResult[] = [];
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
            "Opcion de parrilla actualizada. Falta publicar los cambios.",
            "Opcion de parrilla actualizada. No hay cambios pendientes de publicacion.",
          ),
          "success",
        );
      }, "Guardando opcion de parrilla...");
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
            "Opcion de parrilla eliminada. Falta publicar los cambios.",
            "Opcion de parrilla eliminada. No hay cambios pendientes de publicacion.",
          ),
          "success",
        );
      }, "Eliminando opcion de parrilla...");
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
            "Producto de parrilla eliminado. No hay cambios pendientes de publicacion.",
          ),
          "success",
        );
      }, "Eliminando producto de parrilla...");
    },

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
            "Precio guardado. No hay cambios pendientes de publicacion.",
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
            "Variante guardada. No hay cambios pendientes de publicacion.",
          ),
          "success",
        );
      }, "Guardando variante...");
    },

    saveCatalogItem(form: HTMLFormElement): Promise<void> {
      return context.runBusy(async () => {
        const amountValue = getNullableFormString(form, "amount");
        const result = await context.callMutation("add_catalog_item", {
          section_id: getFormString(form, "section_id"),
          group_id: getFormString(form, "group_id"),
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
            "Item agregado. No hay cambios pendientes de publicacion.",
          ),
          "success",
        );
      }, "Agregando item...");
    },

    deleteCatalogItem(item: CatalogItemState): Promise<void> {
      return context.runBusy(async () => {
        const result = await context.callMutation("delete_catalog_item", {
          section_id: item.section_id,
          group_id: item.group_id,
          item_id: item.item_id,
        });

        if (!result.ok) {
          throw new Error(resultMessage(result));
        }

        await context.loadAdminState(
          publicationStatus(
            result.changed,
            "Item eliminado. Falta publicar los cambios.",
            "Item eliminado. No hay cambios pendientes de publicacion.",
          ),
          "success",
        );
      }, "Eliminando item...");
    },

    saveCatalogItemEdit(form: HTMLFormElement): Promise<void> {
      return context.runBusy(async () => {
        const results: RpcResult[] = [];
        const itemResult = await context.callMutation("update_catalog_item", {
          section_id: getFormString(form, "section_id"),
          group_id: getFormString(form, "group_id"),
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
              throw new Error("El importe no es valido.");
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
            "Item actualizado. No hay cambios pendientes de publicacion.",
          ),
          "success",
        );
      }, "Guardando item...");
    },

    saveCatalogOption(form: HTMLFormElement): Promise<void> {
      return context.runBusy(async () => {
        const result = await context.callMutation("add_catalog_item_option", {
          section_id: getFormString(form, "section_id"),
          group_id: getFormString(form, "group_id"),
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
            "Opcion agregada. Falta publicar los cambios.",
            "Opcion agregada. No hay cambios pendientes de publicacion.",
          ),
          "success",
        );
      }, "Agregando opcion...");
    },

    saveCatalogOptionEdit(form: HTMLFormElement): Promise<void> {
      return context.runBusy(async () => {
        const result = await context.callMutation("update_catalog_item_option", {
          section_id: getFormString(form, "section_id"),
          group_id: getFormString(form, "group_id"),
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
            "Opcion actualizada. Falta publicar los cambios.",
            "Opcion actualizada. No hay cambios pendientes de publicacion.",
          ),
          "success",
        );
      }, "Guardando opcion...");
    },

    deleteCatalogOption(option: CatalogItemOptionState): Promise<void> {
      return context.runBusy(async () => {
        const result = await context.callMutation("delete_catalog_item_option", {
          section_id: option.section_id,
          group_id: option.group_id,
          item_id: option.item_id,
          option_id: option.option_id,
        });

        if (!result.ok) {
          throw new Error(resultMessage(result));
        }

        await context.loadAdminState(
          publicationStatus(
            result.changed,
            "Opcion eliminada. Falta publicar los cambios.",
            "Opcion eliminada. No hay cambios pendientes de publicacion.",
          ),
          "success",
        );
      }, "Eliminando opcion...");
    },

    publishChanges(): Promise<void> {
      return context.runBusy(async () => {
        const session = await context.requireSession();
        const result = await context.publishMenuChanges(session);

        if (result.message === "publish_queued") {
          await context.loadAdminState(
            "Publicacion solicitada. El menu publico puede tardar unos minutos en actualizarse.",
            "success",
          );
          return;
        }

        if (result.message === "publish_recently_queued") {
          await context.loadAdminState(
            `Ya se pidio una publicacion hace poco${formatCooldownSuffix(result)}. Los cambios quedan guardados; volve a publicar cuando este disponible.`,
            "neutral",
          );
          return;
        }

        await context.loadAdminState(resultMessage(result), "success");
      }, "Publicando cambios...");
    },
  };
}

function publicationStatus(
  changed: boolean,
  pendingMessage: string,
  cleanMessage: string,
): (state: AdminOperationalState) => string {
  return (state) => {
    if (!changed) {
      return "Sin cambios.";
    }

    return state.publication.has_unpublished_changes ? pendingMessage : cleanMessage;
  };
}
