import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Adresse du back. En local, le back tourne sur le port 3000 ; avec Docker Compose, il s'appelle « back » (front/Dockerfile).
const backUrl = process.env.BACK_URL ?? 'http://localhost:3000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // En local, les appels à /api partent vers le back : le front et le back restent sur la même origine.
    proxy: {
      '/api': backUrl,
      '/socket.io': { target: backUrl, ws: true },
    },
  },
})
