import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // 請確保這裡的名稱與您的 GitHub Repository 名稱完全一致
  // 例如：https://<username>.github.io/Rating-Magic/
  base: '/Rating-Magic/', 

  define: {
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || '')
  }
});