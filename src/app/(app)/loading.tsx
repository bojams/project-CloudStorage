import { DriveSkeleton } from "@/components/dashboard/drive-skeleton";

/**
 * Streaming placeholder for the authenticated shell.
 */
export default function AppLoading() {
  return (
    <div className="space-y-5">
      <div className="h-8 w-48 rounded-lg bg-muted/60" />
      <DriveSkeleton />
    </div>
  );
}
