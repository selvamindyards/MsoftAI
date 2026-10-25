import { defineConfig } from 'vite';

// Relative base so the same build works at selvamindyards.github.io/MsoftAI/
// and at the custom domain msoftai.mindyards.in.
export default defineConfig({
  base: './',
  build: { outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 800 },
  test: { environment: 'node' },
} as any);
