import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { ROUTES } from "@/lib/constants";

export const dynamic = "force-dynamic";

/**
 * The landing route simply forwards the visitor to their drive.
 */
export default async function HomePage() {
  const user = await getCurrentUser();
  redirect(user ? ROUTES.drive : ROUTES.login);
}
