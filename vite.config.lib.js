import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    outDir: 'dist/lib',
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/module/index.js'),
      formats: ['es'],
      fileName: () => 'index.js'
    },
    rollupOptions: {
      external: [
        'three',
        /^three\/examples\/jsm\//
      ]
    },
    sourcemap: true,
    minify: false
  },
  resolve: {
    alias: {
      'three/addons': 'three/examples/jsm'
    }
  }
});
