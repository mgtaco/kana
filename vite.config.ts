import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative base so the built app can be served from any sub-path
  // (GitHub Pages project sites, S3 prefixes, etc.) without reconfiguring.
  base: './',
  plugins: [react()],
});
