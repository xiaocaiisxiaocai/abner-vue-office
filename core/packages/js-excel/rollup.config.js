import { babel } from '@rollup/plugin-babel';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

const babelOptions = {
    babelHelpers: 'bundled',
    babelrc: false,
    configFile: false,
    exclude: [/node_modules/, /src[\\/](pdf|worker)\.js$/],
    presets: [
        [
            '@babel/preset-env',
            {
                targets: {
                    browsers: ['chrome >= 49', 'edge >= 15', 'firefox >= 52', 'safari >= 10', 'ie >= 11']
                }
            }
        ]
    ]
};

export default {
    input: 'index.js',
    output: [
        {
            file: 'lib/index.js',
            format: 'es',
            plugins: [terser()]
        },
        {
            file: 'lib/index.cjs',
            format: 'cjs',
            exports: 'default',
            plugins: [terser()]
        },
        {
            file: 'lib/index.umd.js',
            name: 'abnerJsExcel',
            format: 'umd',
            plugins: [terser()]
        }
    ],
    plugins: [
        nodeResolve({ browser: true, preferBuiltins: false }),
        commonjs(),
        babel(babelOptions)
    ]
};
