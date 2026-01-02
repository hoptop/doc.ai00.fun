import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // 如果部署到 username.github.io/repo-name/，请设置 base 为 '/repo-name/'
  // 如果是根域名 username.github.io，则保持 '/'
  base: '/',
})
