import { getBabelOutputPlugin } from '@rollup/plugin-babel';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

export default {
    input: 'index.js',
    output: [
        {
            file: 'lib/index.js',
            name: 'abnerJsExcel',
            format: 'es',
            plugins: [getBabelOutputPlugin({ presets: ['@babel/preset-env'] })]
        },
        {
            file: 'lib/index.umd.js',
            name: 'abnerJsExcel',
            format: 'umd'
        }
    ],
    plugins: [
        nodeResolve({ browser: true, preferBuiltins: false }),
        commonjs(),
        terser()
    ]
};
