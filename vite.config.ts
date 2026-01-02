import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  

  base: '/Rating-Magic/', 

  define: {
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || '')
  }
});