export function getFormString(form: HTMLFormElement, name: string): string {
  const value = new FormData(form).get(name);
  return typeof value === "string" ? value.trim() : "";
}

export function getNullableFormString(form: HTMLFormElement, name: string): string | null {
  const value = getFormString(form, name);
  return value.length > 0 ? value : null;
}

export function getFormInteger(form: HTMLFormElement, name: string): number {
  const value = Number(getFormString(form, name));

  if (!Number.isInteger(value) || value < 0) {
    throw new Error("El importe no es válido.");
  }

  return value;
}
