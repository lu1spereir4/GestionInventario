import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  root: path.resolve(__dirname, 'frontend'),
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
  },
});
