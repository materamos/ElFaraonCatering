import { adminActions, adminForms } from "../core/contracts";
import { disabledAttr } from "./html";
import type { StatusMessage } from "../core/types";
import { escapeHtml } from "../core/format";
import { renderStatusMessage } from "./html";
import { renderPasswordToggle } from "./passwordToggle";

interface AuthViewInput {
  isBusy: boolean;
  currentStatus: StatusMessage | null;
  currentBusyText: string | null;
}

export function renderConfigurationErrorHtml(): string {
  return `
    <section class="admin-denied">
      <p class="admin-kicker">Panel operativo</p>
      <h1 class="admin-title" tabindex="-1" data-admin-view-heading>Configuración incompleta</h1>
      <div class="admin-denied__panel">
        <p class="admin-muted">Falta configurar el acceso público necesario para cargar el panel. Avisale a quien administra el sitio.</p>
      </div>
    </section>
  `;
}

export function renderLoginView(input: AuthViewInput): string {
  return `
    <section class="admin-login" aria-busy="${input.isBusy ? "true" : "false"}">
      <div>
        <p class="admin-kicker">Panel operativo</p>
        <h1 class="admin-title" tabindex="-1" data-admin-view-heading>Ingresar</h1>
      </div>
      ${renderStatusMessage(input.currentStatus, input.currentBusyText)}
      <form class="admin-login__form" data-admin-form="${adminForms.login}">
        <label class="admin-field">
          <span class="admin-label">Email</span>
          <input class="admin-input" type="email" name="email" autocomplete="email" required data-admin-initial-focus />
        </label>
        <label class="admin-field">
          <span class="admin-label">Contraseña</span>
          <span class="admin-password-field">
            <input class="admin-input admin-password-field__input" type="password" name="password" autocomplete="current-password" required />
            ${renderPasswordToggle(input.isBusy)}
          </span>
        </label>
        <button class="admin-button" type="submit" ${disabledAttr(input.isBusy)}>Iniciar sesión</button>
        <button class="admin-link-button" type="button" data-admin-action="${adminActions.showResetRequest}" ${disabledAttr(input.isBusy)}>Olvidé mi contraseña</button>
      </form>
    </section>
  `;
}

export function renderPasswordResetRequestView(input: AuthViewInput): string {
  return `
    <section class="admin-login" aria-busy="${input.isBusy ? "true" : "false"}">
      <div>
        <p class="admin-kicker">Panel operativo</p>
        <h1 class="admin-title" tabindex="-1" data-admin-view-heading>Recuperar acceso</h1>
        <p class="admin-muted">Te vamos a enviar un link para definir una nueva contraseña.</p>
      </div>
      ${renderStatusMessage(input.currentStatus, input.currentBusyText)}
      <form class="admin-login__form" data-admin-form="${adminForms.passwordResetRequest}">
        <label class="admin-field">
          <span class="admin-label">Email</span>
          <input class="admin-input" type="email" name="email" autocomplete="email" required data-admin-initial-focus />
        </label>
        <button class="admin-button" type="submit" ${disabledAttr(input.isBusy)}>Enviar link</button>
        <button class="admin-link-button" type="button" data-admin-action="${adminActions.showLogin}" ${disabledAttr(input.isBusy)}>Volver al ingreso</button>
      </form>
    </section>
  `;
}

export function renderSetPasswordView(input: AuthViewInput): string {
  return `
    <section class="admin-login" aria-busy="${input.isBusy ? "true" : "false"}">
      <div>
        <p class="admin-kicker">Panel operativo</p>
        <h1 class="admin-title" tabindex="-1" data-admin-view-heading>Nueva contraseña</h1>
      </div>
      ${renderStatusMessage(input.currentStatus, input.currentBusyText)}
      <form class="admin-login__form" data-admin-form="${adminForms.setPassword}">
        <label class="admin-field">
          <span class="admin-label">Nueva contraseña</span>
          <input class="admin-input" type="password" name="password" autocomplete="new-password" minlength="8" required data-admin-initial-focus />
        </label>
        <label class="admin-field">
          <span class="admin-label">Confirmar contraseña</span>
          <input class="admin-input" type="password" name="password_confirmation" autocomplete="new-password" minlength="8" required />
        </label>
        <button class="admin-button" type="submit" ${disabledAttr(input.isBusy)}>Guardar contraseña</button>
      </form>
    </section>
  `;
}

export function renderDeniedView(input: AuthViewInput & { message: string }): string {
  return `
    <section class="admin-denied" aria-busy="${input.isBusy ? "true" : "false"}">
      <p class="admin-kicker">Panel operativo</p>
      <h1 class="admin-title" tabindex="-1" data-admin-view-heading>Sin acceso</h1>
      ${renderStatusMessage(input.currentStatus, input.currentBusyText)}
      <div class="admin-denied__panel">
        <p class="admin-muted">${escapeHtml(input.message)}</p>
        <div class="admin-row__actions">
          <button class="admin-button admin-button--secondary" type="button" data-admin-action="${adminActions.retryAdminState}" ${disabledAttr(input.isBusy)}>Reintentar</button>
          <button class="admin-button" type="button" data-admin-action="${adminActions.logout}" ${disabledAttr(input.isBusy)}>Salir</button>
        </div>
      </div>
    </section>
  `;
}
