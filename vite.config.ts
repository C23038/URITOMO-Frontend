import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import electron from "vite-plugin-electron/simple"

export default defineConfig(({ command }) => ({
  base: command === 'serve' ? '/' : './',
  plugins: [
    react(),
    electron({
      main: {
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron']
            }
          }
        }
      },
      preload: {
        input: 'electron/preload.ts',
      },
      renderer: {},
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "motion/react": "framer-motion",
    },
  },
  server: {
    proxy: {
      '/signup': {
        target: 'http://192.168.1.33:8000',
        changeOrigin: true,
      },
      '/general_login': {
        target: 'http://192.168.1.33:8000',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://192.168.1.33:8000',
        changeOrigin: true,
      },
      '/meeting': {
        target: 'http://192.168.1.33:8000',
        changeOrigin: true,
      },
      '/example': {
        target: 'http://192.168.1.33:8000',
        changeOrigin: true,
      },
      '/user': {
        target: 'http://192.168.1.33:8000',
        changeOrigin: true,
      },
    }
  },
}))