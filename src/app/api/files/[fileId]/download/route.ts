import { FileStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { DOWNLOAD_GRANT_TTL } from "@/lib/constants";
import { getStorageDriver } from "@/lib/storage";

/**
 * Authenticated download endpoint.
 *
 * S3 deployments are redirected to a short-lived presigned URL so the file
 * bytes never pass through the application server. The local driver streams
 * the file directly.
 *
 * Authorization is performed against the database — the file id alone is
 * never sufficient to read a file.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ fileId: string }>;
}

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { fileId } = await context.params;

  const file = await prisma.file.findFirst({
    where: {
      id: fileId,
      status: FileStatus.READY,
      isTrashed: false,
      OR: [{ ownerId: user.id }, { shares: { some: { ownerId: user.id } } }],
    },
    select: {
      id: true,
      name: true,
      mimeType: true,
      storageKey: true,
    },
  });

  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const driver = getStorageDriver();
  const disposition = new URL(request.url).searchParams.get("disposition");

  const isInline = disposition === "inline";
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
