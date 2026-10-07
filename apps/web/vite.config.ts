import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// VITE_REGISTRY_ADDRESS, VITE_RPC_URLS and VITE_API_BASE are read at build time (see src/config.ts).
export default defineConfig({
  plugins: [react()],
  // The 675-token catalog and viem make one ~620 kB chunk; that is expected for this app.
  build: { target: "es2022", sourcemap: true, chunkSizeWarningLimit: 1000 },
  server: { proxy: { "/api": "http://localhost:8787" } },
  test: { environment: "jsdom", include: ["src/**/*.test.{ts,tsx}"], setupFiles: ["src/test-setup.ts"] },
});
