import { z } from "astro/zod";

const uploadsBasePath = "/uploads/";
const allowedMenuImageExtensions = [".avif", ".jpeg", ".jpg", ".png", ".webp"] as const;

export const isSafeMenuImagePath = (value: string): boolean => {
  const trimmedValue = value.trim();

  if (
    !trimmedValue.startsWith(uploadsBasePath) ||
    trimmedValue.startsWith("//") ||
    trimmedValue.includes("\\") ||
    trimmedValue.includes("?") ||
    trimmedValue.includes("#")
  ) {
    return false;
  }

  const relativePath = trimmedValue.slice(uploadsBasePath.length);

  if (!relativePath) {
    return false;
  }

  const pathSegments = relativePath.split("/");

  if (
    pathSegments.some(
      (segment) => segment.length === 0 || segment === "." || segment === "..",
    )
  ) {
    return false;
  }

  const lowerCasePath = trimmedValue.toLowerCase();

  return allowedMenuImageExtensions.some((extension) => lowerCasePath.endsWith(extension));
};

export const getSafeMenuImagePath = (value?: string): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();

  return isSafeMenuImagePath(trimmedValue) ? trimmedValue : undefined;
};

export const menuImageSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmedValue = value.trim();

    return trimmedValue === "" ? undefined : trimmedValue;
  },
  z
    .string()
    .refine(isSafeMenuImagePath, {
      message: "Menu images must be local files under /uploads.",
    })
    .optional(),
);
