import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globals: false,
    reporters: ["default"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
      exclude: ["src/lib/**/*.test.ts", "src/lib/db/**"],
    },
  },
  resolve: {
    alias: [
      { find: "@/", replacement: `${path.join(root, "src")}/` },
      // `server-only` throws when it is imported outside of a React Server
      // Component tree. The unit tests run in plain Node, so the module is
      // replaced with an inert stub.
      {
        find: /^server-only$/,
        replacement: path.join(root, "test/stubs/server-only.ts"),
      },
    ],
  },
});
