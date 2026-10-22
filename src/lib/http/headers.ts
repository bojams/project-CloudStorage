/**
 * Response headers for endpoints that deliver user supplied bytes.
 *
 * The application CSP is not strict enough for untrusted content, so file
 * responses carry their own, much stricter policy: nothing is loaded, nothing
 * is framed and the sandbox flag disables scripts even if a browser were to
 * render the document.
 */
export const FILE_RESPONSE_HEADERS: Readonly<Record<string, string>> = {
  "Content-Security-Policy": "default-src 'none'; sandbox; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Cross-Origin-Resource-Policy": "same-origin",
};
