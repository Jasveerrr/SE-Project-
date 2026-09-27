const PRIVATE_NETWORK_ORIGIN =
  /^https?:\/\/(localhost|127\.0\.0\.1|10\.(?:\d{1,3}\.){2}\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.(?:\d{1,3}\.)\d{1,3}|192\.168\.(?:\d{1,3}\.)\d{1,3})(?::\d+)?$/;

export function isAllowedClientOrigin(origin, configuredOrigins, allowLanOrigins) {
  if (!origin || configuredOrigins.includes(origin)) return true;
  return allowLanOrigins && PRIVATE_NETWORK_ORIGIN.test(origin);
}

export const corsOptions = {};
