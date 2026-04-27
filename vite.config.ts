import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import { spawn } from "node:child_process";

// Dev-only endpoint to run the predeploy checklist script from the browser.
// POST /__predeploy -> runs `node scripts/check-edge-functions.mjs`, returns log.
function predeployRunnerPlugin(): PluginOption {
  return {
    name: "predeploy-runner",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__predeploy", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method Not Allowed");
          return;
        }
        const child = spawn("node", ["scripts/check-edge-functions.mjs"], {
          cwd: process.cwd(),
          env: process.env,
        });
        let out = "";
        child.stdout.on("data", (d) => { out += d.toString(); });
        child.stderr.on("data", (d) => { out += d.toString(); });
        child.on("error", (e) => {
          res.statusCode = 500;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ ok: false, error: String(e), output: out }));
        });
        child.on("close", (code) => {
          res.statusCode = 200;
          res.setHeader("content-type", "application/json");
          // Exit code 2 = type-only failures (still considered "ran successfully")
          res.end(JSON.stringify({ ok: code === 0 || code === 2, exit_code: code, output: out }));
        });
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(() => ({
  base: "/",
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    predeployRunnerPlugin(),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: {
        enabled: false,
      },
      includeAssets: ["placeholder.svg", "robots.txt", "aikido-badge.svg"],
      manifest: {
        name: "Opposition Research Database",
        short_name: "ORO",
        description: "Sidio.us Opposition Research Database — Comprehensive political research platform",
        theme_color: "#1e293b",
        background_color: "#0f172a",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/~oauth/, /^\/auth\/v1/, /\/functions\/v1\//],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2,json}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "gstatic-fonts-cache",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Supabase PostgREST: read-through cache, 24h
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
            handler: "NetworkFirst",
            method: "GET",
            options: {
              cacheName: "supabase-rest-cache",
              expiration: { maxEntries: 1000, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
              networkTimeoutSeconds: 5,
            },
          },
          // Supabase Edge Functions (read-only GETs): 24h
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/functions\/v1\/.*/i,
            handler: "NetworkFirst",
            method: "GET",
            options: {
              cacheName: "supabase-edge-cache",
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
              networkTimeoutSeconds: 6,
            },
          },
          // Supabase Storage objects (avatars, attachments, exports)
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "supabase-storage-cache",
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // OpenStreetMap tiles for the District / Country maps
          {
            urlPattern: /^https:\/\/(?:[a-z0-9-]+\.)*tile\.openstreetmap\.org\/.*$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "osm-tile-cache",
              expiration: { maxEntries: 2000, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Lovable AI Gateway responses (read-only briefs, talking points)
          {
            urlPattern: /^https:\/\/ai\.gateway\.lovable\.dev\/.*/i,
            handler: "NetworkFirst",
            method: "GET",
            options: {
              cacheName: "lovable-ai-cache",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 12 },
              cacheableResponse: { statuses: [0, 200] },
              networkTimeoutSeconds: 8,
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
}));
