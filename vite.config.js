import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // IMPORTANT: remplacez 'tictactoe' par le nom exact de votre repo GitHub
  base: '/tictactoe/',
})
