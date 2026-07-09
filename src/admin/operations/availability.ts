import type { AvailabilityTargetState } from "../core/types";
import { createMutationRunner } from "./helpers";
import type { AdminOperationContext } from "./types";

export function createAvailabilityOperations(context: AdminOperationContext) {
  const { runInstantMutation } = createMutationRunner(context);

  return {
    saveAvailabilityOverlay(target: AvailabilityTargetState, available: boolean): Promise<void> {
      return runInstantMutation({
        mutation: "set_menu_availability_overlay",
        body: {
          menu_id: target.menu_id,
          section_id: target.section_id,
          item_id: target.item_id,
          available_override: available,
        },
        busyText: available ? "Mostrando item..." : "Ocultando item...",
        changedMessage: "Disponibilidad actualizada. Ya se ve en el menú público.",
      });
    },

    clearAvailabilityOverlay(target: AvailabilityTargetState): Promise<void> {
      return runInstantMutation({
        mutation: "clear_menu_availability_overlay",
        body: {
          menu_id: target.menu_id,
          section_id: target.section_id,
          item_id: target.item_id,
        },
        busyText: "Quitando ajuste...",
        changedMessage: "Ajuste quitado. Ya se ve en el menú público.",
      });
    },

    saveAvailabilityOverlayBatch(targets: AvailabilityTargetState[], available: boolean): Promise<void> {
      return runInstantMutation({
        mutation: "set_menu_availability_overlays",
        body: {
          targets: toAvailabilityTargetInputs(targets),
          available_override: available,
        },
        busyText: available ? "Mostrando items..." : "Ocultando items...",
        changedMessage: "Disponibilidad actualizada. Ya se ve en el menú público.",
      });
    },

    clearAvailabilityOverlayBatch(targets: AvailabilityTargetState[]): Promise<void> {
      return runInstantMutation({
        mutation: "clear_menu_availability_overlays",
        body: {
          targets: toAvailabilityTargetInputs(targets),
        },
        busyText: "Quitando ajuste...",
        changedMessage: "Ajuste quitado. Ya se ve en el menú público.",
      });
    },
  };
}

function toAvailabilityTargetInputs(targets: AvailabilityTargetState[]): Array<{
  menu_id: string;
  section_id: string;
  item_id: string;
}> {
  return targets.map((target) => ({
    menu_id: target.menu_id,
    section_id: target.section_id,
    item_id: target.item_id,
  }));
}
