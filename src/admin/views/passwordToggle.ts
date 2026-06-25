import { disabledAttr } from "./html";

export function renderPasswordToggle(isBusy: boolean): string {
  return `
    <button class="admin-password-toggle" type="button" data-admin-password-toggle aria-label="Mostrar contrase&ntilde;a" aria-pressed="false" ${disabledAttr(isBusy)}>
      <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
        <path d="M2.2 12s3.6-6 9.8-6 9.8 6 9.8 6-3.6 6-9.8 6-9.8-6-9.8-6Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    </button>
  `;
}
