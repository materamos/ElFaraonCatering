import { getFormString, getNullableFormString, resultMessage } from "../core/utils";
import { publicationStatus } from "./helpers";
import type { AdminOperationContext } from "./types";

export function createServiceOperations(context: AdminOperationContext) {
  return {
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
            "Menú guardado. Falta publicar los cambios.",
            "Menú guardado. No hay cambios pendientes de publicación.",
          ),
          "success",
        );
      }, "Guardando menú del día...");
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
            "Servicio guardado. No hay cambios pendientes de publicación.",
          ),
          "success",
        );
      }, "Guardando servicio...");
    },
  };
}
