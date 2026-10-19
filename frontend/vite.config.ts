import { defineConfig } from "vite"

import react from "@vitejs/plugin-react"

import tailwindcss from "@tailwindcss/vite"

import { cloudflare } from "@cloudflare/vite-plugin"

import path from "node:path"

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    ...(mode === "production"
      ? [cloudflare({ viteEnvironment: { name: "worker" } })]
      : []),
  ],

  environments: {
    worker: { build: { sourcemap: true } },
  },

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  server: {
    host: "0.0.0.0",

    port: Number(process.env.VITE_PORT) || 8443,

    strictPort: true,

    proxy: {
      "/api": {
        target: process.env.VITE_API_ORIGIN || "http://127.0.0.1:3001",

        changeOrigin: true,
      },
    },
  },

  preview: {
    host: "0.0.0.0",

    port: Number(process.env.VITE_PORT) || 8443,
  },
}))
