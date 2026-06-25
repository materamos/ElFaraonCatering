import { adminForms } from "../core/contracts";
import { disabledAttr } from "./html";
import { renderPasswordToggle } from "./passwordToggle";

export function renderAccountTab(isBusy: boolean): string {
  return `
    <section class="admin-section">
      <div class="admin-section__header">
        <h2 class="admin-section__title">Cuenta</h2>
        <p class="admin-section__copy">Actualiz&aacute; tu contrase&ntilde;a de acceso al panel.</p>
      </div>
      <form class="admin-form-grid admin-account-password-form" data-admin-form="${adminForms.changePassword}">
        <div class="admin-field admin-field--wide">
          <label class="admin-label" for="admin-account-password">Nueva contrase&ntilde;a</label>
          <span class="admin-password-field">
            <input class="admin-input admin-password-field__input" id="admin-account-password" type="password" name="password" autocomplete="new-password" minlength="8" required />
            ${renderPasswordToggle(isBusy)}
          </span>
          <span class="admin-field__hint">M&iacute;nimo 8 caracteres.</span>
        </div>
        <div class="admin-field admin-field--wide">
          <label class="admin-label" for="admin-account-password-confirmation">Confirmar contrase&ntilde;a</label>
          <span class="admin-password-field">
            <input class="admin-input admin-password-field__input" id="admin-account-password-confirmation" type="password" name="password_confirmation" autocomplete="new-password" minlength="8" required />
            ${renderPasswordToggle(isBusy)}
          </span>
        </div>
        <div class="admin-row__actions admin-account-password-actions">
          <button class="admin-button" type="submit" ${disabledAttr(isBusy)}>Guardar contrase&ntilde;a</button>
        </div>
      </form>
    </section>
  `;
}
