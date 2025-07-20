import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src',
  build: {
    outDir: '../dist'
  },
  resolve: {
    alias: {
      'three/addons': 'three/examples/jsm'
    }
  }
});