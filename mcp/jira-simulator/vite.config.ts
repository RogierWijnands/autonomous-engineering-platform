import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    strictPort: true,
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${process.env.JIRA_API_PORT || 3001}`,
        changeOrigin: true,
      },
    },
  },
  preview: {
    strictPort: true,
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${process.env.JIRA_API_PORT || 3001}`,
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    setupFiles: ["./src/test/setup.ts"],
  },
});
