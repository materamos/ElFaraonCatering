const allowedHeaders = "authorization, x-client-info, apikey, content-type";
const allowedMethods = "POST, OPTIONS";

export const parseAllowedOrigins = (rawValue: string | undefined): Set<string> => {
  const origins = new Set<string>();

  for (const value of (rawValue ?? "").split(",")) {
    const origin = value.trim();

    if (origin.length > 0) {
      origins.add(origin);
    }
  }

  return origins;
};

export const isOriginAllowed = (origin: string | null, allowedOrigins: Set<string>): boolean =>
  origin === null || allowedOrigins.has(origin);

export const getCorsHeaders = (
  request: Request,
  allowedOrigins: Set<string>,
): HeadersInit => {
  const origin = request.headers.get("Origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": allowedHeaders,
    "Access-Control-Allow-Methods": allowedMethods,
    "Vary": "Origin",
  };

  if (origin !== null && allowedOrigins.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
};
