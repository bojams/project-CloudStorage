"use client";

/**
 * Browser upload helper.
 *
 * `XMLHttpRequest` is used on purpose: it is the only API that reports
 * genuine upload progress, and it lets the caller set the signed headers of
 * the grant without a preflight.
 */
export function uploadWithProgress(
  file: File | null,
  url: string,
  headers: Record<string, string>,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("The file is no longer available."));
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.responseType = "json";

    for (const [key, value] of Object.entries(headers)) {
      try {
        xhr.setRequestHeader(key, value);
      } catch {
        // The browser refused the header — it is safe to skip it.
      }
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(
          Math.min(99, Math.round((event.loaded / event.total) * 100)),
        );
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }

      const message =
        (xhr.response as { error?: string } | null)?.error ??
        `Upload failed with status ${xhr.status}.`;
      reject(new Error(message));
    };

    xhr.onerror = () => reject(new Error("The network connection was lost."));
    xhr.onabort = () => reject(new Error("The upload was canceled."));

    xhr.send(file);
  });
}
