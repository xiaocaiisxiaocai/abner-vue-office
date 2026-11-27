import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { isXlsName } from '../src/hooks/usePreview.js';
import { CORE_DIR, createDomMocks, runWithDomGlobals, loadStrippedModule } from './helpers/load-module.mjs';

const require = createRequire(import.meta.url);
const debounce = require('lodash/debounce');
const omit = require('lodash/omit');

test('usePreview, useLoading, and docx hack.js work in browser and SSR safely', async () => {
    assert.equal(isXlsName('report.xls'), true);
    assert.equal(isXlsName('  https://example.com/report.XLS?token=1#hash  '), true);
    assert.equal(isXlsName('report.xlsx'), false);
    assert.equal(isXlsName('report.xls.txt'), false);
    assert.equal(isXlsName('report.xls#1'), true);
    assert.equal(isXlsName(null), false);

    await runWithDomGlobals({ window: undefined }, async () => {
        await import(`../packages/vue-docx/src/hack.js?ssr=${Date.now()}`);
        await import(`../packages/js-docx/src/hack.js?ssr=${Date.now()}`);
    });

    const mockWin = {};
    await runWithDomGlobals({ window: mockWin }, async () => {
        await import(`../packages/js-docx/src/hack.js?jsbrowser=${Date.now()}`);
        assert.equal(typeof mockWin.setImmediate, 'function');
        assert.equal(typeof mockWin.clearImmediate, 'function');
        let clearedFired = false;
        const immId = mockWin.setImmediate(() => {
            clearedFired = true;
        });
        mockWin.clearImmediate(immId);
        await new Promise(r => setTimeout(r, 20));
        assert.equal(clearedFired, false);

        const customClear = () => 'custom-clear';
        const mockWin2 = { clearImmediate: customClear };
        await runWithDomGlobals({ window: mockWin2 }, async () => {
            await import(`../packages/vue-docx/src/hack.js?browser=${Date.now()}`);
            assert.equal(typeof mockWin2.setImmediate, 'function');
            assert.equal(mockWin2.clearImmediate, customClear);
            let gotArgs = null;
            await new Promise(resolve => {
                mockWin2.setImmediate((a, b) => {
                    gotArgs = [a, b];
                    resolve();
                }, 'x', 42);
            });
            assert.deepEqual(gotArgs, ['x', 42]);
            const customImm = () => 99;
            mockWin2.setImmediate = customImm;
            await import(`../packages/js-docx/src/hack.js?preserve=${Date.now()}`);
            assert.equal(mockWin2.setImmediate, customImm);
        });
    });

    let hideCalls = 0;
    const shown = [];
    const useLoading = loadStrippedModule('src/hooks/useLoading.js', {
        message: {
            loading: (content, duration) => {
                shown.push({ content, duration });
                return () => hideCalls++;
            }
        },
        ref: v => ({ value: v })
    });
    useLoading.hideLoading();
    assert.equal(hideCalls, 0);
    useLoading.showLoading();
    useLoading.showLoading('Loading 2');
    assert.equal(hideCalls, 1);
    assert.equal(useLoading.loading.value, true);
    assert.deepEqual(shown, [
        { content: '加载中...', duration: 0 },
        { content: 'Loading 2', duration: 0 }
    ]);
    useLoading.hideLoading();
    useLoading.hideLoading();
    assert.equal(hideCalls, 2);
    assert.equal(useLoading.loading.value, false);

    class MockFileReader {
        readAsArrayBuffer(file) {
            MockFileReader.instances.push(this);
            this.file = file;
        }
    }
    MockFileReader.instances = [];
    const usePreviewFactory = loadStrippedModule('src/hooks/usePreview.js', { ref: v => ({ value: v }) });
    await runWithDomGlobals({ FileReader: MockFileReader }, () => {
        const state = usePreviewFactory('https://example.com/init.xls');
        assert.equal(state.type.value, 'url');
        assert.equal(state.inputSrc.value, 'https://example.com/init.xls');
        assert.equal(state.src.value, 'https://example.com/init.xls');
        assert.equal(state.xls.value, true);
        assert.equal(state.beforeUpload(null), false);

        // Racing two file uploads: second supersedes first so stale onload does not clobber
        const bufOld = new ArrayBuffer(4);
        const bufNew = new ArrayBuffer(12);
        state.beforeUpload({ name: 'old.xls' });
        state.beforeUpload({ name: 'upload.xlsx' });
        assert.equal(state.xls.value, true); // not flipped prematurely before onload
        MockFileReader.instances[1].onload({ target: { result: bufNew } });
        assert.equal(state.src.value, bufNew);
        assert.equal(state.xls.value, false);
        MockFileReader.instances[0].onload({ target: { result: bufOld } });
        assert.equal(state.src.value, bufNew);
        assert.equal(state.xls.value, false);
        MockFileReader.instances[0].onerror(new Error('stale err'));
    });
});

