import fs from 'node:fs';
import vue from '@vitejs/plugin-vue';
import { visualizer } from 'rollup-plugin-visualizer';
import autoImport from 'unplugin-auto-import/vite';
import { NaiveUiResolver } from 'unplugin-vue-components/resolvers';
import components from 'unplugin-vue-components/vite';
import { defineConfig } from 'vite';
import { createHtmlPlugin } from 'vite-plugin-html';
import magicPreloader from 'vite-plugin-magic-preloader';

// https://vite.dev/config/
export default defineConfig({
    base: '',
    server: {
        proxy: {
            '/api': 'http://localhost:4000',
            '/storage': 'http://localhost:4000',
        },
    },
    plugins: [
        vue(),
        autoImport({
            imports: [
                'vue',
                {
                    'naive-ui': ['useDialog'],
                },
            ],
        }),
        components({
            resolvers: [NaiveUiResolver()],
        }),
        magicPreloader(),
        createHtmlPlugin({
            minify: {
                collapseWhitespace: true,
                collapseBooleanAttributes: true,
                decodeEntities: true,
                removeComments: true,
                removeAttributeQuotes: false,
                removeRedundantAttributes: true,
                removeScriptTypeAttributes: true,
                removeStyleLinkTypeAttributes: true,
                removeEmptyAttributes: true,
                useShortDoctype: true,
                processConditionalComments: true,
                sortAttributes: true,
                sortClassName: true,
                minifyCSS: true,
                minifyJS: true,
                minifyURLs: false,
            },
        }),
    ],
    build: {
        outDir: '../public',
        emptyOutDir: true,
        chunkSizeWarningLimit: Infinity,
        target: 'esnext',
        rollupOptions: {
            plugins: [
                visualizer({
                    gzipSize: true,
                    brotliSize: true,
                }),
            ],
            output: {
                entryFileNames: 'assets/[hash].js',
                chunkFileNames: 'assets/[hash].js',
                assetFileNames: 'assets/[hash].[ext]',
            },
        },
    },
    define: {
        __BUILD_TIME__: `"${(new Date()).toISOString()}"`,
        __VUE_VERSION__: `"Vue ${JSON.parse(fs.readFileSync('./node_modules/vue/package.json', { encoding: 'utf-8' })).version}"`,
        __VITE_VERSION__: `"Vite ${JSON.parse(fs.readFileSync('./node_modules/vite/package.json', { encoding: 'utf-8' })).version}"`,
    },
});
