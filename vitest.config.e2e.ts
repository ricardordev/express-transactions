import { defineConfig } from 'vitest/config';

export default defineConfig({
    resolve: {
        tsconfigPaths: true,
    },
    test: {
        globals: true,
        environment: 'node',
        include: ['test/e2e/**/*.test.ts'],
        fileParallelism: false,
        env: { RUN_E2E: 'true', NODE_ENV: 'test' },
    },
});
