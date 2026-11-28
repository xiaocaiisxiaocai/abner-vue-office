import { babel } from '@rollup/plugin-babel';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

const babelOptions = {
    babelHelpers: 'bundled',
    babelrc: false,
    configFile: false,
    exclude: /node_modules/,
    presets: [
        [
            '@babel/preset-env',
            {
                targets: {
                    browsers: ['> 1%', 'last 2 versions', 'not dead']
                }
            }
        ]
    ]
};

const terserPlugin = terser({ maxWorkers: 1 });

export default {
    input: 'index.js',
    output: [
        {
            file: 'lib/index.js',
            format: 'es',
            plugins: [terserPlugin]
        },
        {
            file: 'lib/index.cjs',
            format: 'cjs',
            exports: 'default',
            plugins: [terserPlugin]
        },
        {
            file: 'lib/index.umd.js',
            name: 'abnerJsExcel',
            format: 'umd',
            plugins: [terserPlugin]
        }
    ],
    plugins: [
        nodeResolve({ browser: true, preferBuiltins: false }),
        commonjs(),
        babel(babelOptions)
    ]
};
