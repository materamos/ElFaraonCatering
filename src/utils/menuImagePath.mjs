const uploadsBasePath = "/uploads/";
const menuPlaceholderBasePath = "/uploads/menu-placeholders/";
const allowedMenuImageExtensions = [".avif", ".jpeg", ".jpg", ".png", ".svg", ".webp"];

export const isSafeMenuImagePath = (value) => {
  if (typeof value !== "string") {
    return false;
  }

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

export const getSafeMenuImagePath = (value) => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();

  if (!isSafeMenuImagePath(trimmedValue) || isMenuPlaceholderImagePath(trimmedValue)) {
    return undefined;
  }

  return trimmedValue;
};

export const getSafeMenuImagePaths = (values) => {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.reduce((safeImagePaths, value) => {
    const safeImagePath =
      typeof value === "string" ? getSafeMenuImagePath(value) : undefined;

    if (safeImagePath && !safeImagePaths.includes(safeImagePath)) {
      safeImagePaths.push(safeImagePath);
    }

    return safeImagePaths;
  }, []);
};

export const isMenuPlaceholderImagePath = (value) => {
  if (typeof value !== "string") {
    return false;
  }

  const trimmedValue = value.trim();

  return isSafeMenuImagePath(trimmedValue) && trimmedValue.startsWith(menuPlaceholderBasePath);
};
