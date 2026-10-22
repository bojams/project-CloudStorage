"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import {
  abortUploadAction,
  completeUploadAction,
  requestUploadAction,
} from "@/lib/actions/uploads";
import { MAX_UPLOAD_SIZE } from "@/lib/constants";
import { uploadWithProgress } from "@/lib/client/upload";
import { inferMimeTypeFromName, isAllowedMimeType } from "@/lib/security/mime";
import type { UploadStatus, UploadTask } from "@/types";

/**
 * Upload queue.
 *
 * Each file is uploaded with its own `XMLHttpRequest` so the browser reports
 * genuine progress. At most three uploads run in parallel, which keeps the
 * connection pool healthy while still feeling fast.
 */

const MAX_CONCURRENT_UPLOADS = 3;

export interface UploadManager {
  readonly tasks: UploadTask[];
  readonly isUploading: boolean;
  readonly addFiles: (files: File[] | FileList, folderId: string | null) => void;
  readonly cancel: (taskId: string) => void;
  readonly dismiss: (taskId: string) => void;
  readonly clearFinished: () => void;
}

interface InternalTask {
  readonly id: string;
  readonly fileName: string;
  readonly size: number;
  readonly mimeType: string;
  readonly progress: number;
  readonly status: UploadStatus;
  readonly error: string | null;
  readonly fileId: string | null;
  readonly file: File | null;
  readonly folderId: string | null;
}

export function useUploadManager(
  onCompleted?: () => void,
  maxFileSizeBytes: number = MAX_UPLOAD_SIZE,
): UploadManager {
  const router = useRouter();
  const [tasks, setTasks] = useState<InternalTask[]>([]);
  const activeRef = useRef(0);
  const queueRef = useRef<InternalTask[]>([]);
  const onCompletedRef = useRef(onCompleted);
  onCompletedRef.current = onCompleted;
  const maxSizeRef = useRef(maxFileSizeBytes);
  maxSizeRef.current = maxFileSizeBytes;

  const patchTask = useCallback(
    (taskId: string, patch: Partial<InternalTask>) => {
      setTasks((current) =>
        current.map((task) =>
          task.id === taskId ? { ...task, ...patch } : task,
        ),
      );
    },
    [],
  );

  const runUpload = useCallback(
    async (task: InternalTask) => {
      patchTask(task.id, { status: "uploading", progress: 0 });

      const mimeType = inferMimeTypeFromName(task.fileName, task.mimeType);

      if (!isAllowedMimeType(mimeType)) {
        patchTask(task.id, {
          status: "failed",
          error: `Unsupported file type (${mimeType || "unknown"}).`,
        });
        return;
      }

      if (task.size > maxSizeRef.current) {
        patchTask(task.id, {
          status: "failed",
          error: "File exceeds the maximum upload size.",
        });
        return;
      }

      const grantResult = await requestUploadAction({
        fileName: task.fileName,
        size: task.size,
        mimeType,
        folderId: task.folderId,
      });

      if (!grantResult.ok) {
        patchTask(task.id, {
          status: "failed",
          error: grantResult.error.message,
        });
        return;
      }

      const grant = grantResult.data;

      try {
        await uploadWithProgress(
          task.file,
          grant.url,
          grant.headers,
          (percent) => patchTask(task.id, { progress: percent }),
        );
      } catch (error) {
        patchTask(task.id, {
          status: "failed",
          error:
            error instanceof Error ? error.message : "The upload was interrupted.",
        });
        void abortUploadAction({ fileId: grant.fileId });
        return;
      }

      patchTask(task.id, { status: "processing", progress: 100 });

      const completeResult = await completeUploadAction({
        fileId: grant.fileId,
        size: task.size,
      });

      if (!completeResult.ok) {
        patchTask(task.id, {
          status: "failed",
          error: completeResult.error.message,
        });
        void abortUploadAction({ fileId: grant.fileId });
        return;
      }

      patchTask(task.id, {
        status: "completed",
        progress: 100,
        fileId: grant.fileId,
      });
      toast.success(`${task.fileName} uploaded`);
      onCompletedRef.current?.();
      router.refresh();
    },
    [patchTask, router],
  );

  const pump = useCallback(() => {
    while (
      activeRef.current < MAX_CONCURRENT_UPLOADS &&
      queueRef.current.length > 0
    ) {
      const task = queueRef.current.shift();
      if (!task) break;

      activeRef.current += 1;
      void runUpload(task).finally(() => {
        activeRef.current -= 1;
        pump();
      });
    }
  }, [runUpload]);

  const addFiles = useCallback(
    (files: File[] | FileList, folderId: string | null) => {
      const list = Array.from(files);
      if (list.length === 0) return;

      const created: InternalTask[] = list.map((file) => ({
        id: crypto.randomUUID(),
        fileName: file.name,
        size: file.size,
        mimeType: file.type || inferMimeTypeFromName(file.name, ""),
        progress: 0,
        status: "queued",
        error: null,
        fileId: null,
        file,
        folderId,
      }));

      setTasks((current) => [...current, ...created]);
      queueRef.current = [...queueRef.current, ...created];

      pump();
    },
    [pump],
  );

  const cancel = useCallback((taskId: string) => {
    queueRef.current = queueRef.current.filter((task) => task.id !== taskId);
    setTasks((current) =>
      current.map((task) =>
        task.id === taskId
          ? { ...task, status: "canceled", error: "Canceled" }
          : task,
      ),
    );
  }, []);

  const dismiss = useCallback((taskId: string) => {
    setTasks((current) => current.filter((task) => task.id !== taskId));
  }, []);

  const clearFinished = useCallback(() => {
    setTasks((current) =>
      current.filter(
        (task) =>
          task.status !== "completed" &&
          task.status !== "failed" &&
          task.status !== "canceled",
      ),
    );
  }, []);

  return {
    tasks: tasks.map((task) => ({
      id: task.id,
      fileName: task.fileName,
      size: task.size,
      mimeType: task.mimeType,
      progress: task.progress,
      status: task.status,
      error: task.error,
      fileId: task.fileId,
    })),
    isUploading: tasks.some(
      (task) =>
        task.status === "queued" ||
        task.status === "uploading" ||
        task.status === "processing",
    ),
    addFiles,
    cancel,
    dismiss,
    clearFinished,
  };
}
