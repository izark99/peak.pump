import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@shared': resolve(import.meta.dirname, 'shared') },
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        prototype3d: resolve(import.meta.dirname, 'prototype-3d.html'),
      },
    },
  },
  worker: { format: 'es' },
  test: {
    include: process.env.VITEST_INCLUDE ? process.env.VITEST_INCLUDE.split(',') : ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
