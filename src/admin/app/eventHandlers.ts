import type { createAdminFormState } from "./formState";
import type { createAdminActionHandlers } from "./actionHandlers";
import type { createAdminFormHandlers } from "./formHandlers";

interface AdminEventHandlerContext {
  root: HTMLElement;
  formState: ReturnType<typeof createAdminFormState>;
  actionHandlers: ReturnType<typeof createAdminActionHandlers>;
  formHandlers: ReturnType<typeof createAdminFormHandlers>;
  handleUnexpectedError(error: unknown): void;
}

export function bindAdminEventHandlers(context: AdminEventHandlerContext): void {
  context.root.addEventListener("click", (event) => {
    const passwordToggle = event.target instanceof Element
      ? event.target.closest<HTMLButtonElement>("[data-admin-password-toggle]")
      : null;

    if (passwordToggle && context.root.contains(passwordToggle)) {
      event.preventDefault();
      context.actionHandlers.togglePasswordVisibility(passwordToggle);
      return;
    }

    const target = event.target instanceof Element
      ? event.target.closest<HTMLElement>("[data-admin-action]")
      : null;

    if (!target || !context.root.contains(target)) {
      return;
    }

    event.preventDefault();
    void context.actionHandlers.handleAction(target).catch(context.handleUnexpectedError);
  });

  context.root.addEventListener("submit", (event) => {
    const form = event.target instanceof HTMLFormElement ? event.target : null;

    if (!form) {
      return;
    }

    event.preventDefault();

    if (!context.formState.confirmUnsavedChanges(form)) {
      return;
    }

    void context.formHandlers.handleFormSubmit(form).catch(context.handleUnexpectedError);
  });

  context.root.addEventListener("keydown", (event) => {
    const tab = event.target instanceof HTMLElement
      ? event.target.closest<HTMLButtonElement>('.admin-tab[role="tab"]')
      : null;

    if (!tab || !context.root.contains(tab)) {
      return;
    }

    context.actionHandlers.handleTabKeydown(event, tab);
  });

  context.root.addEventListener("change", (event) => {
    const checkbox = event.target instanceof HTMLInputElement ? event.target : null;

    if (checkbox?.dataset.adminDescriptionToggle !== undefined) {
      context.actionHandlers.toggleCatalogDescriptionField(checkbox);
      return;
    }

    const field = event.target instanceof HTMLSelectElement ? event.target : null;

    if (!field?.dataset.adminFilter) {
      return;
    }

    context.actionHandlers.handleFilterChange(field);
  });

  context.root.addEventListener("input", (event) => {
    context.actionHandlers.handleInput(event.target);
  });
}
