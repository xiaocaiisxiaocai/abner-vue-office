import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { CORE_DIR, runVmBundle } from './helpers/load-module.mjs';

const require = createRequire(import.meta.url);

const EXPECTED_ARTIFACTS = [
    'packages/vue-docx/LICENSE',
    'packages/vue-docx/README.md',
    'packages/vue-docx/lib/index.js',
    'packages/vue-docx/lib/index.css',
    'packages/vue-docx/lib/index.d.ts',
    'packages/vue-docx/lib/v2/index.js',
    'packages/vue-docx/lib/v2/index.css',
    'packages/vue-docx/lib/v2/index.d.ts',
    'packages/vue-docx/lib/v3/index.js',
    'packages/vue-docx/lib/v3/index.css',
    'packages/vue-docx/lib/v3/index.d.ts',
    'packages/vue-excel/LICENSE',
    'packages/vue-excel/README.md',
    'packages/vue-excel/lib/index.js',
    'packages/vue-excel/lib/index.css',
    'packages/vue-excel/lib/index.d.ts',
    'packages/vue-excel/lib/v2/index.js',
    'packages/vue-excel/lib/v2/index.css',
    'packages/vue-excel/lib/v2/index.d.ts',
    'packages/vue-excel/lib/v3/index.js',
    'packages/vue-excel/lib/v3/index.css',
    'packages/vue-excel/lib/v3/index.d.ts',
    'packages/vue-pdf/LICENSE',
    'packages/vue-pdf/README.md',
    'packages/vue-pdf/lib/index.js',
    'packages/vue-pdf/lib/index.d.ts',
    'packages/vue-pdf/lib/v2/index.js',
    'packages/vue-pdf/lib/v2/index.d.ts',
    'packages/vue-pdf/lib/v3/index.js',
    'packages/vue-pdf/lib/v3/index.d.ts',
    'packages/vue-pptx/LICENSE',
    'packages/vue-pptx/README.md',
    'packages/vue-pptx/lib/index.js',
    'packages/vue-pptx/lib/index.d.ts',
    'packages/vue-pptx/lib/v2/index.js',
    'packages/vue-pptx/lib/v2/index.d.ts',
    'packages/vue-pptx/lib/v3/index.js',
    'packages/vue-pptx/lib/v3/index.d.ts',
    'packages/js-docx/LICENSE',
    'packages/js-docx/README.md',
    'packages/js-docx/lib/index.js',
    'packages/js-docx/lib/index.cjs',
    'packages/js-docx/lib/index.umd.js',
    'packages/js-docx/lib/index.css',
    'packages/js-docx/lib/index.d.ts',
    'packages/js-docx/lib/index.d.cts',
    'packages/js-excel/LICENSE',
    'packages/js-excel/README.md',
    'packages/js-excel/lib/index.js',
    'packages/js-excel/lib/index.cjs',
    'packages/js-excel/lib/index.umd.js',
    'packages/js-excel/lib/index.css',
    'packages/js-excel/lib/index.d.ts',
    'packages/js-excel/lib/index.d.cts',
    'packages/js-pdf/LICENSE',
    'packages/js-pdf/README.md',
    'packages/js-pdf/lib/index.js',
    'packages/js-pdf/lib/index.cjs',
    'packages/js-pdf/lib/index.umd.js',
    'packages/js-pdf/lib/index.d.ts',
    'packages/js-pdf/lib/index.d.cts'
];

test('all expected package build artifacts and LICENSE files exist', () => {
    for (const rel of EXPECTED_ARTIFACTS) {
        assert.equal(fs.existsSync(path.join(CORE_DIR, rel)), true, `Missing artifact: ${rel}`);
    }
});

