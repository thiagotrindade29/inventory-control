import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const certificatePath = resolve('.cert/dev-cert.pem');
const keyPath = resolve('.cert/dev-key.pem');
const httpsOptions = existsSync(certificatePath) && existsSync(keyPath)
  ? { cert: readFileSync(certificatePath), key: readFileSync(keyPath) }
  : undefined;

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    ...(httpsOptions ? { https: httpsOptions } : {}),
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
