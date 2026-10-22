import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DriveShell } from "@/components/dashboard/drive-shell";
import { getCurrentUser } from "@/lib/auth/session";
import { ROUTES } from "@/lib/constants";
import { listTrash } from "@/lib/db/queries/drive";
import { purgeExpiredTrash } from "@/lib/trash/retention";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Trash",
};

interface TrashPageProps {
  readonly searchParams: Promise<{ q?: string }>;
}

export default async function TrashPage({ searchParams }: TrashPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect(ROUTES.login);

  const { q } = await searchParams;

  // Items that outlived the retention period of the plan are removed
  // together with their objects before the trash is rendered.
  await purgeExpiredTrash(user.id);

  const items = await listTrash(user.id);

  const query = q?.trim().toLowerCase() ?? "";
  const filtered = query
    ? items.filter((item) => item.name.toLowerCase().includes(query))
    : items;

  return (
    <DriveShell
      items={filtered}
      breadcrumbs={[]}
      currentFolderId={null}
      mode="trash"
      canUpload={false}
      emptyTitle={query ? "No matching items" : "Trash is empty"}
      emptyDescription={
        query
          ? "Try a different search term."
          : "Deleted items stay here until you empty the trash."
      }
    />
  );
}