test('vue-docx/src/docx.js validates data, serializes container commits, and skips superseded parses', async () => {
    const events = [];
    const { mockDocument } = createDomMocks();
    const container = mockDocument.createElement('div');
    let rejectFirstRender = false;
    let releaseFirstRender = null;

    const docxHelper = loadStrippedModule('packages/vue-docx/src/docx.js', {
        normalizeFetchOptions: opts => opts || {},
        parseAsync: async (blob) => {
            const txt = await blob.text();
            events.push(`parse:${txt}`);
            return { txt };
        },
        renderDocument: async (doc, target) => {
            events.push(`commit:${doc.txt}`);
            if (doc.txt === 'first' && releaseFirstRender) {
                await new Promise(resolve => {
                    releaseFirstRender = resolve;
                });
            }
            if (rejectFirstRender && doc.txt === 'first') {
                throw new Error('first render err');
            }
            target.innerHTML = `<p>${doc.txt}</p>`;
        }
    });

    await docxHelper.render(new Blob(['ignored']), null);
    await assert.rejects(docxHelper.render({ invalid: true }, container), /Unsupported docx data/);
    assert.equal(container.innerHTML, '');

    let committed = false;
    await docxHelper.render(new Blob(['stale']), container, {}, () => committed);
    assert.equal(container.innerHTML, '');
    // Superseded before parseAsync: zero parse calls
    assert.deepEqual(events, []);

    await docxHelper.render(new Blob(['fresh']), container, {}, () => true);
    assert.equal(container.innerHTML, '<p>fresh</p>');

    // Concurrent container serialization + recovery after first rejects
    rejectFirstRender = true;
    const p1 = docxHelper.render(new Blob(['first']), container, {}, () => true);
    const p2 = docxHelper.render(new Blob(['second']), container, {}, () => true);
    await assert.rejects(p1, /first render err/);
    await p2;
    assert.equal(container.innerHTML, '<p>second</p>');

    await docxHelper.render('', container, {}, () => true);
    assert.equal(container.innerHTML, '');

    await runWithDomGlobals({ Blob: undefined }, async () => {
        assert.equal(await docxHelper.getBlob(new Uint8Array([1, 2])), undefined);
    });

    const passthrough = new ArrayBuffer(2);
    assert.equal(await docxHelper.getData(passthrough), passthrough);

    await runWithDomGlobals({ fetch: async () => ({ ok: true, status: 200 }) }, async () => {
        const res = await docxHelper.getData('https://example.com/ok.docx', { method: 'GET' });
        assert.equal(res.status, 200);
    });

    await runWithDomGlobals({ fetch: async () => ({ ok: false, status: 403 }) }, async () => {
        await assert.rejects(docxHelper.getData('https://example.com/deny.docx'), r => r.status === 403);
    });
});

