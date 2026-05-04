import { defineConfig } from 'vitest/config';

export default defineConfig({
    resolve: {
        tsconfigPaths: true,
    },
    test: {
        globals: true,
        environment: 'node',
        include: ['src/**/*.test.ts', 'test/integration/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            include: ['src/**'],
            exclude: [
                'src/generated/**',
                'src/types/**',
                'src/**/*.routes.ts',
                'src/infrastructure/prisma.ts',
                'src/infrastructure/swagger.ts',
                'src/server.ts',
            ],
            thresholds: { lines: 80, branches: 80 },
            reporter: ['text', 'html', 'lcov'],
        },
    },
});