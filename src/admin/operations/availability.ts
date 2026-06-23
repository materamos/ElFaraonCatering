import type { AvailabilityTargetState, RpcResult } from "../core/types";
import { resultMessage } from "../core/responses";
import type { AdminOperationContext } from "./types";

export function createAvailabilityOperations(context: AdminOperationContext) {
  return {
    saveAvailabilityOverlay(target: AvailabilityTargetState, available: boolean): Promise<void> {
      return context.runBusy(async () => {
        const result = await context.callMutation("set_menu_availability_overlay", {
          menu_id: target.menu_id,
          section_id: target.section_id,
          item_id: target.item_id,
          available_override: available,
        });

        if (!result.ok) {
          throw new Error(resultMessage(result));
        }

        await context.loadAdminState(
          result.changed ? "Disponibilidad actualizada. Ya se ve en el menú público." : "Sin cambios.",
          "success",
        );
      }, available ? "Mostrando item..." : "Ocultando item...");
    },

    clearAvailabilityOverlay(target: AvailabilityTargetState): Promise<void> {
      return context.runBusy(async () => {
        const result = await context.callMutation("clear_menu_availability_overlay", {
          menu_id: target.menu_id,
          section_id: target.section_id,
          item_id: target.item_id,
        });

        if (!result.ok) {
          throw new Error(resultMessage(result));
        }

        await context.loadAdminState(
          result.changed ? "Ajuste quitado. Ya se ve en el menú público." : "Sin cambios.",
          "success",
        );
      }, "Quitando ajuste...");
    },

    saveAvailabilityOverlayBatch(targets: AvailabilityTargetState[], available: boolean): Promise<void> {
      return context.runBusy(async () => {
        const results: RpcResult[] = [];

        for (const target of targets) {
          const result = await context.callMutation("set_menu_availability_overlay", {
            menu_id: target.menu_id,
            section_id: target.section_id,
            item_id: target.item_id,
            available_override: available,
          });

          if (!result.ok) {
            throw new Error(resultMessage(result));
          }

          results.push(result);
        }

        const changed = results.some((result) => result.changed);

        await context.loadAdminState(
          changed ? "Disponibilidad actualizada. Ya se ve en el menú público." : "Sin cambios.",
          "success",
        );
      }, available ? "Mostrando items..." : "Ocultando items...");
    },

    clearAvailabilityOverlayBatch(targets: AvailabilityTargetState[]): Promise<void> {
      return context.runBusy(async () => {
        const results: RpcResult[] = [];

        for (const target of targets) {
          const result = await context.callMutation("clear_menu_availability_overlay", {
            menu_id: target.menu_id,
            section_id: target.section_id,
            item_id: target.item_id,
          });

          if (!result.ok) {
            throw new Error(resultMessage(result));
          }

          results.push(result);
        }

        const changed = results.some((result) => result.changed);

        await context.loadAdminState(
          changed ? "Ajuste quitado. Ya se ve en el menú público." : "Sin cambios.",
          "success",
        );
      }, "Quitando ajuste...");
    },
  };
}
