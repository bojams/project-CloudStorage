import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DriveShell } from "@/components/dashboard/drive-shell";
import { getCurrentUser } from "@/lib/auth/session";
import { ROUTES } from "@/lib/constants";
import { listRecentFiles } from "@/lib/db/queries/drive";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Recent",
};

interface RecentPageProps {
  readonly searchParams: Promise<{ q?: string }>;
}

export default async function RecentPage({ searchParams }: RecentPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect(ROUTES.login);

  const { q } = await searchParams;
  const items = await listRecentFiles(user.id);

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
      emptyTitle={query ? "No matching files" : "No recent activity"}
      emptyDescription={
        query
          ? "Try a different search term."
          : "The files you work on most often are listed here."
      }
    />
  );
}
