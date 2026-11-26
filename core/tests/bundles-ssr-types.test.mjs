import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { CORE_DIR, runVmBundle } from './helpers/load-module.mjs';

const EXPECTED_ARTIFACTS = [
    'packages/vue-docx/lib/index.js',
    'packages/vue-docx/lib/index.css',
    'packages/vue-docx/lib/index.d.ts',
    'packages/vue-docx/lib/v2/index.js',
    'packages/vue-docx/lib/v3/index.js',
    'packages/vue-excel/lib/index.js',
    'packages/vue-excel/lib/index.css',
    'packages/vue-excel/lib/index.d.ts',
    'packages/vue-excel/lib/v2/index.js',
    'packages/vue-excel/lib/v3/index.js',
    'packages/vue-pdf/lib/index.js',
    'packages/vue-pdf/lib/index.d.ts',
    'packages/vue-pdf/lib/v2/index.js',
    'packages/vue-pdf/lib/v3/index.js',
    'packages/vue-pptx/lib/index.js',
    'packages/vue-pptx/lib/index.d.ts',
    'packages/vue-pptx/lib/v2/index.js',
    'packages/vue-pptx/lib/v3/index.js',
    'packages/js-docx/lib/index.js',
    'packages/js-docx/lib/index.umd.js',
    'packages/js-docx/lib/index.css',
    'packages/js-docx/lib/index.d.ts',
    'packages/js-excel/lib/index.js',
    'packages/js-excel/lib/index.umd.js',
    'packages/js-excel/lib/index.css',
    'packages/js-excel/lib/index.d.ts',
    'packages/js-pdf/lib/index.js',
    'packages/js-pdf/lib/index.umd.js',
    'packages/js-pdf/lib/index.d.ts'
];

test('all expected package build artifacts exist', () => {
    for (const rel of EXPECTED_ARTIFACTS) {
        assert.equal(fs.existsSync(path.join(CORE_DIR, rel)), true, `Missing artifact: ${rel}`);
    }
});

test('all UMD bundles execute cleanly in browser <script> sandbox with zero require/module globals', () => {
    const targets = [
        ['packages/js-docx/lib/index.umd.js', 'abnerJsDocx'],
        ['packages/js-excel/lib/index.umd.js', 'abnerJsExcel'],
        ['packages/js-pdf/lib/index.umd.js', 'abnerJsPdf'],
        ['packages/vue-docx/lib/v3/index.js', 'abner-vue-office-docx'],
        ['packages/vue-excel/lib/v3/index.js', 'abner-vue-office-excel'],
        ['packages/vue-pdf/lib/v3/index.js', 'abner-vue-office-pdf'],
        ['packages/vue-pptx/lib/v3/index.js', 'abner-vue-office-pptx'],
        ['packages/vue-docx/lib/v2/index.js', 'abner-vue-office-docx'],
        ['packages/vue-excel/lib/v2/index.js', 'abner-vue-office-excel'],
        ['packages/vue-pdf/lib/v2/index.js', 'abner-vue-office-pdf'],
        ['packages/vue-pptx/lib/v2/index.js', 'abner-vue-office-pptx']
    ];

    for (const [rel, globalKey] of targets) {
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

        runVmBundle(rel, ctx);
        assert.ok(ctx[globalKey], `Global export missing for ${rel}`);
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

test('js-* and vue-* bundles satisfy Babel/terser, external isolation, CSS, and worker embedding checks', () => {
    for (const rel of ['packages/js-docx/lib/index.js', 'packages/js-docx/lib/index.umd.js']) {
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
        'packages/js-docx/lib/index.umd.js',
        'packages/js-excel/lib/index.js',
        'packages/js-excel/lib/index.umd.js',
        'packages/js-pdf/lib/index.js',
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

test('strict TypeScript check passes on all 7 package .d.ts files', () => {
    const tscJs = path.join(CORE_DIR, 'node_modules/typescript/bin/tsc');
    const dtsFiles = [
        'packages/vue-docx/lib/index.d.ts',
        'packages/vue-excel/lib/index.d.ts',
        'packages/vue-pdf/lib/index.d.ts',
        'packages/vue-pptx/lib/index.d.ts',
        'packages/js-docx/lib/index.d.ts',
        'packages/js-excel/lib/index.d.ts',
        'packages/js-pdf/lib/index.d.ts'
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

    const tmpTsDir = fs.mkdtempSync(path.join(CORE_DIR, '.tmp-dts-check-'));
    const consumerFile = path.join(tmpTsDir, 'consumer.ts');
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
                'const p1: DocxProps = { src: null };',
                'const p2: ExcelProps = { src: new Response("a") };',
                'const p3: PdfProps = { src: new Uint8Array([1]) };',
                'const p4: PptxProps = {};',
                'void [VueDocx, VueExcel, VuePdf, VuePptx, jsDocx, jsExcel, jsPdf, p1, p2, p3, p4];'
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
    } finally {
        fs.rmSync(tmpTsDir, { recursive: true, force: true });
    }
});
