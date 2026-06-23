import { formatCooldownSuffix, resultMessage } from "../core/responses";
import type { AdminOperationContext } from "./types";

export function createPublishOperations(context: AdminOperationContext) {
  return {
    publishChanges(): Promise<void> {
      return context.runBusy(async () => {
        const session = await context.requireSession();
        const result = await context.publishMenuChanges(session);

        if (result.message === "publish_queued") {
          context.markCurrentPublicationRequested();
          context.rememberPublishCooldown(result);
          await context.loadAdminState(
            "Publicación solicitada. El botón vuelve a aparecer si hacés cambios nuevos antes de que termine el deploy.",
            "success",
          );
          return;
        }

        if (result.message === "publish_recently_queued") {
          context.rememberPublishCooldown(result);
          await context.loadAdminState(
            `Ya se pidió una publicación hace poco${formatCooldownSuffix(result)}. Los cambios quedan guardados; volvé a publicar cuando esté disponible.`,
            "neutral",
          );
          return;
        }

        await context.loadAdminState(resultMessage(result), "success");
      }, "Publicando cambios...");
    },
  };
}
