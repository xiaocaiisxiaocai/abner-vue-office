import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
    CORE_DIR,
    createDomMocks,
    loadStrippedModule,
    mountScriptSetup,
    runWithDomGlobals
} from './helpers/load-module.mjs';

test('demo router.js and main.js wire all 8 routes, 404 fallback, and Vue app plugins', async () => {
    const routesSeen = [];
    const createdRouters = [];
    const routerMod = loadStrippedModule('src/router.js', {
        createRouter: (cfg) => {
            createdRouters.push(cfg);
            routesSeen.push(...cfg.routes);
            return cfg;
        },
        createWebHashHistory: () => 'hash-history'
    });
    assert.equal(routerMod.history, 'hash-history');
    assert.equal(routesSeen.length, 9);
    assert.equal(routesSeen[0].redirect, '/docx');
    assert.equal(routesSeen[routesSeen.length - 1].redirect, '/docx');
    const paths = routesSeen.map(r => r.path);
    assert.deepEqual(paths, ['/', '/docx', '/excel', '/pdf', '/pptx', '/js-docx', '/js-excel', '/js-pdf', '/:pathMatch(.*)*']);

    const usedPlugins = [];
    let mountedSelector = null;
    loadStrippedModule('src/main.js', {
        createApp: () => ({
            use(p) { usedPlugins.push(p); return this; },
            mount(sel) { mountedSelector = sel; }
        }),
        Antd: { name: 'Antd' },
        App: { name: 'App' },
        router: { name: 'Router' }
    });
    assert.deepEqual(usedPlugins.map(p => p.name), ['Antd', 'Router']);
    assert.equal(mountedSelector, '#app');
});

test('App.vue and PreviewWrapper.vue handle menu sync, query preservation, loading indicator, and retry', async () => {
    const pushed = [];
    const routeObj = { path: '/docx', query: { token: '1' } };
    await runWithDomGlobals({ location: { hash: '#/docx?file=https://x/a.pdf' } }, () => {
        const appComp = mountScriptSetup('src/App.vue', {
            useRouter: () => ({ push: opts => pushed.push(opts) }),
            useRoute: () => routeObj
        }, {}, ['current', 'syncMenu', 'go']);
        appComp.mount();
        assert.deepEqual(appComp.bindings.current.value, ['docx']);

        appComp.bindings.syncMenu('/excel?x=pdf');
        assert.deepEqual(appComp.bindings.current.value, ['excel']);
        appComp.bindings.syncMenu('/pdf');
        assert.deepEqual(appComp.bindings.current.value, ['pdf']);
        appComp.bindings.syncMenu('/pptx');
        assert.deepEqual(appComp.bindings.current.value, ['pptx']);

        appComp.bindings.go({ key: 'excel' });
        assert.deepEqual(pushed[0], { path: '/excel', query: { token: '1' } });
    });

    const loadingEvents = [];
    const wrapComp = mountScriptSetup('src/common/PreviewWrapper.vue', {
        usePreview: def => ({
            type: { value: 'url' },
            inputSrc: { value: def },
            src: { value: def },
            xls: { value: false },
            beforeUpload: () => false
        }),
        isXlsName: name => typeof name === 'string' && /\.xls$/i.test(name),
        useLoading: {
            showLoading: () => loadingEvents.push('show'),
            hideLoading: () => loadingEvents.push('hide')
        },
        isTest: () => false
    }, { accept: '.xlsx', placeholder: 'url', defaultSrc: 'https://example.com/a.xlsx' }, ['retryKey', 'handlePreview', 'src', 'inputSrc', 'xls']);

    // Immediate watch called showLoading on mount
    assert.deepEqual(loadingEvents, ['show']);
    wrapComp.bindings.handlePreview();
    assert.equal(wrapComp.bindings.retryKey.value, 1);
    assert.deepEqual(loadingEvents, ['show', 'show']);
    wrapComp.unmount();
    assert.deepEqual(loadingEvents, ['show', 'show', 'hide']);
});

