import { defineConfig } from "vitest/config";

// Runs scripts/seed-results.ts (see that file); not part of the unit tests.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ["scripts/seed-results.ts"],
    environment: "node",
    testTimeout: 60_000,
  },
});
