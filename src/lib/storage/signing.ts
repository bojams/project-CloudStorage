import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * HMAC-signed, short-lived grants.
 *
 * The local storage driver has no native "presigned URL" support, so the same
 * flow is emulated: the client receives a signed URL that carries the target
 * key, the expected content type and a maximum size. The token is tamper
 * evident and expires quickly, which prevents both forged uploads and
 * replayed links.
 */

export interface GrantPayload {
  /** Storage key. */
  readonly k: string;
  /** Expected content type. */
  readonly ct: string;
  /** Maximum accepted payload size in bytes. */
  readonly ms: number;
  /** Expiry (epoch ms). */
  readonly exp: number;
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createGrantToken(
  payload: GrantPayload,
  secret: string,
): string {
  const body = base64UrlEncode(JSON.stringify(payload));
  return `${body}.${sign(body, secret)}`;
}

export type GrantVerification =
  | { ok: true; payload: GrantPayload }
  | { ok: false; reason: "malformed" | "signature" | "expired" };

export function verifyGrantToken(
  token: string,
  secret: string,
  now = Date.now(),
): GrantVerification {
  const [body, signature] = token.split(".");
  if (!body || !signature) return { ok: false, reason: "malformed" };

  const expected = sign(body, secret);
  const expectedBuffer = Buffer.from(expected, "utf8");
  const signatureBuffer = Buffer.from(signature, "utf8");

  if (
    expectedBuffer.length !== signatureBuffer.length ||
    !timingSafeEqual(expectedBuffer, signatureBuffer)
  ) {
    return { ok: false, reason: "signature" };
  }

  try {
    const payload = JSON.parse(base64UrlDecode(body)) as GrantPayload;

    if (
      typeof payload.k !== "string" ||
      typeof payload.ct !== "string" ||
      typeof payload.ms !== "number" ||
      typeof payload.exp !== "number"
    ) {
      return { ok: false, reason: "malformed" };
    }

    if (payload.exp <= now) return { ok: false, reason: "expired" };

    return { ok: true, payload };
  } catch {
    return { ok: false, reason: "malformed" };
  }
}
