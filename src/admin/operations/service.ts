import { getFormString, getNullableFormString } from "../core/forms";
import { createMutationRunner } from "./helpers";
import type { AdminOperationContext } from "./types";

export function createServiceOperations(context: AdminOperationContext) {
  const { runPublicationMutation } = createMutationRunner(context);

  return {
    saveDailyMenu(form: HTMLFormElement): Promise<void> {
      return runPublicationMutation({
        mutation: "set_daily_menu",
        body: {
          regular_name: getFormString(form, "regular_name"),
          regular_description: getNullableFormString(form, "regular_description"),
          vegetarian_name: getFormString(form, "vegetarian_name"),
          vegetarian_description: getNullableFormString(form, "vegetarian_description"),
        },
        busyText: "Guardando menú del día...",
        successPrefix: "Menú guardado.",
      });
    },

    saveServiceKind(form: HTMLFormElement): Promise<void> {
      return runPublicationMutation({
        mutation: "set_profile_service_kind",
        body: {
          profile_id: getFormString(form, "profile_id"),
          service_kind: getFormString(form, "service_kind"),
        },
        busyText: "Guardando servicio...",
        successPrefix: "Servicio guardado.",
      });
    },
  };
}
