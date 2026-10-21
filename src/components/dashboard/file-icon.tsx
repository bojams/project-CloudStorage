import {
  Archive,
  AudioLines,
  Braces,
  FileText,
  Film,
  Folder,
  Image as ImageIcon,
  Music,
  Presentation,
  Sheet,
  type LucideIcon,
} from "lucide-react";

import { getFileCategory, type FileCategory } from "@/lib/security/mime";
import { cn } from "@/lib/utils";

interface CategoryStyle {
  readonly icon: LucideIcon;
  readonly container: string;
}

const CATEGORY_STYLES: Record<FileCategory, CategoryStyle> = {
  image: {
    icon: ImageIcon,
    container:
      "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
  },
  video: {
    icon: Film,
    container: "bg-rose-500/12 text-rose-600 dark:text-rose-400",
  },
  audio: {
    icon: Music,
    container: "bg-amber-500/12 text-amber-600 dark:text-amber-400",
  },
  pdf: {
    icon: FileText,
    container: "bg-red-500/12 text-red-600 dark:text-red-400",
  },
  document: {
    icon: FileText,
    container: "bg-blue-500/12 text-blue-600 dark:text-blue-400",
  },
  spreadsheet: {
    icon: Sheet,
    container: "bg-green-500/12 text-green-600 dark:text-green-400",
  },
  presentation: {
    icon: Presentation,
    container: "bg-orange-500/12 text-orange-600 dark:text-orange-400",
  },
  archive: {
    icon: Archive,
    container: "bg-violet-500/12 text-violet-600 dark:text-violet-400",
  },
  text: {
    icon: FileText,
    container: "bg-slate-500/12 text-slate-600 dark:text-slate-300",
  },
  code: {
    icon: Braces,
    container: "bg-cyan-500/12 text-cyan-600 dark:text-cyan-400",
  },
  file: {
    icon: FileText,
    container: "bg-slate-500/12 text-slate-600 dark:text-slate-300",
  },
};

interface FileIconProps {
  readonly mimeType?: string | null;
  readonly name?: string;
  readonly isFolder?: boolean;
  readonly className?: string;
  readonly iconClassName?: string;
}

/**
 * Renders a friendly, colour-coded icon for a file or folder.
 */
export function FileIcon({
  mimeType,
  isFolder = false,
  className,
  iconClassName,
}: FileIconProps) {
  if (isFolder) {
    return (
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary",
          className,
        )}
      >
        <Folder className={cn("size-5", iconClassName)} />
      </span>
    );
  }

  const category = getFileCategory(mimeType ?? "");
  const style = CATEGORY_STYLES[category] ?? CATEGORY_STYLES.file;

  const Icon = style.icon;

  return (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-xl",
        style.container,
        className,
      )}
    >
      <Icon className={cn("size-5", iconClassName)} />
    </span>
  );
}

export { AudioLines };
