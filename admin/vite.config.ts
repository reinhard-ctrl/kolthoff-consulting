import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const productId = process.env.VITE_PRODUCT_ID || 'kolthoff-os';
const isAgencyOps = productId === 'agency-ops-starter';

export default defineConfig({
  plugins: [react()],
  base: isAgencyOps ? '/agency-ops/' : '/admin/',
  build: {
    outDir: isAgencyOps ? 'dist-agency-ops' : 'dist',
    emptyOutDir: true,
    rollupOptions: isAgencyOps
      ? { input: { main: 'agency-ops.html' } }
      : { input: { main: 'index.html' } },
  },
  envPrefix: ['VITE_', 'RECAPTCHA_'],
  define: {
    'import.meta.env.VITE_PRODUCT_ID': JSON.stringify(productId),
  },
});
