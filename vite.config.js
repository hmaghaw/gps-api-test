import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 9001,
    host: true,
    proxy: {
      "/api": {
        target: "https://gps-specials.polydial.com",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api/, "/v1"),
      },
    },
  },
  preview: {
    port: 9001,
    host: true,
  },
});
