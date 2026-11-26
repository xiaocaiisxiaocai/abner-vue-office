import {getBabelOutputPlugin} from '@rollup/plugin-babel';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

const babelConfig = {
    presets: [
        [
            '@babel/preset-env',
            {
                targets: {
                    browsers: ['ie >= 11'] // 指定转换目标为IE11及以上版本
                }
            }
        ]
    ]
};

export default {
    input: 'index.js',
    output:[
        {
            file: 'lib/index.js',
            name: 'abnerJsDocx',
            format: 'es',
            plugins: [getBabelOutputPlugin(babelConfig), terser()]
        },
        {
            file: 'lib/index.umd.js',
            name: 'abnerJsDocx',
            format: 'umd',
            plugins: [getBabelOutputPlugin({
                ...babelConfig,
                allowAllFormats: true
            }), terser()]
        }
    ],
    plugins: [
        nodeResolve({ browser: true, preferBuiltins: false }),
        commonjs()
    ]
};