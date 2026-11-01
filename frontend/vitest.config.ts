import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// Unit and integration tests (Vitest + jsdom). The Robot Framework QA suite
// lives in qa/ and runs against a real browser and backend.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    // Node's fetch rejects relative URLs, so tests use an absolute API base.
    // MSW handlers in src/test/server.ts listen on the same origin.
    env: { VITE_API_URL: "http://api.test/api" },
    restoreMocks: true,
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/hooks/**", "src/components/ProtectedRoute.tsx", "src/components/RootRedirect.tsx"],
      reporter: ["text", "html"],
    },
  },
});
