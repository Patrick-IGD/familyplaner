import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    include: ["src/**/*.integration.test.ts"],
    fileParallelism: false,
    restoreMocks: true,
    testTimeout: 10_000,
    hookTimeout: 10_000,
  },
});