test('js-docx/src/main.js constructor, setOptions, error/stale race handling, save, and destroy', async () => {
    const { mockDocument } = createDomMocks();
    let releaseSlow = null;
    let getDataCalls = 0;
    let shouldFailGetData = false;
    let shouldFailRender = false;
    const downloads = [];

    const mockDocxApi = {
        getData: async (src) => {
            getDataCalls++;
            if (src === 'slow' || src === 'slow-fail') {
                await new Promise((resolve, reject) => {
                    releaseSlow = { resolve, reject };
                });
            }
            if (shouldFailGetData) {
                throw new Error('fetch boom');
            }
            return src;
        },
        getBlob: async (res) => {
            if (res instanceof Blob) return res;
            if (res === 'slow') return new Blob(['slow']);
            return undefined;
        },
        render: async (data, target, opts, shouldCommit) => {
            if (!data) {
                if (!shouldCommit || shouldCommit()) {
                    target.innerHTML = '';
                }
                return;
            }
            if (shouldFailRender) {
                throw new Error('render boom');
            }
            if (!shouldCommit || shouldCommit()) {
                target.innerHTML = `rendered:${JSON.stringify(opts)}`;
            }
        }
    };

    const rawSrc = fs.readFileSync(path.join(CORE_DIR, 'packages/js-docx/src/main.js'), 'utf8')
        .replace(/^\s*import\s+[\s\S]*?;\s*$/gm, '')
        .replace(/export\s+function\s+init/g, 'function init');

    await runWithDomGlobals({ document: mockDocument }, async () => {
        const { init } = new Function('docx', 'downloadFile', `${rawSrc}\nreturn { init };`)(
            mockDocxApi,
            (name, data) => downloads.push({ name, data })
        );

        assert.throws(() => init(null), /container is required/);

        const host = mockDocument.createElement('div');
        const inst = init(host, { inWrapper: true }, { method: 'GET' });
        assert.equal(host.children.length, 1);
        inst.setOptions({ ignoreFonts: true });
        inst.setOptions(null);
        inst.setRequestOptions({ headers: { 'X-Auth': '1' } });
        assert.deepEqual(inst.options, { inWrapper: true, ignoreFonts: true });

        await assert.rejects(inst.preview(''), /预览地址不能为空/);
        await assert.rejects(inst.preview({ bad: 1 }), /Unsupported docx data/);

        shouldFailGetData = true;
        await assert.rejects(inst.preview('https://example.com/fail.docx'), /fetch boom/);
        shouldFailGetData = false;

        shouldFailRender = true;
        await assert.rejects(inst.preview(new Blob(['bad-render'])), /render boom/);
        shouldFailRender = false;

        const freshBlob = new Blob(['fresh-doc']);
        await inst.preview(freshBlob);
        assert.match(inst.wrapperMain.innerHTML, /ignoreFonts/);

        inst.save('custom.docx');
        inst.save();
        assert.equal(downloads[0].name, 'custom.docx');
        assert.match(downloads[1].name, /^abner-vue-office-js-docx-\d+\.docx$/);

        // Stale rejecting request superseded by winner must NOT clear winner or reject
        const slowInst = init(mockDocument.createElement('div'));
        const slowP = slowInst.preview('slow-fail');
        const fastBlob = new Blob(['winner']);
        await slowInst.preview(fastBlob);
        releaseSlow.reject(new Error('stale failure'));
        await slowP;
        assert.equal(slowInst.fileData, fastBlob);

        slowInst.destroy();
        assert.equal(host.children.length, 1);
        inst.destroy();
        assert.equal(host.children.length, 0);
        inst.destroy(); // idempotent

        const beforeCalls = getDataCalls;
        await inst.preview('after-destroy');
        assert.equal(getDataCalls, beforeCalls);
        assert.equal(inst.isDestroyed, true);
        assert.deepEqual(inst.options, {});
        assert.deepEqual(inst.requestOptions, {});
    });
});

