import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // 使用相對路徑以相容於不同的部署環境（如 GitHub Pages 子目錄）
  base: './', 

  define: {
    // 讓程式碼中的 process.env.API_KEY 在編譯時被正確替換
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || '')
  },
  
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});