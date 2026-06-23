export function getTrimmedValue(value: string | undefined): string | undefined {
  const trimmedValue = value?.trim();
  return trimmedValue && trimmedValue.length > 0 ? trimmedValue : undefined;
}

export function trimTrailingSlash(value: string | undefined): string | undefined {
  return getTrimmedValue(value)?.replace(/\/+$/, "");
}

export function normalizeSupabaseProjectUrl(value: string | undefined): string | undefined {
  return trimTrailingSlash(value)?.replace(/\/(?:rest\/v1|auth\/v1|functions\/v1)$/, "");
}
