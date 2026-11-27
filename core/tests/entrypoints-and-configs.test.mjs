import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { CORE_DIR, loadStrippedModule } from './helpers/load-module.mjs';

const require = createRequire(import.meta.url);

test('all 7 package source index.js entrypoints expose install() or init() cleanly', () => {
    for (const [pkg, expectedName] of [
        ['vue-docx', 'AbnerVueOfficeDocx'],
        ['vue-excel', 'AbnerVueOfficeExcel'],
        ['vue-pdf', 'AbnerVueOfficePdf'],
        ['vue-pptx', 'AbnerVueOfficePptx']
    ]) {
        const fakeComp = { name: expectedName };
        const mod = loadStrippedModule(`packages/${pkg}/index.js`, {
            [expectedName]: fakeComp
        });
        assert.equal(mod.name, expectedName);
        assert.equal(typeof mod.install, 'function');
        assert.equal(mod.install, fakeComp.install);
        const registered = [];
        mod.install({ component: (name, comp) => registered.push({ name, comp }) });
        assert.deepEqual(registered, [{ name: expectedName, comp: fakeComp }]);
    }

    for (const pkg of ['js-docx', 'js-excel', 'js-pdf']) {
        const fakeInit = () => ({ ok: true });
        const mod = loadStrippedModule(`packages/${pkg}/index.js`, { init: fakeInit });
        assert.equal(mod.init, fakeInit);
        assert.deepEqual(mod.init(), { ok: true });
    }
});

test('stylesheets maintain exact vue-excel/js-excel parity and include critical layout/icon/dimmer/docx rules', () => {
    const vueExcelCss = fs.readFileSync(path.join(CORE_DIR, 'packages/vue-excel/src/index.css'), 'utf8');
    const jsExcelCss = fs.readFileSync(path.join(CORE_DIR, 'packages/js-excel/index.css'), 'utf8');
    assert.equal(vueExcelCss, jsExcelCss, 'vue-excel/src/index.css and js-excel/index.css must stay byte-for-byte identical');

    assert.match(vueExcelCss, /\.x-spreadsheet\s*\{[\s\S]*?position:\s*relative;/);
    assert.match(vueExcelCss, /\.x-spreadsheet-dimmer\s*\{[\s\S]*?position:\s*fixed;/);
    assert.match(vueExcelCss, /\.textline\s*\{[\s\S]*?white-space:\s*nowrap;/);
    assert.match(vueExcelCss, /\.x-spreadsheet-bottombar-controls/);
    assert.match(vueExcelCss, /\.x-spreadsheet-icon-img\.close/);
    assert.equal(vueExcelCss.includes('.x-spreadsheet-menu > li:first-child'), false);

    const lessSrc = fs.readFileSync(path.join(CORE_DIR, 'packages/vue-excel/src/x-spreadsheet/index.less'), 'utf8');
    assert.match(lessSrc, /position:\s*fixed;/);
    assert.match(lessSrc, /white-space:\s*nowrap;/);
    assert.match(lessSrc, /@\{css-prefix\}-bottombar-controls/);

    const jsDocxCss = fs.readFileSync(path.join(CORE_DIR, 'packages/js-docx/index.css'), 'utf8');
    assert.match(jsDocxCss, /\.abner-vue-office-docx-main>div>section/);
});

test('source TypeScript declarations, build configs, and ESLint config are valid and synchronized', () => {
    // ESLint config loads cleanly
    const eslintCfg = require(path.join(CORE_DIR, '.eslintrc.js'));
    assert.ok(eslintCfg && eslintCfg.env && eslintCfg.rules);

    // Core vite.config.js sets emptyOutDir: true
    const coreVite = fs.readFileSync(path.join(CORE_DIR, 'vite.config.js'), 'utf8');
    assert.match(coreVite, /emptyOutDir:\s*true/);

    // All 4 Vue vite.config.js emit dual ['es', 'umd'] formats -> index.mjs & index.js
    for (const pkg of ['vue-docx', 'vue-excel', 'vue-pdf', 'vue-pptx']) {
        const vc = fs.readFileSync(path.join(CORE_DIR, `packages/${pkg}/vite.config.js`), 'utf8');
        assert.match(vc, /formats:\s*\['es',\s*'umd'\]/);
        assert.match(vc, /index\.mjs/);
        assert.equal(fs.existsSync(path.join(CORE_DIR, `packages/${pkg}/index.d.ts`)), true);
        assert.equal(fs.existsSync(path.join(CORE_DIR, `packages/${pkg}/index.d.cts`)), true);
    }

    // All 3 JS packages have rollup.config.js, index.d.ts (with export as namespace), index.d.cts
    for (const [pkg, ns] of [
        ['js-docx', 'abnerJsDocx'],
        ['js-excel', 'abnerJsExcel'],
        ['js-pdf', 'abnerJsPdf']
    ]) {
        const rc = fs.readFileSync(path.join(CORE_DIR, `packages/${pkg}/rollup.config.js`), 'utf8');
        assert.match(rc, /format:\s*'es'/);
        assert.match(rc, /format:\s*'cjs'/);
        assert.match(rc, /format:\s*'umd'/);
        const dts = fs.readFileSync(path.join(CORE_DIR, `packages/${pkg}/index.d.ts`), 'utf8');
        assert.match(dts, new RegExp(`export as namespace ${ns};`));
        assert.equal(fs.existsSync(path.join(CORE_DIR, `packages/${pkg}/index.d.cts`)), true);
    }

    // Demo router.js lazy route component paths all exist on disk
    const routerSrc = fs.readFileSync(path.join(CORE_DIR, 'src/router.js'), 'utf8');
    const imports = [...routerSrc.matchAll(/import\(['"](\.\/components\/[^'"]+)['"]\)/g)].map(m => m[1]);
    assert.equal(imports.length, 7);
    for (const rel of imports) {
        assert.equal(fs.existsSync(path.join(CORE_DIR, 'src', rel)), true, `Missing route component: ${rel}`);
    }
});
