import { adminForms } from "./adminContracts";
import { disabledAttr } from "./adminHtml";

export function renderAccountTab(isBusy: boolean): string {
  return `
    <section class="admin-section">
      <div class="admin-section__header">
        <h2 class="admin-section__title">Cuenta</h2>
        <p class="admin-section__copy">Actualizá tu contraseña de acceso al panel.</p>
      </div>
      <form class="admin-form-grid" data-admin-form="${adminForms.changePassword}">
        <label class="admin-field">
          <span class="admin-label">Nueva contraseña</span>
          <input class="admin-input" type="password" name="password" autocomplete="new-password" minlength="8" required />
        </label>
        <label class="admin-field">
          <span class="admin-label">Confirmar contraseña</span>
          <input class="admin-input" type="password" name="password_confirmation" autocomplete="new-password" minlength="8" required />
        </label>
        <div class="admin-row__actions">
          <button class="admin-button" type="submit" ${disabledAttr(isBusy)}>Guardar contraseña</button>
        </div>
      </form>
    </section>
  `;
}
