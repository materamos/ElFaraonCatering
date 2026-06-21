import type { AdminActionHandlerContext } from "./actionHandlers";
import { confirmPublishChanges } from "./confirmations";

export async function handlePublishAction(context: AdminActionHandlerContext): Promise<void> {
  const cooldownSecondsRemaining = context.publicationState.getCooldownSecondsRemaining();

  if (cooldownSecondsRemaining > 0) {
    context.setStatus(
      `Ya se pidió una publicación hace poco (${cooldownSecondsRemaining} segundos restantes). Los cambios quedan guardados; volvé a publicar cuando esté disponible.`,
      "neutral",
    );
    return;
  }

  if (!context.formState.confirmUnsavedChanges() || !confirmPublishChanges()) {
    return;
  }

  await context.adminOperations.publishChanges();
}
