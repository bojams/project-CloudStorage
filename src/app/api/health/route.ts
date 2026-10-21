import { NextResponse } from "next/server";

/**
 * Lightweight liveness/readiness probe.
 * It intentionally does not touch the database so it can be used by
 * orchestrators without creating load on the database.
 */
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return NextResponse.json({
    status: "ok",
    service: "nimbus-drive",
    timestamp: new Date().toISOString(),
  });
}