test('all UMD bundles execute cleanly in browser <script> sandbox with zero global Babel/x_spreadsheet leaks', () => {
    const targets = [
        ['packages/js-docx/lib/index.umd.js', 'abnerJsDocx', true],
        ['packages/js-excel/lib/index.umd.js', 'abnerJsExcel', true],
        ['packages/js-pdf/lib/index.umd.js', 'abnerJsPdf', true],
        ['packages/vue-docx/lib/v3/index.js', 'AbnerVueOfficeDocx', false],
        ['packages/vue-excel/lib/v3/index.js', 'AbnerVueOfficeExcel', false],
        ['packages/vue-pdf/lib/v3/index.js', 'AbnerVueOfficePdf', false],
        ['packages/vue-pptx/lib/v3/index.js', 'AbnerVueOfficePptx', false],
        ['packages/vue-docx/lib/v2/index.js', 'AbnerVueOfficeDocx', false],
        ['packages/vue-excel/lib/v2/index.js', 'AbnerVueOfficeExcel', false],
        ['packages/vue-pdf/lib/v2/index.js', 'AbnerVueOfficePdf', false],
        ['packages/vue-pptx/lib/v2/index.js', 'AbnerVueOfficePptx', false]
    ];

    for (const [rel, globalKey, checkNoExtraGlobals] of targets) {
        const ctx = {
            console,
            setTimeout,
            clearTimeout,
            setInterval,
            clearInterval,
            URL,
            Blob,
            Uint8Array,
            ArrayBuffer,
            navigator: { userAgent: 'Mozilla/5.0' },
            document: {
                createElement: () => ({ style: {}, getContext: () => ({}) }),
                documentElement: { clientHeight: 800, clientWidth: 1200 },
                body: {}
            },
            Vue: { openBlock: () => {}, createElementBlock: () => {}, createElementVNode: () => {}, renderSlot: () => {} },
            VueDemi: {
                defineComponent: c => c,
                ref: () => ({}),
                onMounted: () => {},
                onBeforeUnmount: () => {},
                watch: () => {},
                nextTick: () => {},
                isVue2: false
            }
        };
        ctx.window = ctx;
        ctx.self = ctx;
        ctx.globalThis = ctx;

        const baseKeys = new Set(Object.keys(ctx));
        runVmBundle(rel, ctx);
        assert.ok(ctx[globalKey], `Global export missing for ${rel}`);

        if (checkNoExtraGlobals) {
            const allowedRuntimePolyfills = new Set(['clearImmediate', 'setImmediate', 'regeneratorRuntime']);
            const addedKeys = Object.keys(ctx)
                .filter(k => !baseKeys.has(k) && !allowedRuntimePolyfills.has(k))
                .sort();
            assert.deepEqual(addedKeys, [globalKey], `Unexpected global leaks in ${rel}: ${addedKeys.join(', ')}`);
        }
        assert.equal('x_spreadsheet' in ctx, false, `Unexpected window.x_spreadsheet leak in ${rel}`);
    }
});

test('js-* packages support both ESM import() and CommonJS require() cleanly', async () => {
    for (const pkg of ['js-docx', 'js-excel', 'js-pdf']) {
        const esmMod = await import(pathToFileURL(path.join(CORE_DIR, `packages/${pkg}/lib/index.js`)).href);
        assert.equal(typeof esmMod.default.init, 'function', `ESM default.init missing in ${pkg}`);

        const cjsMod = require(path.join(CORE_DIR, `packages/${pkg}/lib/index.cjs`));
        assert.equal(typeof cjsMod.init, 'function', `CJS init missing in ${pkg}`);
    }
});

test('all Vue bundles load cleanly in SSR (no window/document/navigator/Blob) and validate src prop safely', () => {
    const vueTargets = [
        'packages/vue-docx/lib/v3/index.js',
        'packages/vue-excel/lib/v3/index.js',
        'packages/vue-pdf/lib/v3/index.js',
        'packages/vue-pptx/lib/v3/index.js',
        'packages/vue-docx/lib/v2/index.js',
        'packages/vue-excel/lib/v2/index.js',
        'packages/vue-pdf/lib/v2/index.js',
        'packages/vue-pptx/lib/v2/index.js'
    ];

    for (const rel of vueTargets) {
        const mod = { exports: {} };
        const fakeRequire = (id) => {
            if (id === 'vue-demi') {
                return {
                    defineComponent: c => c,
                    ref: () => ({}),
                    onMounted: () => {},
                    onBeforeUnmount: () => {},
                    watch: () => {},
                    nextTick: () => {},
                    isVue2: false
                };
            }
            if (id === 'vue') {
                return {
                    openBlock: () => {},
                    createElementBlock: () => {},
                    createElementVNode: () => {},
                    renderSlot: () => {}
                };
            }
            throw new Error(`Unexpected require in SSR: ${id}`);
        };
        const ctx = {
            module: mod,
            exports: mod.exports,
            require: fakeRequire,
            console,
            setTimeout,
            clearTimeout,
            setInterval,
            clearInterval,
            Buffer,
            process,
            URL,
            Uint8Array,
            ArrayBuffer
        };
        ctx.global = ctx;
        ctx.globalThis = ctx;

        runVmBundle(rel, ctx);
        assert.equal(typeof mod.exports.install, 'function', `${rel} missing install()`);
        const srcProp = mod.exports.props && mod.exports.props.src;
        assert.equal(typeof srcProp.validator, 'function', `${rel} missing src.validator`);
        assert.equal(srcProp.validator('https://example.com/a.pdf'), true);
        assert.equal(srcProp.validator(''), true);
        assert.equal(srcProp.validator(null), true);
        assert.equal(srcProp.validator(new ArrayBuffer(8)), true);
        assert.equal(srcProp.validator(new Uint8Array(4)), true);
        assert.equal(srcProp.validator({ invalid: true }), false);
        assert.equal(srcProp.validator(123), false);
    }
});

