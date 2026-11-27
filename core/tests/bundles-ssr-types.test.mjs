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
    'packages/vue-docx/lib/index.js',
    'packages/vue-docx/lib/index.css',
    'packages/vue-docx/lib/index.d.ts',
    'packages/vue-docx/lib/v2/index.js',
    'packages/vue-docx/lib/v3/index.js',
    'packages/vue-excel/LICENSE',
    'packages/vue-excel/lib/index.js',
    'packages/vue-excel/lib/index.css',
    'packages/vue-excel/lib/index.d.ts',
    'packages/vue-excel/lib/v2/index.js',
    'packages/vue-excel/lib/v3/index.js',
    'packages/vue-pdf/LICENSE',
    'packages/vue-pdf/lib/index.js',
    'packages/vue-pdf/lib/index.d.ts',
    'packages/vue-pdf/lib/v2/index.js',
    'packages/vue-pdf/lib/v3/index.js',
    'packages/vue-pptx/LICENSE',
    'packages/vue-pptx/lib/index.js',
    'packages/vue-pptx/lib/index.d.ts',
    'packages/vue-pptx/lib/v2/index.js',
    'packages/vue-pptx/lib/v3/index.js',
    'packages/js-docx/LICENSE',
    'packages/js-docx/lib/index.js',
    'packages/js-docx/lib/index.cjs',
    'packages/js-docx/lib/index.umd.js',
    'packages/js-docx/lib/index.css',
    'packages/js-docx/lib/index.d.ts',
    'packages/js-excel/LICENSE',
    'packages/js-excel/lib/index.js',
    'packages/js-excel/lib/index.cjs',
    'packages/js-excel/lib/index.umd.js',
    'packages/js-excel/lib/index.css',
    'packages/js-excel/lib/index.d.ts',
    'packages/js-pdf/LICENSE',
    'packages/js-pdf/lib/index.js',
    'packages/js-pdf/lib/index.cjs',
    'packages/js-pdf/lib/index.umd.js',
    'packages/js-pdf/lib/index.d.ts'
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
    for (const rel of ['packages/js-docx/lib/index.js', 'packages/js-docx/lib/index.cjs', 'packages/js-docx/lib/index.umd.js']) {
        const code = fs.readFileSync(path.join(CORE_DIR, rel), 'utf8');
        assert.equal(/core-js\/modules\//.test(code), false, `${rel} leaked core-js import/require`);
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
    const jsPdfCode = fs.readFileSync(path.join(CORE_DIR, 'packages/js-pdf/lib/index.js'), 'utf8');
    const occurrences = jsPdfCode.split(prefixMatch[1]).length - 1;
    assert.equal(occurrences, 1, 'workerStr should be embedded once');

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

        fs.writeFileSync(
            node16File,
            [
                'import VueDocxV2 from \'@abner-vue-office/docx/lib/v2\';',
                'import VueExcelV3 from \'@abner-vue-office/excel/lib/v3\';',
                'import VuePdfV2 from \'@abner-vue-office/pdf/lib/v2\';',
                'import VuePptxV3 from \'@abner-vue-office/pptx/lib/v3\';',
                'import jsDocxUmd from \'@abner-vue-office/js-docx/umd\';',
                'import jsExcelUmd from \'@abner-vue-office/js-excel/umd\';',
                'import jsPdfUmd from \'@abner-vue-office/js-pdf/umd\';',
                'void [VueDocxV2, VueExcelV3, VuePdfV2, VuePptxV3, jsDocxUmd, jsExcelUmd, jsPdfUmd];'
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
                node16File
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
