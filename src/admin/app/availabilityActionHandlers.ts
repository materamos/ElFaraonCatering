import type { AdminActionHandlerContext } from "./actionHandlers";
import {
  buildCatalogAvailabilityCascade,
  findAvailabilityFamilyTargets,
  findAvailabilityTarget,
  getAvailabilityFamilyKey,
} from "../core/selectors";

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
  const currentState = context.getCurrentState();

  if (familyKey) {
    const familyTargets = currentState ? findAvailabilityFamilyTargets(currentState, familyKey) : [];

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

  const availabilityTarget = currentState && targetKey
    ? findAvailabilityTarget(currentState, targetKey)
    : undefined;

  if (!availabilityTarget || !currentState) {
    context.setStatus("No se encontró el item seleccionado.", "danger");
    return;
  }

  if (availabilityTarget.target_kind === "grill") {
    const familyTargets = findAvailabilityFamilyTargets(
      currentState,
      getAvailabilityFamilyKey(availabilityTarget),
    );

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

  const cascadeTargets = availabilityTarget.target_kind === "catalog" && currentState
    ? buildCatalogAvailabilityCascade(currentState, availabilityTarget, available)
    : [availabilityTarget];

  if (available) {
    if (cascadeTargets.length > 1) {
      await context.adminOperations.clearAvailabilityOverlayBatch(cascadeTargets);
    } else {
      await context.adminOperations.clearAvailabilityOverlay(availabilityTarget);
    }
  } else if (cascadeTargets.length > 1) {
    await context.adminOperations.saveAvailabilityOverlayBatch(cascadeTargets, false);
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
  const currentState = context.getCurrentState();

  if (familyKey) {
    const familyTargets = currentState ? findAvailabilityFamilyTargets(currentState, familyKey) : [];

    if (familyTargets.length === 0) {
      context.setStatus("No se encontró la familia seleccionada.", "danger");
      return;
    }

    await context.adminOperations.clearAvailabilityOverlayBatch(familyTargets);
    return;
  }

  const availabilityTarget = currentState && targetKey
    ? findAvailabilityTarget(currentState, targetKey)
    : undefined;

  if (!availabilityTarget || !currentState) {
    context.setStatus("No se encontró el item seleccionado.", "danger");
    return;
  }

  if (availabilityTarget.target_kind === "grill") {
    const familyTargets = findAvailabilityFamilyTargets(
      currentState,
      getAvailabilityFamilyKey(availabilityTarget),
    );

    if (familyTargets.length === 0) {
      context.setStatus("No se encontró la familia seleccionada.", "danger");
      return;
    }

    await context.adminOperations.clearAvailabilityOverlayBatch(familyTargets);
    return;
  }

  await context.adminOperations.clearAvailabilityOverlay(availabilityTarget);
}
