import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "firebase-auth": ["firebase/auth", "firebase/app-check"],
          "firebase-data": ["firebase/firestore", "firebase/functions"],
          react: ["react", "react-dom"],
        },
      },
    },
  },
  test: { environment: "jsdom", include: ["tests/**/*.test.{ts,tsx}"] },
});
