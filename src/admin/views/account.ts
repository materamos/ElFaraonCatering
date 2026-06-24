import { adminForms } from "../core/contracts";
import { disabledAttr } from "./html";

export function renderAccountTab(isBusy: boolean): string {
  return `
    <section class="admin-section">
      <div class="admin-section__header">
        <h2 class="admin-section__title">Cuenta</h2>
        <p class="admin-section__copy">Actualiz&aacute; tu contrase&ntilde;a de acceso al panel.</p>
      </div>
      <form class="admin-form-grid admin-account-password-form" data-admin-form="${adminForms.changePassword}">
        <label class="admin-field admin-field--wide">
          <span class="admin-label">Nueva contrase&ntilde;a</span>
          <input class="admin-input" type="password" name="password" autocomplete="new-password" minlength="8" required />
          <span class="admin-field__hint">M&iacute;nimo 8 caracteres.</span>
        </label>
        <label class="admin-field admin-field--wide">
          <span class="admin-label">Confirmar contrase&ntilde;a</span>
          <input class="admin-input" type="password" name="password_confirmation" autocomplete="new-password" minlength="8" required />
        </label>
        <div class="admin-row__actions admin-account-password-actions">
          <button class="admin-button admin-button--secondary" type="button" data-admin-password-toggle aria-pressed="false" ${disabledAttr(isBusy)}>Ver contrase&ntilde;a</button>
        </div>
        <div class="admin-row__actions admin-account-password-actions">
          <button class="admin-button" type="submit" ${disabledAttr(isBusy)}>Guardar contrase&ntilde;a</button>
        </div>
      </form>
    </section>
  `;
}
