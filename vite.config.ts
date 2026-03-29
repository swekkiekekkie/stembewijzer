import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

import { geminiCoalitionApiPlugin } from "./vite-plugins/gemini-coalition-api";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  /** Zet op je DuckDNS-host als HMR/modules via het publieke adres haperen, bv. `stembewijzer.duckdns.org`. */
  const devPublicHost = env.VITE_DEV_PUBLIC_HOST?.trim();

  return {
    plugins: [react(), geminiCoalitionApiPlugin(env.GEMINI_API_KEY)],
    server: {
      /** `true`: ook localhost/IP; anders kan een te smalle lijst lege responses / MIME-fouten geven. */
      allowedHosts: true,
      ...(devPublicHost
        ? {
            hmr: {
              host: devPublicHost,
              protocol: "ws" as const,
            },
          }
        : {}),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
        "@data": path.resolve(__dirname, "data"),
      },
    },
    test: {
      environment: "jsdom",
      setupFiles: "./src/test/setup.ts",
      css: true,
    },
  };
});
