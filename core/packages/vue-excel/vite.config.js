import { defineConfig } from 'vite';
import { createVuePlugin } from 'vite-plugin-vue2';
import vue3 from '@vitejs/plugin-vue';
import * as compiler from '@vue/compiler-sfc';
import { isVue2 } from 'vue-demi';
import { resolve } from 'path';
import babel from '@rollup/plugin-babel';

export default defineConfig({
  plugins: [
    isVue2
        ? createVuePlugin()
        : vue3({
          compiler: compiler
        })
  ],
  optimizeDeps: {
    exclude: ['vue-demi']
  },
  build: {
    minify: 'terser',
    target: 'es2015',
    outDir: 'lib/v' + (isVue2 ? '2' : '3'),
    lib: {
      entry: resolve(__dirname, 'index.js'), //指定组件编译入口文件
      name: 'AbnerVueOfficeExcel',
      formats: ['umd'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      external: ['vue-demi','vue'],
      output: {
        globals: {
          vue: 'Vue',
          'vue-demi': 'VueDemi'
        },
      },
      plugins: [
        babel({
          extensions: ['.js', '.ts', '.vue'],
          babelHelpers: 'runtime',
          plugins: [
              '@babel/plugin-transform-runtime',
            '@babel/plugin-transform-template-literals'
          ],
          presets: [
            [
              '@babel/preset-env',
              {
                useBuiltIns: false,
                targets: {
                  chrome: '40'
                },
              },
            ],
          ],
        }),
      ],
    },
  },
});