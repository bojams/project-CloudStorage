"use client";

import { UploadCloud } from "lucide-react";
import { useCallback, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

interface UploadDropzoneProps {
  readonly children: ReactNode;
  readonly onFiles: (files: File[]) => void;
  readonly disabled?: boolean;
}

/**
 * Drag & drop upload surface.
 *
 * The overlay only appears when a real file enters the viewport; the drag
 * counter prevents the classic flicker caused by child elements firing
 * `dragleave` events.
 */
export function UploadDropzone({
  children,
  onFiles,
  disabled = false,
}: UploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragDepth = useRef(0);

  const handleDragEnter = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (disabled) return;
      event.preventDefault();
      dragDepth.current += 1;

      const hasFiles = Array.from(event.dataTransfer.types).includes("Files");
      if (hasFiles) setIsDragging(true);
    },
    [disabled],
  );

  const handleDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (disabled) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    },
    [disabled],
  );

  const handleDragLeave = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (disabled) return;
      event.preventDefault();
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setIsDragging(false);
    },
    [disabled],
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (disabled) return;
      event.preventDefault();
      dragDepth.current = 0;
      setIsDragging(false);

      const files = Array.from(event.dataTransfer.files ?? []);
      if (files.length > 0) onFiles(files);
    },
    [disabled, onFiles],
  );

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative min-h-full"
    >
      {children}

      {isDragging ? (
        <div className="animate-fade-in pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm">
          <div
            className={cn(
              "animate-pop-in flex flex-col items-center gap-4 rounded-3xl border-2 border-dashed border-primary/60 bg-card/90 px-14 py-12 text-center shadow-2xl",
            )}
          >
            <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/12 text-primary">
              <UploadCloud className="size-8" />
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight text-foreground">
                Drop files to upload
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                They will be added to the current folder
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
