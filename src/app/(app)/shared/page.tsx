import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DriveShell } from "@/components/dashboard/drive-shell";
import { getCurrentUser } from "@/lib/auth/session";
import { ROUTES } from "@/lib/constants";
import { listSharedWithMe } from "@/lib/db/queries/drive";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shared with me",
};

interface SharedPageProps {
  readonly searchParams: Promise<{ q?: string }>;
}

export default async function SharedPage({ searchParams }: SharedPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect(ROUTES.login);

  const { q } = await searchParams;
  const items = await listSharedWithMe(user.id);

  const query = q?.trim().toLowerCase() ?? "";
  const filtered = query
    ? items.filter((item) => item.name.toLowerCase().includes(query))
    : items;

  return (
    <DriveShell
      items={filtered}
      breadcrumbs={[]}
      currentFolderId={null}
      canUpload={false}
      emptyTitle={query ? "No matching shared files" : "Nothing shared with you yet"}
      emptyDescription={
        query
          ? "Try a different search term."
          : "Files and folders other people share with you will appear here."
      }
    />
  );
}
