import type { AdminActionHandlerContext } from "./actionHandlers";
import type { AdminOperationalState, AvailabilityTargetState } from "../core/types";
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

  const available = target.dataset.available === "true";
  const currentState = context.getCurrentState();
  const familyTargets = resolveFamilyTargets(context, currentState, target.dataset.familyKey);

  if (familyTargets !== undefined) {
    if (familyTargets.length > 0) {
      await applyFamilyAvailability(context, familyTargets, available);
    }

    return;
  }

  const availabilityTarget = findTargetOrReport(context, currentState, target.dataset.targetKey);

  if (!availabilityTarget || !currentState) {
    return;
  }

  if (availabilityTarget.target_kind === "grill") {
    const grillFamilyTargets = resolveFamilyTargets(
      context,
      currentState,
      getAvailabilityFamilyKey(availabilityTarget),
    );

    if (grillFamilyTargets && grillFamilyTargets.length > 0) {
      await applyFamilyAvailability(context, grillFamilyTargets, available);
    }

    return;
  }

  const cascadeTargets = availabilityTarget.target_kind === "catalog"
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

  const currentState = context.getCurrentState();
  const familyTargets = resolveFamilyTargets(context, currentState, target.dataset.familyKey);

  if (familyTargets !== undefined) {
    if (familyTargets.length > 0) {
      await context.adminOperations.clearAvailabilityOverlayBatch(familyTargets);
    }

    return;
  }

  const availabilityTarget = findTargetOrReport(context, currentState, target.dataset.targetKey);

  if (!availabilityTarget || !currentState) {
    return;
  }

  if (availabilityTarget.target_kind === "grill") {
    const grillFamilyTargets = resolveFamilyTargets(
      context,
      currentState,
      getAvailabilityFamilyKey(availabilityTarget),
    );

    if (grillFamilyTargets && grillFamilyTargets.length > 0) {
      await context.adminOperations.clearAvailabilityOverlayBatch(grillFamilyTargets);
    }

    return;
  }

  await context.adminOperations.clearAvailabilityOverlay(availabilityTarget);
}

// Devuelve undefined cuando no hay familyKey (el flujo sigue por target individual);
// devuelve [] cuando la familia no se encontró y ya se reportó el error.
function resolveFamilyTargets(
  context: AdminActionHandlerContext,
  currentState: AdminOperationalState | null,
  familyKey: string | undefined,
): AvailabilityTargetState[] | undefined {
  if (!familyKey) {
    return undefined;
  }

  const familyTargets = currentState ? findAvailabilityFamilyTargets(currentState, familyKey) : [];

  if (familyTargets.length === 0) {
    context.setStatus("No se encontró la familia seleccionada.", "danger");
    return [];
  }

  return familyTargets;
}

function findTargetOrReport(
  context: AdminActionHandlerContext,
  currentState: AdminOperationalState | null,
  targetKey: string | undefined,
): AvailabilityTargetState | undefined {
  const availabilityTarget = currentState && targetKey
    ? findAvailabilityTarget(currentState, targetKey)
    : undefined;

  if (!availabilityTarget) {
    context.setStatus("No se encontró el item seleccionado.", "danger");
  }

  return availabilityTarget;
}

async function applyFamilyAvailability(
  context: AdminActionHandlerContext,
  familyTargets: AvailabilityTargetState[],
  available: boolean,
): Promise<void> {
  if (available) {
    await context.adminOperations.clearAvailabilityOverlayBatch(familyTargets);
  } else {
    await context.adminOperations.saveAvailabilityOverlayBatch(familyTargets, false);
  }
}
