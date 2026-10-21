import { NextResponse } from "next/server";

import { DOWNLOAD_GRANT_TTL } from "@/lib/constants";
import { getPublicSharedFile } from "@/lib/db/queries/shares";
import { getStorageDriver } from "@/lib/storage";

/**
 * Public download endpoint for shared files.
 *
 * The file id is never exposed: the caller only knows the random share
 * token, and the token is validated (expiry, trashed state, upload status)
 * before any byte is served.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ token: string }>;
}

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const { token } = await context.params;

  const file = await getPublicSharedFile(token);

  if (!file) {
    return NextResponse.json({ error: "Link unavailable" }, { status: 404 });
  }

  const driver = getStorageDriver();
  const isInline = new URL(request.url).searchParams.get("disposition") === "inline";
  const encodedName = encodeURIComponent(file.name);

  const downloadUrl = await driver.createDownloadUrl({
    key: file.storageKey,
    fileName: file.name,
    expiresInSeconds: DOWNLOAD_GRANT_TTL,
  });

  if (downloadUrl) {
    return NextResponse.redirect(downloadUrl);
  }

  const buffer = await driver.readObject(file.storageKey);
  if (!buffer) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(buffer.byteLength),
      "Content-Disposition": `${isInline ? "inline" : "attachment"}; filename*=UTF-8''${encodedName}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