test('all 7 Demo components resolve static URLs, handle rendered/error, and clean up on unmount', async () => {
    const { mockDocument } = createDomMocks();
    const { getStaticFileUrl } = loadStrippedModule('src/hooks/usePreview.js', { ref: v => ({ value: v }) });

    await runWithDomGlobals({ location: { origin: 'https://host.test', pathname: '/abner-vue-office/examples/dist/index.html' } }, () => {
        assert.equal(
            getStaticFileUrl('static/test-files/test.docx'),
            'https://host.test/abner-vue-office/examples/dist/static/test-files/test.docx'
        );
    });

    let hideCount = 0;
    const useLoadingStub = { hideLoading: () => { hideCount++; } };
    const commonDeps = {
        PreviewWrapper: {},
        useLoading: useLoadingStub,
        getStaticFileUrl
    };

    await runWithDomGlobals({
        window: { innerWidth: 720 },
        location: { origin: 'http://localhost:5173', pathname: '/' }
    }, () => {
        for (const [file, componentDep] of [
            ['src/components/DocxDemo.vue', { AbnerVueOfficeDocx: {} }],
            ['src/components/PdfDemo.vue', { AbnerVueOfficePdf: {} }],
            ['src/components/PptxDemo.vue', { AbnerVueOfficePptx: {} }]
        ]) {
            const demo = mountScriptSetup(file, { ...commonDeps, ...componentDep }, {}, ['defaultSrc', 'onRendered', 'onError']);
            assert.match(demo.bindings.defaultSrc, /^http:\/\/localhost:5173\/static\/test-files\/test\./);
            demo.bindings.onRendered();
            demo.bindings.onError(new Error('demo err'));
        }
        assert.equal(hideCount, 6);

        const excelDemo = mountScriptSetup(
            'src/components/ExcelDemo.vue',
            { ...commonDeps, AbnerVueOfficeExcel: {} },
            {},
            ['beforeTransformData', 'transformData', 'switchSheet', 'cellSelected', 'cellsSelected']
        );
        const wbSample = { _worksheets: [{ _rows: [{ _cells: [{ style: { bgcolor: '#123456' } }] }] }] };
        assert.equal(excelDemo.bindings.beforeTransformData(wbSample), wbSample);
        assert.equal(wbSample._worksheets[0]._rows[0]._cells[0].style.bgcolor, '#123456');
        assert.equal(excelDemo.bindings.beforeTransformData(null), null);
    });

    let docxDestroyed = 0;
    let excelDestroyed = 0;
    let pdfDestroyed = 0;
    await runWithDomGlobals({
        location: { origin: 'http://localhost:5173', pathname: '/' }
    }, async () => {
        const jsDocxDemo = mountScriptSetup('src/components/JsDocxDemo.vue', {
            getStaticFileUrl,
            jsDocx: {
                init: () => ({
                    preview: () => Promise.resolve(),
                    destroy: () => { docxDestroyed++; }
                })
            }
        }, {}, ['dom']);
        jsDocxDemo.bindings.dom.value = mockDocument.createElement('div');
        jsDocxDemo.mount();
        await new Promise(r => setTimeout(r, 10));
        jsDocxDemo.unmount();
        assert.equal(docxDestroyed, 1);

        const jsExcelDemo = mountScriptSetup('src/components/JsExcelDemo.vue', {
            getStaticFileUrl,
            jsExcel: {
                init: () => ({
                    preview: () => Promise.resolve(),
                    destroy: () => { excelDestroyed++; }
                })
            }
        }, {}, ['dom']);
        jsExcelDemo.bindings.dom.value = mockDocument.createElement('div');
        jsExcelDemo.mount();
        jsExcelDemo.unmount();
        assert.equal(excelDestroyed, 1);

        const jsPdfDemo = mountScriptSetup('src/components/JsPdfDemo.vue', {
            getStaticFileUrl,
            jsPdf: {
                init: () => ({
                    preview: () => Promise.resolve(),
                    destroy: () => { pdfDestroyed++; }
                })
            }
        }, {}, ['dom']);
        jsPdfDemo.bindings.dom.value = mockDocument.createElement('div');
        jsPdfDemo.mount();
        jsPdfDemo.unmount();
        assert.equal(pdfDestroyed, 1);
    });

    assert.equal(fs.existsSync(path.join(CORE_DIR, 'src/style.css')), true);
});
