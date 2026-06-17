import type { StatusMessage } from "./adminTypes";
import { escapeHtml } from "./adminUtils";

export function disabledAttr(disabled: boolean): string {
  return disabled ? "disabled" : "";
}

export function hiddenInput(name: string, value: string): string {
  return `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}" />`;
}

export function renderEmpty(message: string): string {
  return `<p class="admin-empty">${escapeHtml(message)}</p>`;
}

export function renderStatusMessage(
  currentStatus: StatusMessage | null,
  currentBusyText: string | null,
): string {
  const status: StatusMessage | null = currentBusyText
    ? { text: currentBusyText, tone: "neutral" }
    : currentStatus;

  if (!status) {
    return "";
  }

  return `
    <div class="admin-status" data-tone="${status.tone}" data-busy="${currentBusyText ? "true" : "false"}" role="status" aria-live="polite">
      <span>${escapeHtml(status.text)}</span>
    </div>
  `;
}
