import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// Fully local dev server. Proxies API + WebSocket to the offline FastAPI backend.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  server: {
    port: 5173,
    proxy: {
      "/v1": { target: "http://127.0.0.1:8100", changeOrigin: true },
      "/health": { target: "http://127.0.0.1:8100", changeOrigin: true },
    },
  },
});
