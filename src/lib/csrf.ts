import crypto from "crypto";
import { NextRequest } from "next/server";

export const CSRF_COOKIE_NAME = "csrf_token";
export const CSRF_HEADER_NAME = "x-csrf-token";

export function generateCsrfToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

export function validateCsrf(req: NextRequest | Request): boolean {
  // Safe HTTP methods do not require CSRF checks
  const safeMethods = ["GET", "HEAD", "OPTIONS"];
  if (safeMethods.includes(req.method.toUpperCase())) {
    return true;
  }

  // Check Origin/Referer header against host
  const host = req.headers.get("host") || "";
  const origin = req.headers.get("origin") || "";
  const referer = req.headers.get("referer") || "";

  if (origin) {
    try {
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        return false;
      }
    } catch {
      return false;
    }
  } else if (referer) {
    try {
      const refererHost = new URL(referer).host;
      if (refererHost !== host) {
        return false;
      }
    } catch {
      return false;
    }
  }

  // Token comparison if cookie is present
  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.match(new RegExp(`(?:^|; )${CSRF_COOKIE_NAME}=([^;]*)`));
  const cookieToken = match ? decodeURIComponent(match[1]) : null;

  if (cookieToken) {
    const headerToken = req.headers.get(CSRF_HEADER_NAME);
    if (!headerToken || headerToken !== cookieToken) {
      return false;
    }
  }

  return true;
}
