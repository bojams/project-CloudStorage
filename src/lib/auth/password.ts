import "server-only";

import { compare, hash } from "bcryptjs";

/**
 * Password hashing (OWASP A02 — Cryptographic Failures).
 *
 * bcrypt with a cost factor of 12 (≈250 ms on modern hardware) is used.
 * Passwords are never logged, stored in plain text, or returned to the client.
 */
const BCRYPT_COST = 12;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, BCRYPT_COST);
}

export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  try {
    return await compare(password, passwordHash);
  } catch {
    return false;
  }
}
