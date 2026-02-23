import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src',
  build: {
    outDir: '../dist/demo',
    emptyOutDir: true
  },
  resolve: {
    alias: {
      'three/addons': 'three/examples/jsm'
    }
  }
});
