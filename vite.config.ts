/// <reference types="node" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // 這裡的名稱必須與您的 GitHub Repository 名稱完全一致
  base: '/Rating-Magic/', 

  define: {
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || '')
  }
});
