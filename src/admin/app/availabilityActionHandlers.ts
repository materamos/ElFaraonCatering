import type { AdminActionHandlerContext } from "./actionHandlers";
import {
  findAvailabilityFamilyTargets,
  findAvailabilityTarget,
} from "../views/renderer";

export async function handleSetOverlayAction(
  context: AdminActionHandlerContext,
  target: HTMLElement,
): Promise<void> {
  if (!context.formState.confirmUnsavedChanges()) {
    return;
  }

  const familyKey = target.dataset.familyKey;
  const targetKey = target.dataset.targetKey;
  const available = target.dataset.available === "true";

  if (familyKey) {
    const familyTargets = findAvailabilityFamilyTargets(familyKey);

    if (familyTargets.length === 0) {
      context.setStatus("No se encontró la familia seleccionada.", "danger");
      return;
    }

    if (available) {
      await context.adminOperations.clearAvailabilityOverlayBatch(familyTargets);
    } else {
      await context.adminOperations.saveAvailabilityOverlayBatch(familyTargets, false);
    }

    return;
  }

  const availabilityTarget = targetKey ? findAvailabilityTarget(targetKey) : undefined;

  if (!availabilityTarget) {
    context.setStatus("No se encontró el item seleccionado.", "danger");
    return;
  }

  if (available) {
    await context.adminOperations.clearAvailabilityOverlay(availabilityTarget);
  } else {
    await context.adminOperations.saveAvailabilityOverlay(availabilityTarget, false);
  }
}

export async function handleClearOverlayAction(
  context: AdminActionHandlerContext,
  target: HTMLElement,
): Promise<void> {
  if (!context.formState.confirmUnsavedChanges()) {
    return;
  }

  const familyKey = target.dataset.familyKey;
  const targetKey = target.dataset.targetKey;

  if (familyKey) {
    const familyTargets = findAvailabilityFamilyTargets(familyKey);

    if (familyTargets.length === 0) {
      context.setStatus("No se encontró la familia seleccionada.", "danger");
      return;
    }

    await context.adminOperations.clearAvailabilityOverlayBatch(familyTargets);
    return;
  }

  const availabilityTarget = targetKey ? findAvailabilityTarget(targetKey) : undefined;

  if (!availabilityTarget) {
    context.setStatus("No se encontró el item seleccionado.", "danger");
    return;
  }

  await context.adminOperations.clearAvailabilityOverlay(availabilityTarget);
}
