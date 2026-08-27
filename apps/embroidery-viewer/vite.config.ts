import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
    plugins: [react(), tailwind()],
    resolve: {
        alias: { '@': path.resolve(__dirname, './src') },
    },
    clearScreen: false,
    server: {
        port: 1421,
        strictPort: true,
    },
    envPrefix: ['VITE_', 'TAURI_'],
});
