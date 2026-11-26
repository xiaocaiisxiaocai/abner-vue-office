import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { isXlsName } from '../src/hooks/usePreview.js';
import { createDomMocks, runWithDomGlobals, loadStrippedModule } from './helpers/load-module.mjs';

const require = createRequire(import.meta.url);
const debounce = require('lodash/debounce');
const omit = require('lodash/omit');

test('usePreview, useLoading, and docx hack.js work in browser and SSR safely', async () => {
    assert.equal(isXlsName('report.xls'), true);
    assert.equal(isXlsName('https://example.com/report.XLS?token=1#hash'), true);
    assert.equal(isXlsName('report.xlsx'), false);
    assert.equal(isXlsName(null), false);

    await runWithDomGlobals({ window: undefined }, async () => {
        await import(`../packages/vue-docx/src/hack.js?ssr=${Date.now()}`);
        await import(`../packages/js-docx/src/hack.js?ssr=${Date.now()}`);
    });

    const mockWin = {};
    await runWithDomGlobals({ window: mockWin }, async () => {
        await import(`../packages/vue-docx/src/hack.js?browser=${Date.now()}`);
        assert.equal(typeof mockWin.setImmediate, 'function');
        const customImm = () => 99;
        mockWin.setImmediate = customImm;
        await import(`../packages/js-docx/src/hack.js?preserve=${Date.now()}`);
        assert.equal(mockWin.setImmediate, customImm);
    });

    let hideCalls = 0;
    const shown = [];
    const useLoading = loadStrippedModule('src/hooks/useLoading.js', {
        message: {
            loading: (content) => {
                shown.push(content);
                return () => hideCalls++;
            }
        },
        ref: v => ({ value: v })
    });
    useLoading.hideLoading();
    assert.equal(hideCalls, 0);
    useLoading.showLoading('Loading 1');
    useLoading.showLoading('Loading 2');
    assert.equal(hideCalls, 1);
    assert.equal(useLoading.loading.value, true);
    useLoading.hideLoading();
    assert.equal(hideCalls, 2);
    assert.equal(useLoading.loading.value, false);

    class MockFileReader {
        readAsArrayBuffer(file) {
            MockFileReader.last = this;
            this.file = file;
        }
    }
    const usePreviewFactory = loadStrippedModule('src/hooks/usePreview.js', { ref: v => ({ value: v }) });
    await runWithDomGlobals({ FileReader: MockFileReader }, () => {
        const state = usePreviewFactory('https://example.com/init.xls');
        assert.equal(state.xls.value, true);
        const keep = state.beforeUpload({ name: 'upload.xlsx' });
        assert.equal(keep, false);
        assert.equal(state.xls.value, false);
        const buf = new ArrayBuffer(8);
        MockFileReader.last.onload({ target: { result: buf } });
        assert.equal(state.src.value, buf);
        MockFileReader.last.onerror(new Error('read fail'));
    });
});

test('vue-docx/src/docx.js validates data and serializes container commits', async () => {
    const events = [];
    const { mockDocument } = createDomMocks();
    const container = mockDocument.createElement('div');

    const docxHelper = loadStrippedModule('packages/vue-docx/src/docx.js', {
        normalizeFetchOptions: opts => opts || {},
        parseAsync: async (blob) => {
            const txt = await blob.text();
            events.push(`parse:${txt}`);
            return { txt };
        },
        renderDocument: async (doc, target) => {
            events.push(`commit:${doc.txt}`);
            target.innerHTML = `<p>${doc.txt}</p>`;
        }
    });

    await assert.rejects(docxHelper.render({ invalid: true }, container), /Unsupported docx data/);
    assert.equal(container.innerHTML, '');

    let committed = false;
    await docxHelper.render(new Blob(['stale']), container, {}, () => committed);
    assert.equal(container.innerHTML, '');
    assert.deepEqual(events, ['parse:stale']);

    await docxHelper.render(new Blob(['fresh']), container, {}, () => true);
    assert.equal(container.innerHTML, '<p>fresh</p>');
    assert.deepEqual(events, ['parse:stale', 'parse:fresh', 'commit:fresh']);
});

