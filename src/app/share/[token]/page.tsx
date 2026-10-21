import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicShareView } from "@/components/share/public-share-view";
import { getPublicShare } from "@/lib/db/queries/shares";
import { formatBytes, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface SharePageProps {
  readonly params: Promise<{ token: string }>;
}

export async function generateMetadata({
  params,
}: SharePageProps): Promise<Metadata> {
  const { token } = await params;
  const share = await getPublicShare(token);

  if (!share) {
    return { title: "Link unavailable" };
  }

  return {
    title: share.name,
    description: `${share.kind === "file" ? "File" : "Folder"} shared with you via Nimbus Drive`,
    robots: { index: false, follow: false },
  };
}

export default async function PublicSharePage({ params }: SharePageProps) {
  const { token } = await params;
  const share = await getPublicShare(token);

  if (!share) notFound();

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div className="pointer-events-none absolute inset-0 surface-grid opacity-60" />
      <div className="pointer-events-none absolute -right-32 -top-32 size-[26rem] rounded-full bg-primary/15 blur-3xl" />

      <main className="relative z-10 mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-center px-4 py-12">
        <PublicShareView
          share={{
            ...share,
            expiresAt: share.expiresAt?.toISOString() ?? null,
            createdAt: share.createdAt.toISOString(),
          }}
        />

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Shared by {share.ownerName} ·{" "}
          {share.expiresAt
            ? `Expires ${formatDateTime(share.expiresAt)}`
            : "No expiry date"}
          {share.kind === "file" ? ` · ${formatBytes(share.size)}` : ""}
        </p>
      </main>
    </div>
  );
}