test('js-pdf/src/main.js covers gap, withCredentials precedence, cancelled detached canvas, save, and destroy', async () => {
    const { mockDocument, mockWindow } = createDomMocks();
    const container = mockDocument.createElement('div');
    const mainSrc = fs.readFileSync(path.join(CORE_DIR, 'packages/js-pdf/src/main.js'), 'utf8')
        .replace(/^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"];\s*$/gm, '')
        .replace(/export\s+function\s+init/g, 'function init');

    const downloads = [];
    const revokedUrls = [];
    let shouldFailPage = false;
    let passedDocOpts = null;
    let releaseSlowDoc = null;
    let resolveSlowStarted = null;
    const slowDocStarted = new Promise(r => {
        resolveSlowStarted = r;
    });
    let loadAttempt = 0;

    const createPdfFactory = (loadScriptImpl = async () => {}, getUrlAsyncImpl = async src => src) => new Function(
        'workerStr', 'pdfLibJsStr', 'downloadFile', 'getUrlAsync', 'revokeUrl', 'loadScript', 'omit', 'debounce',
        `${mainSrc}\nreturn { init };`
    )(
        'e30=',
        'e30=',
        (name, data) => downloads.push({ name, data }),
        getUrlAsyncImpl,
        (u) => revokedUrls.push(u),
        loadScriptImpl,
        omit,
        debounce
    );

    mockWindow.pdfjsLib = {
        GlobalWorkerOptions: { workerSrc: '' },
        getDocument(opts) {
            passedDocOpts = opts;
            return {
                destroy() {},
                promise: (async () => {
                    if (opts.url === 'slow-doc') {
                        resolveSlowStarted();
                        await new Promise(resolve => {
                            releaseSlowDoc = resolve;
                        });
                    }
                    return {
                        numPages: 3,
                        destroy() {},
                        getData: async () => new Uint8Array([1, 2, 3]),
                        async getPage() {
                            return {
                                getViewport: ({ scale }) => ({ width: 200 * scale, height: 300 * scale }),
                                render() {
                                    return {
                                        cancel() {},
                                        promise: shouldFailPage
                                            ? Promise.reject(new Error('page render boom'))
                                            : Promise.resolve()
                                    };
                                }
                            };
                        }
                    };
                })()
            };
        }
    };

    const errors = [];
    let renderedCount = 0;
    const { init } = createPdfFactory();

    await runWithDomGlobals({
        window: mockWindow,
        document: mockDocument,
        getComputedStyle: mockWindow.getComputedStyle
    }, async () => {
        assert.throws(() => init(null), /container is required/);

        const pdf = init(container, {
            gap: 0,
            width: -50,
            withCredentials: false,
            url: 'https://evil.example/override.pdf',
            onRendered: () => renderedCount++,
            onError: e => errors.push(e)
        }, { withCredentials: true });
        assert.equal(pdf.getGap(), 0);
        pdf.setOptions({ gap: -5 });
        assert.equal(pdf.getGap(), 10);
        pdf.setOptions({ gap: 0 });

        const slowPromise = pdf.preview('slow-doc');
        await slowDocStarted;
        await pdf.preview('fast-doc');
        assert.equal(passedDocOpts.withCredentials, true);
        assert.equal(passedDocOpts.url, 'fast-doc');
        releaseSlowDoc();
        await slowPromise;
        assert.equal(renderedCount, 1);
        assert.equal(errors.length, 0);

        pdf.wrapper.scrollTop = 999999;
        pdf.onScroll({ target: pdf.wrapper });
        pdf.onScroll.flush();
        assert.ok(pdf.wrapperMain.children.length > 0);

        await assert.rejects(pdf.preview(''), /预览地址不能为空/);

        shouldFailPage = true;
        await assert.rejects(pdf.preview('fast-doc'), /page render boom/);

        shouldFailPage = false;
        const pdf3 = init(mockDocument.createElement('div'), {
            staticFileUrl: '',
            onError: e => errors.push(e)
        });
        pdf3.setOptions({ width: 320, staticFileUrl: '' });
        assert.equal(pdf3.options.staticFileUrl, 'https://unpkg.com/pdfjs-dist@3.1.81/');
        pdf3.setRequestOptions({ credentials: 'include', headers: { Token: 'abc' } });

        await pdf3.preview('fast-doc');
        pdf3.setOptions({ gap: 20 });
        await pdf3.rerender();
        assert.equal(pdf3.getGap(), 20);

        pdf3.save('custom.pdf');
        await new Promise(r => setTimeout(r, 10));
        assert.equal(downloads.length, 1);
        assert.equal(downloads[0].name, 'custom.pdf');
        assert.ok(downloads[0].data instanceof Blob);

        pdf3.save();
        await new Promise(r => setTimeout(r, 10));
        assert.equal(downloads.length, 2);
        assert.match(downloads[1].name, /^abner-vue-office-js-pdf-\d+\.pdf$/);

        pdf3.pdfDocument.getData = async () => {
            throw new Error('save failed');
        };
        pdf3.save();
        await new Promise(r => setTimeout(r, 10));
        assert.ok(errors.some(e => e.message === 'save failed'));

        // Genuine detached-canvas task cancellation via scroll removal
        let cancelCalled = 0;
        pdf3.pdfDocument = {
            numPages: 5,
            destroy() {},
            async getPage() {
                return {
                    getViewport: ({ scale }) => ({ width: 200 * scale, height: 300 * scale }),
                    render() {
                        let rejectFn;
                        const promise = new Promise((_, reject) => {
                            rejectFn = reject;
                        });
                        return {
                            cancel() {
                                cancelCalled++;
                                rejectFn(new Error('Rendering cancelled'));
                            },
                            promise
                        };
                    }
                };
            }
        };
        pdf3.clearAllCanvas();
        const p1 = pdf3.renderList(1, 2, false, pdf3.renderId, false);
        await new Promise(r => setTimeout(r, 10));
        const errorsBeforeScrollDetach = errors.length;
        // Jumping completely out of [1..2] cancels both in-flight tasks and suppresses rejection errors
        pdf3.renderList(4, 5, false, pdf3.renderId, false);
        await p1;
        assert.equal(cancelCalled, 2);
        assert.equal(errors.length, errorsBeforeScrollDetach);

        pdf3.destroy();
        await pdf3.rerender();
        await pdf3.preview('after-destroy');
        pdf.destroy();
    });

    // Cold-start checkPdfLib failure retry + missing pdfjsLib
    delete mockWindow.pdfjsLib;
    const { init: initRetry } = createPdfFactory(async () => {
        loadAttempt++;
        if (loadAttempt === 1) {
            throw new Error('lib load network error');
        }
        mockWindow.pdfjsLib = {
            GlobalWorkerOptions: { workerSrc: '' },
            getDocument() {
                return {
                    destroy() {},
                    promise: Promise.resolve({
                        numPages: 1,
                        destroy() {},
                        getPage: async () => ({
                            getViewport: ({ scale }) => ({ width: 200 * scale, height: 300 * scale }),
                            render: () => ({ cancel() {}, promise: Promise.resolve() })
                        })
                    })
                };
            }
        };
    }, async () => 'blob:temp-pdf');

    await runWithDomGlobals({
        window: mockWindow,
        document: mockDocument,
        getComputedStyle: mockWindow.getComputedStyle
    }, async () => {
        const pdfRetry = initRetry(mockDocument.createElement('div'));
        await assert.rejects(pdfRetry.preview('https://example.com/doc.pdf'), /lib load network error/);
        await pdfRetry.preview('https://example.com/doc.pdf');
        pdfRetry.destroy();
        assert.ok(revokedUrls.includes('blob:temp-pdf'));

        delete mockWindow.pdfjsLib;
        const { init: initMissing } = createPdfFactory(async () => {});
        const pdfMissing = initMissing(mockDocument.createElement('div'));
        await assert.rejects(pdfMissing.preview('https://example.com/doc.pdf'), /window\.pdfjsLib未找到/);
        pdfMissing.destroy();
    });

    // Entrypoint checks
    for (const pkg of ['vue-docx', 'vue-excel', 'vue-pdf', 'vue-pptx']) {
        const entrySrc = fs.readFileSync(path.join(CORE_DIR, 'packages', pkg, 'index.js'), 'utf8')
            .replace(/^\s*import\s+['"][^'"]+['"];\s*$/gm, '')
            .replace(/^\s*import\s+(\w+)\s+from\s+['"][^'"]+['"];\s*$/gm, '')
            .replace(/export\s+default\s+/, 'return ');
        const compName = `AbnerVueOffice${pkg.replace('vue-', '').replace(/^[a-z]/, c => c.toUpperCase())}`;
        const fakeComp = { name: compName };
        const comp = new Function(compName, entrySrc)(fakeComp);
        const registered = [];
        comp.install({ component: (name, def) => registered.push({ name, def }) });
        assert.deepEqual(registered[0], { name: compName, def: fakeComp });
    }
    for (const pkg of ['js-docx', 'js-excel', 'js-pdf']) {
        const entrySrc = fs.readFileSync(path.join(CORE_DIR, 'packages', pkg, 'index.js'), 'utf8')
            .replace(/^\s*import\s+\{init\}\s+from\s+['"][^'"]+['"];\s*$/gm, '')
            .replace(/export\s+default\s+/, 'return ');
        const sentinel = () => 'ok';
        const mod = new Function('init', entrySrc)(sentinel);
        assert.equal(mod.init, sentinel);
    }
});
