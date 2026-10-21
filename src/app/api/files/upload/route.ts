import { mkdir, open, rm } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { getEnv } from "@/lib/env";
import { isContentTypeConsistent } from "@/lib/security/magic-bytes";
import { verifyGrantToken } from "@/lib/storage/signing";
import { assertSafeStorageKey } from "@/lib/storage/types";

/**
 * Local storage upload endpoint.
 *
 * The browser receives a signed, short-lived grant from
 * `requestUploadAction` and PUTs the raw bytes here. The grant is tamper
 * evident (HMAC-SHA256) and enforces:
 *
 *  * the target key (path traversal is impossible — the key is validated
 *    against a strict pattern and resolved inside the storage root),
 *  * the expected content type,
 *  * a hard maximum payload size (the body is streamed, never buffered),
 *  * a signature check of the first bytes for formats with a known magic
 *    number, so a renamed executable cannot masquerade as a PNG.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_HEADER_BYTES = 512;

export async function PUT(request: Request): Promise<Response> {
  const env = getEnv();

  if (env.STORAGE_DRIVER !== "local") {
    return NextResponse.json(
      { error: "Direct uploads are not enabled for this storage driver." },
      { status: 404 },
    );
  }

  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing upload grant." }, { status: 401 });
  }

  const secret = env.UPLOAD_SIGNING_SECRET ?? env.AUTH_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Upload signing is not configured." },
      { status: 500 },
    );
  }

  const verification = verifyGrantToken(token, secret);
  if (!verification.ok) {
    const status = verification.reason === "expired" ? 410 : 403;
    return NextResponse.json(
      { error: "The upload grant is invalid or has expired." },
      { status },
    );
  }

  const { k: key, ct: expectedType, ms: maxSize } = verification.payload;

  try {
    assertSafeStorageKey(key);
  } catch {
    return NextResponse.json({ error: "Invalid storage key." }, { status: 400 });
  }

  const contentType = (request.headers.get("content-type") ?? "")
    .split(";")[0]
    ?.trim()
    .toLowerCase();

  if (contentType && expectedType && contentType !== expectedType) {
    return NextResponse.json(
      { error: "Content type does not match the upload grant." },
      { status: 415 },
    );
  }

  if (!request.body) {
    return NextResponse.json({ error: "Empty request body." }, { status: 400 });
  }

  const root = path.resolve(process.cwd(), env.STORAGE_LOCAL_PATH);
  const target = path.resolve(root, key);

  if (!target.startsWith(root.endsWith(path.sep) ? root : `${root}${path.sep}`)) {
    return NextResponse.json({ error: "Invalid storage key." }, { status: 400 });
  }

  await mkdir(path.dirname(target), { recursive: true });

  const reader = request.body.getReader();
  const headerChunks: Buffer[] = [];
  let headerLength = 0;
  let total = 0;

  const handle = await open(target, "w");

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      total += value.byteLength;
      if (total > maxSize) {
        throw new Error("PAYLOAD_TOO_LARGE");
      }

      if (headerLength < MAX_HEADER_BYTES) {
        const slice = value.subarray(0, MAX_HEADER_BYTES - headerLength);
        headerChunks.push(Buffer.from(slice));
        headerLength += slice.byteLength;
      }

      await handle.write(value);
    }
  } catch (error) {
    await handle.close().catch(() => undefined);
    await rm(target, { force: true }).catch(() => undefined);

    if (error instanceof Error && error.message === "PAYLOAD_TOO_LARGE") {
      return NextResponse.json(
        { error: "The uploaded file exceeds the allowed size." },
        { status: 413 },
      );
    }
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }

  await handle.close();

  const header = Buffer.concat(headerChunks, headerLength);

  if (!isContentTypeConsistent(expectedType, header)) {
    await rm(target, { force: true }).catch(() => undefined);
    return NextResponse.json(
      { error: "The file content does not match its declared type." },
      { status: 415 },
    );
  }

  return NextResponse.json({ ok: true, size: total }, { status: 201 });
}
