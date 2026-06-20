import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp"
    },
    proxy: {
      "/apiframe-proxy": {
        target: "https://api.apiframe.ai",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/apiframe-proxy/, "")
      },
      "/openrouter-proxy": {
        target: "https://openrouter.ai",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/openrouter-proxy/, "")
      }
    }
  }
});
