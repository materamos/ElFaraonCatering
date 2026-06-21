import type { AdminTabId } from "../core/types";

interface InteractionSnapshot {
  scrollX: number;
  scrollY: number;
  formKind: string;
  fieldName: string;
  formKeys: Record<string, string>;
}

const formKeyNames = [
  "profile_id",
  "section_id",
  "item_id",
  "option_id",
  "family_id",
  "pricing_key",
  "variant_id",
  "fixed_pricing_key",
  "variant_pricing_key",
] as const;

export function createAdminFormState(root: HTMLElement) {
  const formBaselines = new WeakMap<HTMLFormElement, string>();

  function captureInteraction(): InteractionSnapshot {
    const activeElement = document.activeElement;
    const field = activeElement instanceof HTMLInputElement
      || activeElement instanceof HTMLSelectElement
      || activeElement instanceof HTMLTextAreaElement
      ? activeElement
      : null;
    const form = field?.closest<HTMLFormElement>("form");

    return {
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      formKind: form?.dataset.adminForm ?? "",
      fieldName: field?.name ?? "",
      formKeys: form ? getFormKeys(form) : {},
    };
  }

  function restoreInteraction(snapshot: InteractionSnapshot): void {
    window.scrollTo(snapshot.scrollX, snapshot.scrollY);

    if (!snapshot.formKind || !snapshot.fieldName) {
      return;
    }

    const form = findMatchingForm(snapshot);
    const field = form?.elements.namedItem(snapshot.fieldName);

    if (
      field instanceof HTMLInputElement
      || field instanceof HTMLSelectElement
      || field instanceof HTMLTextAreaElement
    ) {
      field.focus({ preventScroll: true });
    }
  }

  function findMatchingForm(snapshot: InteractionSnapshot): HTMLFormElement | null {
    const forms = Array.from(root.querySelectorAll<HTMLFormElement>("form"));

    return forms.find((form) =>
      form.dataset.adminForm === snapshot.formKind
      && formKeysMatch(getFormKeys(form), snapshot.formKeys)
    ) ?? null;
  }

  function formKeysMatch(current: Record<string, string>, expected: Record<string, string>): boolean {
    return Object.entries(expected).every(([key, value]) => current[key] === value);
  }

  function getFormKeys(form: HTMLFormElement): Record<string, string> {
    const keys: Record<string, string> = {};

    formKeyNames.forEach((key) => {
      const value = getFormValue(form, key);

      if (value) {
        keys[key] = value;
      }
    });

    return keys;
  }

  function getFormValue(form: HTMLFormElement, name: string): string {
    const field = form.elements.namedItem(name);

    if (
      field instanceof HTMLInputElement
      || field instanceof HTMLSelectElement
      || field instanceof HTMLTextAreaElement
    ) {
      return field.value;
    }

    return "";
  }

  function syncFormBaselines(): void {
    root.querySelectorAll<HTMLFormElement>("form").forEach((form) => {
      formBaselines.set(form, serializeForm(form));
      delete form.dataset.dirty;
    });
  }

  function syncFilterValues(): void {
    root.querySelectorAll<HTMLSelectElement>("select[data-admin-filter]").forEach((field) => {
      field.dataset.previousValue = field.value;
    });
  }

  function markContainingFormDirty(field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): void {
    const form = field.closest<HTMLFormElement>("form");

    if (!form) {
      return;
    }

    form.dataset.dirty = isDirtyForm(form) ? "true" : "false";
  }

  function isDirtyForm(form: HTMLFormElement): boolean {
    const baseline = formBaselines.get(form);

    if (baseline === undefined) {
      formBaselines.set(form, serializeForm(form));
      return false;
    }

    return serializeForm(form) !== baseline;
  }

  function getDirtyForms(exceptForm?: HTMLFormElement): HTMLFormElement[] {
    return Array.from(root.querySelectorAll<HTMLFormElement>("form"))
      .filter((form) => form !== exceptForm && isDirtyForm(form));
  }

  function confirmUnsavedChanges(exceptForm?: HTMLFormElement): boolean {
    if (getDirtyForms(exceptForm).length === 0) {
      return true;
    }

    return window.confirm(
      "Hay cambios sin guardar en otro formulario. Si continuás, esos cambios se van a perder. ¿Continuar?",
    );
  }

  function serializeForm(form: HTMLFormElement): string {
    return JSON.stringify(
      Array.from(new FormData(form).entries()).map(([key, value]) => [key, String(value)]),
    );
  }

  function focusViewStart(): void {
    const target = root.querySelector<HTMLElement>("[data-admin-initial-focus]")
      ?? root.querySelector<HTMLElement>("[data-admin-view-heading]");

    target?.focus({ preventScroll: true });
  }

  function focusTab(tabId: AdminTabId): void {
    root.querySelector<HTMLElement>(`[data-admin-tab="${tabId}"]`)?.focus({ preventScroll: true });
  }

  function revealStatus(): void {
    root.querySelector<HTMLElement>(".admin-status")?.scrollIntoView({ block: "nearest" });
  }

  return {
    captureInteraction,
    confirmUnsavedChanges,
    focusTab,
    focusViewStart,
    markContainingFormDirty,
    restoreInteraction,
    revealStatus,
    syncFilterValues,
    syncFormBaselines,
  };
}
