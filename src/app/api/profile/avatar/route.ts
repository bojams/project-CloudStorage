import { NextResponse } from "next/server";

import { removeAvatar, storeAvatar } from "@/lib/account/avatar";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { FILE_RESPONSE_HEADERS } from "@/lib/http/headers";
import { MAX_AVATAR_SIZE } from "@/lib/avatar";
import { detectMimeType } from "@/lib/security/magic-bytes";
import { normalizeMimeType } from "@/lib/security/mime";
import { getStorageDriver } from "@/lib/storage";

/**
 * Profile photo endpoint.
 *
 * The photo is a small object that never leaves the application server: it is
 * uploaded as multipart form data, verified (declared type, real magic bytes
 * and size) and stored under a dedicated `a/<userId>/<avatarId>` namespace.
 *
 * The bytes are served back through the same authenticated endpoint, so a
 * photo is never publicly reachable — even the URL is not guessable enough
 * to matter, because the session cookie is required.
 */

const ALLOWED_AVATAR_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_AVATAR_SIZE + 64 * 1024) {
    return NextResponse.json(
      { error: "The photo is too large." },
      { status: 413 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "The request could not be read." },
      { status: 400 },
    );
  }

  const entry = form.get("file");
  if (!(entry instanceof File)) {
    return NextResponse.json(
      { error: "No photo was provided." },
      { status: 400 },
    );
  }

  if (entry.size <= 0) {
    return NextResponse.json({ error: "The photo is empty." }, { status: 400 });
  }

  if (entry.size > MAX_AVATAR_SIZE) {
    return NextResponse.json(
      { error: "The photo is too large (4 MB maximum)." },
      { status: 413 },
    );
  }

  const declaredType = normalizeMimeType(entry.type);
  if (!ALLOWED_AVATAR_TYPES.has(declaredType)) {
    return NextResponse.json(
      { error: "Only JPG, PNG, WebP, GIF and AVIF photos are supported." },
      { status: 415 },
    );
  }

  const bytes = Buffer.from(await entry.arrayBuffer());

  if (bytes.byteLength > MAX_AVATAR_SIZE) {
    return NextResponse.json(
      { error: "The photo is too large (4 MB maximum)." },
      { status: 413 },
    );
  }

  // The browser supplied type is untrusted: the real signature decides.
  const sniffed = detectMimeType(bytes);
  if (sniffed !== declaredType) {
    return NextResponse.json(
      { error: "The file content does not match the declared image type." },
      { status: 415 },
    );
  }

  try {
    const url = await storeAvatar(user.id, bytes, declaredType);
    return NextResponse.json({ ok: true, url, mimeType: declaredType });
  } catch {
    return NextResponse.json(
      { error: "The photo could not be stored." },
      { status: 500 },
    );
  }
}

export async function GET(): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { imageKey: true, imageMimeType: true },
  });

  if (!account?.imageKey) {
    return NextResponse.json({ error: "No photo" }, { status: 404 });
  }

  const driver = getStorageDriver();
  const bytes = await driver.readObject(account.imageKey);
  if (!bytes) {
    return NextResponse.json({ error: "No photo" }, { status: 404 });
  }

  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      ...FILE_RESPONSE_HEADERS,
      "Content-Type": account.imageMimeType ?? "application/octet-stream",
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": "inline; filename=\"avatar\"",
      "Cache-Control": "private, max-age=300",
    },
  });
}

export async function DELETE(): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await removeAvatar(user.id);

  return NextResponse.json({ ok: true });
}