test('js-docx/src/main.js constructor, setOptions merge, error handling, and destroy', async () => {
    const { mockDocument } = createDomMocks();
    const mockDocxApi = {
        getData: async (src) => {
            if (src === 'slow') {
                await new Promise(r => setTimeout(r, 30));
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
            if (!shouldCommit || shouldCommit()) {
                target.innerHTML = `rendered:${JSON.stringify(opts)}`;
            }
        }
    };

    const { init } = await runWithDomGlobals({ document: mockDocument }, async () => {
        const modSrc = `
            ${(await import('node:fs')).readFileSync(path.resolve('packages/js-docx/src/main.js'), 'utf8')
        .replace(/^\s*import\s+[\s\S]*?;\s*$/gm, '')
        .replace(/export\s+function\s+init/g, 'function init')}
            return { init };
        `;
        return new Function('docx', 'downloadFile', modSrc)(mockDocxApi, () => {});
    });

    assert.throws(() => init(null), /container is required/);

    await runWithDomGlobals({ document: mockDocument }, async () => {
        const downloaded = [];
        const { init: init2 } = await (async () => {
            const modSrc = `
                ${(await import('node:fs')).readFileSync(path.resolve('packages/js-docx/src/main.js'), 'utf8')
        .replace(/^\s*import\s+[\s\S]*?;\s*$/gm, '')
        .replace(/export\s+function\s+init/g, 'function init')}
                return { init };
            `;
            return new Function('docx', 'downloadFile', modSrc)(mockDocxApi, (name, data) => downloaded.push({ name, data }));
        })();

        const containerOk = mockDocument.createElement('div');
        const inst = init2(containerOk, { inWrapper: true }, { method: 'GET' });
        inst.setOptions({ ignoreFonts: true });
        inst.setRequestOptions({ headers: { 'X-Auth': '1' } });
        assert.deepEqual(inst.options, { inWrapper: true, ignoreFonts: true });
        assert.deepEqual(inst.requestOptions, { headers: { 'X-Auth': '1' } });

        await assert.rejects(inst.preview(''), /预览地址不能为空/);
        await assert.rejects(inst.preview({ bad: 1 }), /Unsupported docx data/);

        const freshBlob = new Blob(['fresh-doc']);
        await inst.preview(freshBlob);
        assert.match(containerOk.innerHTML || containerOk.children[0].children[0].innerHTML, /ignoreFonts/);
        inst.save('custom.docx');
        assert.equal(downloaded[0].name, 'custom.docx');
        assert.equal(downloaded[0].data, freshBlob);

        let getDataCalls = 0;
        const slowInst = init2(mockDocument.createElement('div'));
        const slowP = slowInst.preview('slow');
        const fastBlob = new Blob(['winner']);
        await slowInst.preview(fastBlob);
        await slowP;
        assert.equal(slowInst.fileData, fastBlob);

        slowInst.destroy();
        mockDocxApi.getData = async () => {
            getDataCalls++;
            return freshBlob;
        };
        await slowInst.preview('after-destroy');
        assert.equal(getDataCalls, 0);
        assert.equal(slowInst.isDestroyed, true);
        assert.deepEqual(slowInst.options, {});
        assert.deepEqual(slowInst.requestOptions, {});
    });
});

test('js-pdf/src/main.js handles gap:0, superseded preview, destroy during getPageSize, onScroll clamp, and render errors', async () => {
    const { mockDocument, mockWindow } = createDomMocks();
    const container = mockDocument.createElement('div');
    const fsMod = await import('node:fs');
    const mainSrc = fsMod.readFileSync(path.resolve('packages/js-pdf/src/main.js'), 'utf8')
        .replace(/^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"];\s*$/gm, '')
        .replace(/export\s+function\s+init/g, 'function init');
    const { init } = new Function(
        'workerStr', 'pdfLibJsStr', 'downloadFile', 'getUrlAsync', 'revokeUrl', 'loadScript', 'omit', 'debounce',
        `${mainSrc}\nreturn { init };`
    )(
        'e30=',
        'e30=',
        () => {},
        async src => src,
        () => {},
        async () => {},
        omit,
        debounce
    );

    const errors = [];
    let renderedCount = 0;
    let shouldFailPage = false;

    mockWindow.pdfjsLib = {
        GlobalWorkerOptions: { workerSrc: '' },
        getDocument({ url }) {
            return {
                destroy() {},
                promise: (async () => {
                    if (url === 'slow-doc') {
                        await new Promise(r => setTimeout(r, 25));
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

    await runWithDomGlobals({
        window: mockWindow,
        document: mockDocument,
        getComputedStyle: mockWindow.getComputedStyle
    }, async () => {
        const pdf = init(container, {
            gap: 0,
            onRendered: () => renderedCount++,
            onError: e => errors.push(e)
        });
        assert.equal(pdf.getGap(), 0);

        const slowPromise = pdf.preview('slow-doc');
        await pdf.preview('fast-doc');
        await slowPromise;
        assert.equal(renderedCount, 1);
        assert.equal(errors.length, 0);

        pdf.wrapper.scrollTop = 999999;
        pdf.onScroll({ target: pdf.wrapper });
        pdf.onScroll.flush();
        assert.ok(pdf.wrapperMain.children.length > 0);

        shouldFailPage = true;
        await assert.rejects(pdf.preview('fast-doc'), /page render boom/);
        assert.equal(errors.length, 1);

        shouldFailPage = false;
        const downloads = [];
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

        pdf3.wrapper.scrollTop = 2000;
        pdf3.renderList(2, 3, false, pdf3.renderId, false);
        pdf3.renderList(1, 2, false, pdf3.renderId, false);
        assert.ok(pdf3.wrapperMain.children.length >= 2);

        const origGetPage = pdf3.pdfDocument.getPage;
        pdf3.pdfDocument.getPage = async () => ({
            getViewport: ({ scale }) => ({ width: 400 * scale, height: 150 * scale }),
            render: () => ({ cancel() {}, promise: Promise.resolve() })
        });
        await pdf3.renderSinglePage(2, pdf3.wrapperMain.children[0], pdf3.renderId);
        pdf3.pdfDocument.getPage = origGetPage;

        pdf3.save('custom.pdf');
        await new Promise(r => setTimeout(r, 5));
        pdf3.pdfDocument.getData = async () => {
            throw new Error('save failed');
        };
        pdf3.save();
        await new Promise(r => setTimeout(r, 5));
        assert.ok(errors.some(e => e.message === 'save failed'));

        pdf3.destroy();
        await pdf3.rerender();
        await pdf3.preview('after-destroy');
        assert.equal(downloads.length, 0);
        pdf.destroy();
    });

    const container2 = mockDocument.createElement('div');
    let resolvePage;
    mockWindow.pdfjsLib.getDocument = () => ({
        destroy() {},
        promise: Promise.resolve({
            numPages: 1,
            destroy() {},
            getPage: () => new Promise(r => {
                resolvePage = r;
            })
        })
    });
    await runWithDomGlobals({
        window: mockWindow,
        document: mockDocument,
        getComputedStyle: mockWindow.getComputedStyle
    }, async () => {
        const pdf2 = init(container2);
        const p = pdf2.preview('mid-destroy');
        await new Promise(r => setTimeout(r, 5));
        pdf2.destroy();
        resolvePage({
            getViewport: ({ scale }) => ({ width: 100 * scale, height: 100 * scale })
        });
        await p;
    });
});