test('js-* and vue-* bundles satisfy external isolation, minification, CSS, and worker embedding checks', () => {
    for (const rel of [
        'packages/js-docx/lib/index.js', 'packages/js-docx/lib/index.cjs', 'packages/js-docx/lib/index.umd.js',
        'packages/js-pdf/lib/index.js', 'packages/js-pdf/lib/index.cjs', 'packages/js-pdf/lib/index.umd.js'
    ]) {
        const code = fs.readFileSync(path.join(CORE_DIR, rel), 'utf8');
        assert.equal(/core-js\/modules\//.test(code), false, `${rel} leaked core-js import/require`);
    }
    for (const rel of [
        'packages/js-excel/lib/index.js', 'packages/js-excel/lib/index.cjs', 'packages/js-excel/lib/index.umd.js'
    ]) {
        const code = fs.readFileSync(path.join(CORE_DIR, rel), 'utf8');
        assert.equal(/require\(['"](core-js|@babel\/runtime)/.test(code), false, `${rel} leaked external runtime`);
        assert.equal(/\bfrom\s+['"](core-js|@babel\/runtime)/.test(code), false, `${rel} leaked ESM runtime import`);
    }

    for (const p of ['vue-docx', 'vue-excel', 'vue-pdf', 'vue-pptx']) {
        for (const v of ['v2', 'v3']) {
            const code = fs.readFileSync(path.join(CORE_DIR, `packages/${p}/lib/${v}/index.js`), 'utf8');
            const requires = [...new Set([...code.matchAll(/require\(['"]([^'"]+)['"]\)/g)].map(m => m[1]))];
            for (const req of requires) {
                assert.ok(
                    ['vue', 'vue-demi', 'util'].includes(req),
                    `Unexpected require("${req}") in ${p}/lib/${v}/index.js`
                );
            }
            assert.equal(/require\(['"](@babel\/runtime|core-js\/modules)/.test(code), false, `${p}/${v} leaked runtime dependency`);
        }
    }

    for (const rel of [
        'packages/js-docx/lib/index.js',
        'packages/js-docx/lib/index.cjs',
        'packages/js-docx/lib/index.umd.js',
        'packages/js-excel/lib/index.js',
        'packages/js-excel/lib/index.cjs',
        'packages/js-excel/lib/index.umd.js',
        'packages/js-pdf/lib/index.js',
        'packages/js-pdf/lib/index.cjs',
        'packages/js-pdf/lib/index.umd.js'
    ]) {
        const code = fs.readFileSync(path.join(CORE_DIR, rel), 'utf8');
        const lineCount = code.trim().split('\n').length;
        assert.ok(lineCount <= 50, `${rel} should be minified (got ${lineCount} lines)`);
    }

    const workerSrc = fs.readFileSync(path.join(CORE_DIR, 'packages/js-pdf/src/worker.js'), 'utf8');
    const prefixMatch = workerSrc.match(/workerStr\s*=\s*'([^']{30})/);
    assert.ok(prefixMatch, 'workerStr prefix found');
    for (const pdfRel of ['packages/js-pdf/lib/index.js', 'packages/js-pdf/lib/index.cjs', 'packages/js-pdf/lib/index.umd.js']) {
        const jsPdfCode = fs.readFileSync(path.join(CORE_DIR, pdfRel), 'utf8');
        const occurrences = jsPdfCode.split(prefixMatch[1]).length - 1;
        assert.equal(occurrences, 1, `workerStr should be embedded once in ${pdfRel}`);
    }

    const jsExcelCode = fs.readFileSync(path.join(CORE_DIR, 'packages/js-excel/lib/index.js'), 'utf8');
    assert.equal(jsExcelCode.includes('.x-spreadsheet-bottombar'), false);
});

test('strict TypeScript check passes on all 8 .d.ts files under node and node16 resolution', () => {
    const tscJs = path.join(CORE_DIR, 'node_modules/typescript/bin/tsc');
    const dtsFiles = [
        'packages/vue-docx/lib/index.d.ts',
        'packages/vue-excel/lib/index.d.ts',
        'packages/vue-pdf/lib/index.d.ts',
        'packages/vue-pptx/lib/index.d.ts',
        'packages/js-docx/lib/index.d.ts',
        'packages/js-excel/lib/index.d.ts',
        'packages/js-pdf/lib/index.d.ts',
        'packages/vue-excel/src/x-spreadsheet/index.d.ts'
    ];
    execFileSync(
        process.execPath,
        [
            tscJs,
            '--noEmit',
            '--strict',
            '--moduleResolution',
            'node',
            '--target',
            'es2020',
            '--lib',
            'es2020,dom',
            '--typeRoots',
            './_no_types',
            ...dtsFiles
        ],
        {
            cwd: CORE_DIR,
            stdio: 'pipe'
        }
    );

    const tmpTsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'abner-dts-check-'));
    const consumerFile = path.join(tmpTsDir, 'consumer.ts');
    const node16File = path.join(tmpTsDir, 'node16-consumer.mts');
    try {
        fs.writeFileSync(
            consumerFile,
            [
                `import VueDocx, { DocxProps } from '${path.join(CORE_DIR, 'packages/vue-docx/lib/index').replace(/\\/g, '/')}';`,
                `import VueExcel, { ExcelProps } from '${path.join(CORE_DIR, 'packages/vue-excel/lib/index').replace(/\\/g, '/')}';`,
                `import VuePdf, { PdfProps } from '${path.join(CORE_DIR, 'packages/vue-pdf/lib/index').replace(/\\/g, '/')}';`,
                `import VuePptx, { PptxProps } from '${path.join(CORE_DIR, 'packages/vue-pptx/lib/index').replace(/\\/g, '/')}';`,
                `import jsDocx from '${path.join(CORE_DIR, 'packages/js-docx/lib/index').replace(/\\/g, '/')}';`,
                `import jsExcel from '${path.join(CORE_DIR, 'packages/js-excel/lib/index').replace(/\\/g, '/')}';`,
                `import jsPdf from '${path.join(CORE_DIR, 'packages/js-pdf/lib/index').replace(/\\/g, '/')}';`,
                `import Spreadsheet, { spreadsheet } from '${path.join(CORE_DIR, 'packages/vue-excel/src/x-spreadsheet/index').replace(/\\/g, '/')}';`,
                'const p1: DocxProps = { src: null, style: "height: 100vh", options: { hideWrapperOnPrint: true, renderComments: false, renderAltChunks: true } };',
                'const p2: ExcelProps = { src: new Response("a"), style: { height: "100%" }, requestOptions: { timeout: 3000 } };',
                'const p3: PdfProps = { src: new Uint8Array([1]), class: "pdf-view" };',
                'const p4: PptxProps = { style: "height: 100%" };',
                'void [VueDocx, VueExcel, VuePdf, VuePptx, jsDocx, jsExcel, jsPdf, Spreadsheet, spreadsheet, p1, p2, p3, p4];'
            ].join('\n'),
            'utf8'
        );
        execFileSync(
            process.execPath,
            [
                tscJs,
                '--noEmit',
                '--strict',
                '--moduleResolution',
                'node',
                '--target',
                'es2020',
                '--lib',
                'es2020,dom',
                '--typeRoots',
                './_no_types',
                consumerFile
            ],
            {
                cwd: CORE_DIR,
                stdio: 'pipe'
            }
        );

        const nmScopeDir = path.join(tmpTsDir, 'node_modules/@abner-vue-office');
        fs.mkdirSync(nmScopeDir, { recursive: true });
        for (const [pkgAlias, pkgDir] of [
            ['docx', 'vue-docx'],
            ['excel', 'vue-excel'],
            ['pdf', 'vue-pdf'],
            ['pptx', 'vue-pptx'],
            ['js-docx', 'js-docx'],
            ['js-excel', 'js-excel'],
            ['js-pdf', 'js-pdf']
        ]) {
            fs.symlinkSync(path.join(CORE_DIR, 'packages', pkgDir), path.join(nmScopeDir, pkgAlias), 'junction');
        }

        // Verify Vue 2/3 subpath imports under moduleResolution: "node" AND Vue2 TS registration + userScale: number
        const vue2SubpathConsumer = path.join(tmpTsDir, 'vue2-subpath-consumer.ts');
        fs.writeFileSync(
            vue2SubpathConsumer,
            [
                `import Vue2 from '${path.join(CORE_DIR, 'node_modules/vue2').replace(/\\/g, '/')}';`,
                'import VueDocxV2 from \'@abner-vue-office/docx/lib/v2\';',
                'import VueExcelV2 from \'@abner-vue-office/excel/lib/v2\';',
                'import VuePdfV2, { AbnerVueOfficePdfInstance } from \'@abner-vue-office/pdf/lib/v2\';',
                'import VuePptxV2 from \'@abner-vue-office/pptx/lib/v2\';',
                'import VueDocxV3 from \'@abner-vue-office/docx/lib/v3\';',
                'import VueExcelV3 from \'@abner-vue-office/excel/lib/v3\';',
                'import VuePdfV3 from \'@abner-vue-office/pdf/lib/v3\';',
                'import VuePptxV3 from \'@abner-vue-office/pptx/lib/v3\';',
                'const Comp = Vue2.extend({ components: { VueDocxV2, VueExcelV2, VuePdfV2, VuePptxV2 } });',
                'const checkScale = (inst: AbnerVueOfficePdfInstance): number => inst.userScale;',
                'void [Comp, VueDocxV3, VueExcelV3, VuePdfV3, VuePptxV3, checkScale];'
            ].join('\n'),
            'utf8'
        );
        execFileSync(
            process.execPath,
            [
                tscJs,
                '--noEmit',
                '--strict',
                '--moduleResolution',
                'node',
                '--target',
                'es2020',
                '--lib',
                'es2020,dom',
                '--typeRoots',
                './_no_types',
                vue2SubpathConsumer
            ],
            {
                cwd: CORE_DIR,
                stdio: 'pipe'
            }
        );

        fs.writeFileSync(
            node16File,
            [
                'import VueDocxRoot from \'@abner-vue-office/docx\';',
                'import VueExcelRoot from \'@abner-vue-office/excel\';',
                'import VuePdfRoot from \'@abner-vue-office/pdf\';',
                'import VuePptxRoot from \'@abner-vue-office/pptx\';',
                'import VueDocxV2 from \'@abner-vue-office/docx/lib/v2\';',
                'import VueExcelV2 from \'@abner-vue-office/excel/lib/v2\';',
                'import VuePdfV2 from \'@abner-vue-office/pdf/lib/v2\';',
                'import VuePptxV2 from \'@abner-vue-office/pptx/lib/v2\';',
                'import VueDocxV3 from \'@abner-vue-office/docx/lib/v3\';',
                'import VueExcelV3 from \'@abner-vue-office/excel/lib/v3\';',
                'import VuePdfV3 from \'@abner-vue-office/pdf/lib/v3\';',
                'import VuePptxV3 from \'@abner-vue-office/pptx/lib/v3\';',
                'import jsDocxRoot from \'@abner-vue-office/js-docx\';',
                'import jsExcelRoot from \'@abner-vue-office/js-excel\';',
                'import jsPdfRoot from \'@abner-vue-office/js-pdf\';',
                'import jsDocxUmd from \'@abner-vue-office/js-docx/umd\';',
                'import jsExcelUmd from \'@abner-vue-office/js-excel/umd\';',
                'import jsPdfUmd from \'@abner-vue-office/js-pdf/umd\';',
                'void [VueDocxRoot, VueExcelRoot, VuePdfRoot, VuePptxRoot, VueDocxV2, VueExcelV2, VuePdfV2, VuePptxV2, VueDocxV3, VueExcelV3, VuePdfV3, VuePptxV3, jsDocxRoot, jsExcelRoot, jsPdfRoot, jsDocxUmd, jsExcelUmd, jsPdfUmd];'
            ].join('\n'),
            'utf8'
        );
        const ctsFile = path.join(tmpTsDir, 'cjs-consumer.cts');
        fs.writeFileSync(
            ctsFile,
            [
                'import jsDocx = require(\'@abner-vue-office/js-docx\');',
                'import jsExcel = require(\'@abner-vue-office/js-excel\');',
                'import jsPdf = require(\'@abner-vue-office/js-pdf\');',
                'const checkInit = (el: HTMLElement) => {',
                '  jsDocx.init(el).setOptions();',
                '  jsExcel.init(el).setOptions();',
                '  jsPdf.init(el).setOptions();',
                '};',
                'void checkInit;'
            ].join('\n'),
            'utf8'
        );
        execFileSync(
            process.execPath,
            [
                tscJs,
                '--noEmit',
                '--strict',
                '--module',
                'node16',
                '--moduleResolution',
                'node16',
                '--target',
                'es2020',
                '--lib',
                'es2020,dom',
                '--typeRoots',
                './_no_types',
                node16File,
                ctsFile
            ],
            {
                cwd: CORE_DIR,
                stdio: 'pipe'
            }
        );
    } finally {
        fs.rmSync(tmpTsDir, { recursive: true, force: true });
    }
});
