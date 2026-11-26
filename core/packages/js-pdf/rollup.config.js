import {getBabelOutputPlugin} from '@rollup/plugin-babel';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

export default {
    input: 'index.js',
    output:[
        {
            file: 'lib/index.js',
            name: 'abnerJsPdf',
            format: 'es',
            plugins: [getBabelOutputPlugin({ presets: ['@babel/preset-env'] })]
        },
        {
            file: 'lib/index.umd.js',
            name: 'abnerJsPdf',
            format: 'umd',
            plugins: [getBabelOutputPlugin({ allowAllFormats: true, presets: ['@babel/preset-env'] })]
        }
    ],
    plugins: [
        nodeResolve({ browser: true, preferBuiltins: false }),
        commonjs(),
        terser()
    ]
};