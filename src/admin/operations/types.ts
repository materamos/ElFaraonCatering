import type {
  AdminOperationalState,
  AuthSession,
  RpcResult,
  StatusTone,
} from "../core/types";

export interface AdminOperationContext {
  runBusy(action: () => Promise<void>, busyText?: string): Promise<void>;
  callMutation(name: string, body: Record<string, unknown>): Promise<RpcResult>;
  loadAdminState(
    statusText?: string | ((state: AdminOperationalState) => string),
    statusTone?: StatusTone,
  ): Promise<AdminOperationalState>;
  requireSession(): Promise<AuthSession>;
  publishMenuChanges(session: AuthSession): Promise<RpcResult>;
  markCurrentPublicationRequested(): void;
  rememberPublishCooldown(result: RpcResult): void;
}
