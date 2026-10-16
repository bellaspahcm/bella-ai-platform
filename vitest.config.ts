import { defineConfig } from 'vitest/config';
import path from 'path';
import dotenv from 'dotenv';

const vitestEnvFile = process.env.VITEST_ENV_FILE || process.env.BELLA_VITEST_ENV_FILE || '.env.local';

dotenv.config({
  path: vitestEnvFile,
  override: false,
});

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: [],
    env: process.env as Record<string, string>,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/platform/integration-runtime/**/*.ts'],
      exclude: [
        'src/platform/integration-runtime/**/*.types.ts',
        'src/platform/integration-runtime/**/index.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
