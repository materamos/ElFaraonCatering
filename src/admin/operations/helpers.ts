import type { AdminOperationalState, RpcResult } from "../core/types";

export function publicationStatus(
  changed: boolean,
  pendingMessage: string,
  cleanMessage: string,
): (state: AdminOperationalState) => string {
  return (state) => {
    if (!changed) {
      return "Sin cambios.";
    }

    return state.publication.has_unpublished_changes ? pendingMessage : cleanMessage;
  };
}

export function partialMutationError(error: unknown, results: RpcResult[]): Error {
  const message = error instanceof Error ? error.message : "No se pudo completar la operación.";

  if (!results.some((result) => result.ok)) {
    return new Error(message);
  }

  return new Error(
    `Algunos cambios pueden haberse guardado, pero la operación no terminó completa. Revisá el item antes de volver a intentar. Detalle: ${message}`,
  );
}
