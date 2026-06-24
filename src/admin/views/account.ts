import { adminForms } from "../core/contracts";
import { escapeHtml, roleLabel } from "../core/format";
import type { AdminOperationalState } from "../core/types";
import { disabledAttr } from "./html";

export function renderAccountTab(state: AdminOperationalState, isBusy: boolean): string {
  return `
    <section class="admin-section">
      <div class="admin-section__header">
        <h2 class="admin-section__title">Cuenta</h2>
        <p class="admin-section__copy">Revis&aacute; tu acceso al panel y actualiz&aacute; tu contrase&ntilde;a.</p>
      </div>
      <div class="admin-account-grid">
        <article class="admin-card">
          <h3 class="admin-card__legend">Tu acceso</h3>
          <dl class="admin-account-list">
            <div>
              <dt>Nombre</dt>
              <dd>${escapeHtml(state.staff?.display_name ?? "Sin nombre")}</dd>
            </div>
            <div>
              <dt>Rol</dt>
              <dd>${escapeHtml(roleLabel(state.staff?.role ?? "operator"))}</dd>
            </div>
            <div>
              <dt>Estado</dt>
              <dd>${state.staff?.active ? "Activo" : "Inactivo"}</dd>
            </div>
          </dl>
        </article>
        <article class="admin-card">
          <h3 class="admin-card__legend">Permisos</h3>
          <ul class="admin-account-permissions">
            ${renderPermission("Editar disponibilidad", state.permissions.can_edit_availability)}
            ${renderPermission("Editar contenido del men&uacute;", state.permissions.can_edit_menu_content)}
            ${renderPermission("Publicar cambios", state.permissions.can_publish_menu)}
            ${renderPermission("Administrar usuarios", state.permissions.can_manage_staff)}
          </ul>
        </article>
        <article class="admin-card admin-account-card--wide">
          <h3 class="admin-card__legend">Publicaci&oacute;n</h3>
          <p class="admin-muted">${renderPublicationStatus(state)}</p>
        </article>
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
          <button class="admin-button" type="submit" ${disabledAttr(isBusy)}>Guardar contrase&ntilde;a</button>
        </div>
      </form>
    </section>
  `;
}

function renderPermission(labelHtml: string, allowed: boolean): string {
  return `
    <li>
      <span>${labelHtml}</span>
      <strong>${allowed ? "Permitido" : "No permitido"}</strong>
    </li>
  `;
}

function renderPublicationStatus(state: AdminOperationalState): string {
  if (!state.permissions.can_publish_menu) {
    return "Tu usuario no puede publicar cambios.";
  }

  if (state.publication.publish_requested) {
    return "Hay una publicaci&oacute;n solicitada. El aviso desaparece cuando el deploy nuevo quede activo.";
  }

  if (state.publication.has_unpublished_changes) {
    return "Hay cambios guardados pendientes de publicar.";
  }

  return "No hay cambios pendientes de publicar.";
}
