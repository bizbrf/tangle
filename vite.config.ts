import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: process.env.VITE_PAGES ? '/tangle/' : '/',
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    strictPort: true,
  },
})
