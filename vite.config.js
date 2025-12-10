import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
    },
    test: {
        environment: 'jsdom',
        globals: true,
        include: ['src/**/*.test.{js,jsx,ts,tsx}'],
        exclude: ['server/**', 'node_modules/**'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov'],
            reportsDirectory: 'coverage',
        },
    },
});
