/**
 * Magic-byte sniffing.
 *
 * The browser supplied MIME type is *untrusted*: an attacker can label a
 * malicious payload as `image/png`. For the types below we verify the real
 * file signature before persisting the object.
 */
interface Signature {
  readonly offset: number;
  readonly bytes: readonly number[];
}

const SIGNATURES: Readonly<Record<string, readonly Signature[]>> = {
  "image/png": [{ offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
  "image/jpeg": [
    { offset: 0, bytes: [0xff, 0xd8, 0xff] },
  ],
  "image/gif": [{ offset: 0, bytes: [0x47, 0x49, 0x46, 0x38] }],
  "image/webp": [
    { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] },
    { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] },
  ],
  "image/avif": [
    { offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] },
  ],
  "application/pdf": [{ offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] }],
  "application/zip": [
    { offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] },
    { offset: 0, bytes: [0x50, 0x4b, 0x05, 0x06] },
    { offset: 0, bytes: [0x50, 0x4b, 0x07, 0x08] },
  ],
  "application/gzip": [{ offset: 0, bytes: [0x1f, 0x8b] }],
  "video/mp4": [
    { offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] },
  ],
  "audio/mpeg": [
    { offset: 0, bytes: [0x49, 0x44, 0x33] },
    { offset: 0, bytes: [0xff, 0xfb] },
  ],
};

function matches(buffer: Uint8Array, signature: Signature): boolean {
  const end = signature.offset + signature.bytes.length;
  if (buffer.length < end) return false;

  return signature.bytes.every(
    (byte, index) => buffer[signature.offset + index] === byte,
  );
}

/** Returns the sniffed MIME type, or `null` when the format is unknown. */
export function detectMimeType(buffer: Uint8Array): string | null {
  for (const [mimeType, signatures] of Object.entries(SIGNATURES)) {
    if (signatures.some((signature) => matches(buffer, signature))) {
      return mimeType;
    }
  }
  return null;
}

/**
 * True when the payload matches the declared type, or when the type cannot be
 * sniffed (text/code formats have no reliable signature).
 */
export function isContentTypeConsistent(
  declaredMimeType: string,
  buffer: Uint8Array,
): boolean {
  const signatures = SIGNATURES[declaredMimeType];
  if (!signatures) return true;

  return signatures.some((signature) => matches(buffer, signature));
}
