import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { TopBar } from "@/components/dashboard/topbar";
import { getCurrentUser } from "@/lib/auth/session";
import { ROUTES } from "@/lib/constants";
import { getStorageUsage } from "@/lib/db/queries/drive";
import { formatPercent } from "@/lib/utils";
import type { SessionUser, StorageUsage } from "@/types";

export const dynamic = "force-dynamic";

/**
 * Authenticated application shell.
 *
 * The layout is a server component: the session is resolved once and the
 * user information is passed down as plain props, which keeps secrets out of
 * the client bundle.
 */
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const usage = await getStorageUsage(user.id);

  const sessionUser: SessionUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    image: null,
    role: user.role,
  };

  const storageUsage: StorageUsage = {
    used: usage.used,
    quota: usage.quota,
    percent: formatPercent(usage.used, usage.quota),
    fileCount: usage.fileCount,
  };

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <AppSidebar user={sessionUser} usage={storageUsage} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar user={sessionUser} usage={storageUsage} />

        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
