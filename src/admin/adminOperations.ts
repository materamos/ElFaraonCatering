import type {
  AuthSession,
  AvailabilityTargetState,
  CatalogItemOptionState,
  CatalogItemState,
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
  loadAdminState(statusText?: string, statusTone?: StatusTone): Promise<void>;
  markPendingIfNeeded(result: RpcResult): void;
  requireSession(): Promise<AuthSession>;
  publishMenuChanges(session: AuthSession): Promise<RpcResult>;
  setPendingPublication(value: boolean): void;
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

        context.markPendingIfNeeded(result);
        await context.loadAdminState(
          result.changed ? "Menu guardado. Para verlo en el menu publico, publica los cambios." : "Sin cambios.",
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

        context.markPendingIfNeeded(result);
        await context.loadAdminState(
          result.changed ? "Servicio guardado. Para verlo en el menu publico, publica los cambios." : "Sin cambios.",
          "success",
        );
      }, "Guardando servicio...");
    },

    saveGrillItem(form: HTMLFormElement): Promise<void> {
      return context.runBusy(async () => {
        const result = await context.callMutation("add_grill_item", {
          family_id: getFormString(form, "family_id"),
          item_id: getFormString(form, "item_id"),
          name: getFormString(form, "name"),
          variant_name: getNullableFormString(form, "variant_name"),
          amount: getFormInteger(form, "amount"),
        });

        if (!result.ok) {
          throw new Error(resultMessage(result));
        }

        context.markPendingIfNeeded(result);
        await context.loadAdminState(
          result.changed ? "Item de parrilla agregado. Para verlo en el menu publico, publica los cambios." : "Sin cambios.",
          "success",
        );
      }, "Agregando item de parrilla...");
    },

    saveGrillItemEdit(form: HTMLFormElement): Promise<void> {
      return context.runBusy(async () => {
        const result = await context.callMutation("update_grill_item", {
          item_id: getFormString(form, "item_id"),
          name: getFormString(form, "name"),
          variant_name: getNullableFormString(form, "variant_name"),
        });

        if (!result.ok) {
          throw new Error(resultMessage(result));
        }

        context.markPendingIfNeeded(result);
        await context.loadAdminState(
          result.changed ? "Item de parrilla actualizado. Para verlo en el menu publico, publica los cambios." : "Sin cambios.",
          "success",
        );
      }, "Guardando item de parrilla...");
    },

    deleteGrillItem(item: GrillItemState): Promise<void> {
      return context.runBusy(async () => {
        const result = await context.callMutation("delete_grill_item", {
          item_id: item.item_id,
        });

        if (!result.ok) {
          throw new Error(resultMessage(result));
        }

        context.markPendingIfNeeded(result);
        await context.loadAdminState(
          result.changed ? "Item de parrilla eliminado. Para quitarlo del menu publico, publica los cambios." : "Sin cambios.",
          "success",
        );
      }, "Eliminando item de parrilla...");
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

        context.markPendingIfNeeded(result);
        await context.loadAdminState(
          result.changed ? "Precio guardado. Para verlo en el menu publico, publica los cambios." : "Sin cambios.",
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

        context.markPendingIfNeeded(result);
        await context.loadAdminState(
          result.changed ? "Variante guardada. Para verla en el menu publico, publica los cambios." : "Sin cambios.",
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

        context.markPendingIfNeeded(result);
        await context.loadAdminState(
          result.changed ? "Item agregado. Para verlo en el menu publico, publica los cambios." : "Sin cambios.",
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

        context.markPendingIfNeeded(result);
        await context.loadAdminState(
          result.changed ? "Item eliminado. Para quitarlo del menu publico, publica los cambios." : "Sin cambios.",
          "success",
        );
      }, "Eliminando item...");
    },

    saveCatalogItemEdit(form: HTMLFormElement): Promise<void> {
      return context.runBusy(async () => {
        const result = await context.callMutation("update_catalog_item", {
          section_id: getFormString(form, "section_id"),
          group_id: getFormString(form, "group_id"),
          item_id: getFormString(form, "item_id"),
          name: getFormString(form, "name"),
          description: getNullableFormString(form, "description"),
        });

        if (!result.ok) {
          throw new Error(resultMessage(result));
        }

        context.markPendingIfNeeded(result);
        await context.loadAdminState(
          result.changed ? "Item actualizado. Para verlo en el menu publico, publica los cambios." : "Sin cambios.",
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

        context.markPendingIfNeeded(result);
        await context.loadAdminState(
          result.changed ? "Opcion agregada. Para verla en el menu publico, publica los cambios." : "Sin cambios.",
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

        context.markPendingIfNeeded(result);
        await context.loadAdminState(
          result.changed ? "Opcion actualizada. Para verla en el menu publico, publica los cambios." : "Sin cambios.",
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

        context.markPendingIfNeeded(result);
        await context.loadAdminState(
          result.changed ? "Opcion eliminada. Para quitarla del menu publico, publica los cambios." : "Sin cambios.",
          "success",
        );
      }, "Eliminando opcion...");
    },

    publishChanges(): Promise<void> {
      return context.runBusy(async () => {
        const session = await context.requireSession();
        const result = await context.publishMenuChanges(session);

        if (result.message === "publish_queued") {
          context.setPendingPublication(false);
          await context.loadAdminState(
            "Publicacion solicitada. El menu publico puede tardar unos minutos en actualizarse.",
            "success",
          );
          return;
        }

        if (result.message === "publish_recently_queued") {
          context.setPendingPublication(true);
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
