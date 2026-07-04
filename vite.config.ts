import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import { resolve } from 'path'

const projectRoot = process.env.PROJECT_ROOT || import.meta.dirname

// Backend cél a dev-proxy-hoz. Production-ben (nginx mögött) erre nem
// hivatkozunk — ott a /api/v1 ugyanazt a hostot célozza.
const API_TARGET = process.env.VITE_DEV_API_TARGET || 'http://localhost:5050'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': resolve(projectRoot, 'src')
    },
    // Egyetlen React-példány — különben a dev-szerver a nem-előbundle-elt
    // függőségeknek (pl. next-themes) külön React-modult adhat, ami
    // "Invalid hook call" hibát okoz. Prod build (Rollup) eleve dedupál.
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    // next-themes előbundle-elése a közös React-példánnyal.
    include: ['next-themes'],
  },
  server: {
    proxy: {
      // REST: /api/v1/* → http://localhost:5050/api/v1/*
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
        secure: false,
      },
      // SSE: külön bejegyzés, mert a Vite-nek nem szabad bufferelnie az
      // event-stream-et (egyébként a kliens csak nagyobb csomagokban kap
      // adatokat). A target-et a /api szabály különben is felvenné, de
      // explicit konfig stabilabb.
      //
      // Megj.: a `ws: false` szándékosan, mert SSE nem WebSocket. A Vite
      // alapból nem proxyzza HTTP/1.1-en a hosszú-élet kapcsolatokat
      // különlegesen, viszont a 60s default timeout kevés — felemeljük.
      '/api/v1/events': {
        target: API_TARGET,
        changeOrigin: true,
        secure: false,
        timeout: 0, // 0 = no timeout — SSE long-lived
        proxyTimeout: 0,
      },
    },
  },
});
