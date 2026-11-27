import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
    createDomMocks,
    mountSfcScript,
    runWithDomGlobals
} from './helpers/load-module.mjs';

const require = createRequire(import.meta.url);
const debounce = require('lodash/debounce');
const omit = require('lodash/omit');

test('vue-docx/src/main.vue covers validator, mount, switch, empty clear, error, stale race, save, and unmount', async () => {
    const { mockDocument } = createDomMocks();
    const downloads = [];
    const rootEl = mockDocument.createElement('div');
    let rejectRender = false;
    let releaseSlow = null;

    const mockDocx = {
        getData: async (src) => {
            if (src === 'slow') {
                await new Promise(resolve => {
                    releaseSlow = resolve;
                });
            }
            if (src === 'fail-fetch') {
                throw new Error('fetch fail');
            }
            return src;
        },
        getBlob: async (res) => {
            if (!res || res === 'invalid-blob') return undefined;
            if (res instanceof Blob) return res;
            return new Blob([String(res)]);
        },
        render: async (blob, container, _opts, shouldCommit) => {
            if (!blob) {
                if (!shouldCommit || shouldCommit()) {
                    container.innerHTML = '';
                }
                return;
            }
            if (rejectRender) {
                throw new Error('render boom');
            }
            if (!shouldCommit || shouldCommit()) {
                container.innerHTML = `<p>${await blob.text()}</p>`;
            }
        }
    };

    await runWithDomGlobals({ document: mockDocument }, async () => {
        const sfc = mountSfcScript(
            'packages/vue-docx/src/main.vue',
            { docx: mockDocx, downloadFile: (n, d) => downloads.push({ n, d }) },
            { src: 'doc1', requestOptions: {}, options: {} },
            { rootRef: rootEl }
        );
        assert.equal(sfc.component.props.src.validator(new Response('a')), true);
        assert.equal(sfc.component.props.src.validator(new Blob(['a'])), true);
        assert.equal(sfc.component.props.src.validator(new ArrayBuffer(2)), true);
        assert.equal(sfc.component.props.src.validator(new Uint8Array([1])), true);
        assert.equal(sfc.component.props.src.validator(null), true);
        assert.equal(sfc.component.props.src.validator(123), false);

        sfc.mount();
        await new Promise(r => setTimeout(r, 10));
        assert.equal(sfc.emitted[0].name, 'rendered');
        assert.equal(rootEl.innerHTML, '<p>doc1</p>');

        sfc.setupResult.save('my.docx');
        sfc.setupResult.save();
        assert.equal(downloads[0].n, 'my.docx');
        assert.match(downloads[1].n, /^abner-vue-office-docx-\d+\.docx$/);

        sfc.setProp('src', 'slow');
        sfc.setProp('src', 'fast');
        await new Promise(r => setTimeout(r, 10));
        releaseSlow();
        await new Promise(r => setTimeout(r, 10));
        assert.equal(rootEl.innerHTML, '<p>fast</p>');

        sfc.setProp('src', 'fail-fetch');
        await new Promise(r => setTimeout(r, 10));
        assert.ok(sfc.emitted.some(e => e.name === 'error' && e.args[0].message === 'fetch fail'));

        sfc.setProp('src', 'invalid-blob');
        await new Promise(r => setTimeout(r, 10));
        assert.ok(sfc.emitted.some(e => e.name === 'error' && /Unsupported docx data/.test(e.args[0].message)));

        rejectRender = true;
        sfc.setProp('src', 'doc2');
        await new Promise(r => setTimeout(r, 10));
        assert.ok(sfc.emitted.some(e => e.name === 'error' && e.args[0].message === 'render boom'));

        rejectRender = false;
        sfc.setProp('src', '');
        await new Promise(r => setTimeout(r, 10));
        assert.equal(sfc.emitted[sfc.emitted.length - 1].name, 'rendered');

        sfc.unmount();
        sfc.setProp('src', 'after-unmount');
        await new Promise(r => setTimeout(r, 10));
        assert.equal(rootEl.innerHTML, '');

        // Clearing src before mount must not crash or emit rendered
        const unmountedSfc = mountSfcScript(
            'packages/vue-docx/src/main.vue',
            { docx: mockDocx, downloadFile: () => {} },
            { src: 'init', requestOptions: {}, options: {} }
        );
        unmountedSfc.setProp('src', '');
        await new Promise(r => setTimeout(r, 5));
        assert.equal(unmountedSfc.emitted.length, 0);
    });
});

test('vue-excel/src/main.vue covers mount, swapFunc, table.render -> renderImage, hooks, error, save, and unmount', async () => {
    const { mockDocument } = createDomMocks();
    const downloads = [];
    const sheets = [];
    const renderImageCalls = [];
    let releasedGetData = null;

    class MockSpreadsheet {
        constructor(el, opts) {
            this.el = el;
            this.options = opts;
            this.events = {};
            this.loaded = [];
            this.destroyed = false;
            this.reRenderCount = 0;
            this.datas = [
                { getSelectedRect: () => ({ scroll: { x: 0, y: 0 } }) },
                { getSelectedRect: () => ({ scroll: { x: 5, y: 6 } }) }
            ];
            this.bottombar = { swapFunc: () => {} };
            this.sheet = {
                data: { getSelectedRect: () => ({ scroll: { x: 0, y: 0 } }) },
                table: { render: () => {} },
                editor: { setOffset: () => {} }
            };
            el.appendChild(mockDocument.createElement('canvas'));
            sheets.push(this);
        }

        loadData(d) {
            this.loaded.push(d);
            return this;
        }

        on(n, cb) {
            this.events[n] = cb;
            return this;
        }

        reRender() {
            this.reRenderCount++;
        }

        destroy() {
            this.destroyed = true;
        }
    }

    let shouldFail = false;
    await runWithDomGlobals({ document: mockDocument }, async () => {
        const sfc = mountSfcScript(
            'packages/vue-excel/src/main.vue',
            {
                Spreadsheet: MockSpreadsheet,
                getData: async (src) => {
                    if (src === 'slow.xlsx') {
                        return new Promise(resolve => {
                            releasedGetData = resolve;
                        });
                    }
                    return src;
                },
                readExcelData: async () => (shouldFail ? { _worksheets: [] } : { _worksheets: [{ name: 'S1' }, { name: 'S2' }] }),
                transferExcelToSpreadSheet: wb => ({ workbookData: [{ name: wb._worksheets[0].name }], medias: [{ id: 0 }], workbookSource: wb }),
                renderImage: (_ctx, _medias, sheet, _offset, _opts, shouldDraw) => {
                    renderImageCalls.push({ sheetName: sheet.name, shouldDraw: shouldDraw() });
                },
                clearCache: () => {},
                debounce,
                downloadFile: (n, d) => downloads.push({ n, d })
            },
            {
                src: 'https://example.com/a.xlsx',
                requestOptions: {},
                options: {
                    xls: false,
                    beforeTransformData: wb => ({ _worksheets: [{ name: `${wb._worksheets[0].name}-Replaced` }, { name: 'S2' }] }),
                    transformData: data => [{ ...data[0], ok: true }]
                }
            },
            {
                wrapperRef: mockDocument.createElement('div'),
                rootRef: mockDocument.createElement('div')
            }
        );

        sfc.mount();
        await new Promise(r => setTimeout(r, 15));
        assert.equal(sheets[0].options.evalPaused, true);
        assert.equal(sheets[0].loaded[sheets[0].loaded.length - 1][0].name, 'S1-Replaced');
        assert.equal(sheets[0].loaded[sheets[0].loaded.length - 1][0].ok, true);
        assert.ok(sfc.emitted.some(e => e.name === 'rendered'));
        assert.ok(sfc.emitted.some(e => e.name === 'switchSheet' && e.args[0] === 0));

        // table.render triggers renderImageDebounce -> renderImage
        sheets[0].sheet.table.render();
        assert.equal(renderImageCalls.length, 1);
        assert.equal(renderImageCalls[0].shouldDraw, true);

        // bottombar.swapFunc switches sheet and emits switchSheet(1) without redundant double render
        sheets[0].bottombar.swapFunc(1);
        await new Promise(r => setTimeout(r, 15));
        assert.ok(sfc.emitted.some(e => e.name === 'switchSheet' && e.args[0] === 1));

        sheets[0].events['cell-selected']('c', 1, 2);
        sheets[0].events['cells-selected']('c', { sri: 0, sci: 0, eri: 1, eci: 1 });
        assert.ok(sfc.emitted.some(e => e.name === 'cellSelected' && e.args[0].columnIndex === 2));
        assert.ok(sfc.emitted.some(e => e.name === 'cellsSelected' && e.args[0].endRowIndex === 1));

        sfc.setupResult.save();
        assert.match(downloads[0].n, /\.xlsx$/);

        // Slow request superseded by newer src must be ignored when resolved
        const renderedBeforeRace = sfc.emitted.filter(e => e.name === 'rendered').length;
        const loadedBeforeRace = sheets[0].loaded.length;
        sfc.setProp('src', 'slow.xlsx');
        sfc.setProp('src', 'winner.xlsx');
        await new Promise(r => setTimeout(r, 15));
        assert.equal(sfc.emitted.filter(e => e.name === 'rendered').length, renderedBeforeRace + 1);
        assert.equal(sheets[0].loaded.length, loadedBeforeRace + 1);
        releasedGetData(new ArrayBuffer(4));
        await new Promise(r => setTimeout(r, 10));
        assert.equal(sfc.emitted.filter(e => e.name === 'rendered').length, renderedBeforeRace + 1);
        assert.equal(sheets[0].loaded.length, loadedBeforeRace + 1);

        shouldFail = true;
        sfc.setProp('src', 'bad.xlsx');
        await new Promise(r => setTimeout(r, 15));
        assert.ok(sfc.emitted.some(e => e.name === 'error' && /文件格式不正确/.test(e.args[0].message)));

        sfc.setProp('src', '');
        assert.ok(sfc.emitted.some(e => e.name === 'error' && /src属性不能为空/.test(e.args[0].message)));

        sfc.unmount();
        assert.equal(sheets[0].destroyed, true);

        const preSfc = mountSfcScript(
            'packages/vue-excel/src/main.vue',
            {
                Spreadsheet: MockSpreadsheet,
                getData: async src => src,
                readExcelData: async () => ({ _worksheets: [] }),
                transferExcelToSpreadSheet: wb => ({ workbookData: [], medias: [], workbookSource: wb }),
                renderImage: () => {},
                clearCache: () => {},
                debounce,
                downloadFile: () => {}
            },
            { src: 'a.xlsx', requestOptions: {}, options: {} }
        );
        preSfc.setProp('src', '');
        assert.equal(preSfc.emitted.length, 0);
    });
});

test('vue-pdf/src/main.vue covers cold-start checkPdfLib, withCredentials, setScale during load, unmount task cancel, and save', async () => {
    const { mockDocument, mockWindow } = createDomMocks();
    let getDocCalls = 0;
    let lastDocOpts = null;
    let failPageRender = false;
    let cancelledTasks = 0;
    let releaseDeferredRender = null;
    const downloads = [];

    mockWindow.pdfjsLib = {
        GlobalWorkerOptions: { workerSrc: '' },
        getDocument(opts) {
            getDocCalls++;
            lastDocOpts = opts;
            return {
                destroy() {},
                promise: Promise.resolve({
                    numPages: 4,
                    destroy() {},
                    getData: async () => new Uint8Array([1, 2]),
                    async getPage() {
                        return {
                            getViewport: ({ scale }) => ({ width: 200 * scale, height: 300 * scale }),
                            render() {
                                if (releaseDeferredRender) {
                                    let rejectFn;
                                    const p = new Promise((_res, rej) => {
                                        rejectFn = rej;
                                    });
                                    releaseDeferredRender();
                                    return {
                                        cancel() {
                                            cancelledTasks++;
                                            rejectFn(new Error('cancelled on unmount'));
                                        },
                                        promise: p
                                    };
                                }
                                return {
                                    cancel() {
                                        cancelledTasks++;
                                    },
                                    promise: failPageRender
                                        ? Promise.reject(new Error('pdf page fail'))
                                        : Promise.resolve()
                                };
                            }
                        };
                    }
                })
            };
        }
    };

    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = () => 'blob:worker';
    URL.revokeObjectURL = () => {};

    try {
        await runWithDomGlobals({
            document: mockDocument,
            window: mockWindow,
            getComputedStyle: mockWindow.getComputedStyle
        }, async () => {
            const container = mockDocument.createElement('div');
            const wrapper = mockDocument.createElement('div');
            const sfc = mountSfcScript(
                'packages/vue-pdf/src/main.vue',
                {
                    workerStr: 'console.log(1);',
                    pdfjsLib: 'console.log(2);',
                    downloadFile: (n, d) => downloads.push({ n, d }),
                    getUrlAsync: async src => src,
                    revokeUrl: () => {},
                    loadScript: async () => {},
                    omit,
                    debounce
                },
                {
                    src: 'https://example.com/a.pdf',
                    requestOptions: { withCredentials: true },
                    staticFileUrl: '',
                    options: { gap: 0, withCredentials: false },
                    defaultScale: 1
                },
                {
                    containerRef: container,
                    wrapperRef: wrapper
                }
            );

            sfc.mount();
            await new Promise(r => setTimeout(r, 15));
            assert.equal(getDocCalls, 1);
            assert.equal(lastDocOpts.withCredentials, true);
            assert.ok(sfc.emitted.some(e => e.name === 'rendered'));
            assert.equal(sfc.setupResult.getScale(), 1);

            sfc.setupResult.setScale(NaN);
            assert.equal(sfc.setupResult.getScale(), 1);
            sfc.setupResult.setScale(1.5);
            await new Promise(r => setTimeout(r, 15));
            assert.equal(sfc.setupResult.getScale(), 1.5);

            container.scrollTop = 999999;
            sfc.setupResult.onScrollPdf({ target: container });
            sfc.setupResult.onScrollPdf.flush();
            assert.ok(wrapper.children.length > 0);

            failPageRender = true;
            sfc.setProp('src', 'https://example.com/fail.pdf');
            await new Promise(r => setTimeout(r, 20));
            const failErrors = sfc.emitted.filter(e => e.name === 'error' && e.args[0].message === 'pdf page fail');
            assert.equal(failErrors.length, 1);
            assert.equal(wrapper.innerHTML, '');

            failPageRender = false;
            sfc.setProp('src', 'https://example.com/ok2.pdf');
            await new Promise(r => setTimeout(r, 20));
            await sfc.setupResult.rerender();
            sfc.setupResult.save('out.pdf');
            await new Promise(r => setTimeout(r, 10));
            assert.equal(downloads.length, 1);
            assert.equal(downloads[0].n, 'out.pdf');

            sfc.setProp('defaultScale', 2);
            await new Promise(r => setTimeout(r, 15));
            assert.equal(sfc.setupResult.getScale(), 2);

            // Clearing src emits 'src不能为空'
            sfc.setProp('src', '');
            assert.ok(sfc.emitted.some(e => e.name === 'error' && /src不能为空/.test(e.args[0].message)));

            // Mount with in-flight render task and unmount -> must cancel active task
            cancelledTasks = 0;
            let resolveStarted;
            const renderStarted = new Promise(r => {
                resolveStarted = r;
            });
            releaseDeferredRender = resolveStarted;
            sfc.setProp('src', 'https://example.com/cancel-on-unmount.pdf');
            await renderStarted;
            sfc.unmount();
            assert.ok(cancelledTasks >= 1);
            releaseDeferredRender = null;
        });

        // Cold-start checkPdfLib + setScale before loadingTask created must NOT duplicate getDocument calls
        delete mockWindow.pdfjsLib;
        let loadScriptCount = 0;
        let releaseScriptLoad = null;
        let slowGetDocCalls = 0;
        await runWithDomGlobals({
            document: mockDocument,
            window: mockWindow,
            getComputedStyle: mockWindow.getComputedStyle
        }, async () => {
            const c = mockDocument.createElement('div');
            const w = mockDocument.createElement('div');
            const sfcCold = mountSfcScript(
                'packages/vue-pdf/src/main.vue',
                {
                    workerStr: 'console.log(1);',
                    pdfjsLib: 'console.log(2);',
                    downloadFile: () => {},
                    getUrlAsync: async src => src,
                    revokeUrl: () => {},
                    loadScript: () => {
                        loadScriptCount++;
                        return new Promise(resolve => {
                            releaseScriptLoad = () => {
                                mockWindow.pdfjsLib = {
                                    GlobalWorkerOptions: { workerSrc: '' },
                                    getDocument() {
                                        slowGetDocCalls++;
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
                                resolve();
                            };
                        });
                    },
                    omit,
                    debounce
                },
                {
                    src: 'https://example.com/cold.pdf',
                    options: { width: -10, url: 'https://override.invalid/bad.pdf' },
                    defaultScale: 1
                },
                { containerRef: c, wrapperRef: w }
            );
            sfcCold.mount();
            assert.equal(loadScriptCount, 1);
            sfcCold.setupResult.setScale(1.25);
            releaseScriptLoad();
            await new Promise(r => setTimeout(r, 20));
            assert.equal(slowGetDocCalls, 1);
            assert.ok(w.style.minWidth && !w.style.minWidth.startsWith('-'));
            sfcCold.unmount();
        });
    } finally {
        URL.createObjectURL = origCreate;
        URL.revokeObjectURL = origRevoke;
    }
});

test('vue-pptx/src/main.vue covers off-DOM stageEl swap, race guard, sync rerender throw, save, error, and unmount', async () => {
    const { mockDocument } = createDomMocks();
    const downloads = [];
    const destroyedViewers = [];
    let failPreview = false;
    let failSyncCreate = false;
    let releaseSlow = null;
    let resolveSlowStarted = null;
    const slowPreviewStarted = new Promise(r => {
        resolveSlowStarted = r;
    });

    const initPptxPreviewer = (el, opts) => {
        if (failSyncCreate) {
            throw new Error('sync create boom');
        }
        const viewer = {
            el,
            opts,
            async preview(ab) {
                const text = new TextDecoder().decode(ab);
                if (text === 'slow') {
                    resolveSlowStarted();
                    await new Promise(resolve => {
                        releaseSlow = resolve;
                    });
                }
                if (failPreview) {
                    throw new Error('pptx parse fail');
                }
                const slide = mockDocument.createElement('div');
                slide.className = text;
                el.appendChild(slide);
                return { slideCount: 1, tag: text };
            },
            destroy() {
                destroyedViewers.push(viewer);
            }
        };
        return viewer;
    };

    await runWithDomGlobals({ document: mockDocument }, async () => {
        const rootEl = mockDocument.createElement('div');
        const enc = new TextEncoder();
        const sfc = mountSfcScript(
            'packages/vue-pptx/src/main.vue',
            {
                initPptxPreviewer,
                downloadFile: (n, d) => downloads.push({ n, d }),
                normalizeFetchOptions: opts => opts || {}
            },
            {
                src: enc.encode('first').buffer,
                requestOptions: {},
                options: { width: 800, height: 450 }
            },
            { rootRef: rootEl }
        );

        sfc.mount();
        await new Promise(r => setTimeout(r, 15));
        assert.equal(rootEl.children.length, 1);
        assert.equal(rootEl.children[0].className, 'first');
        assert.equal(sfc.emitted[0].name, 'rendered');

        sfc.setProp('src', enc.encode('slow').buffer);
        await slowPreviewStarted;
        sfc.setProp('src', enc.encode('winner').buffer);
        await new Promise(r => setTimeout(r, 15));
        releaseSlow();
        await new Promise(r => setTimeout(r, 10));
        assert.equal(rootEl.children.length, 1);
        assert.equal(rootEl.children[0].className, 'winner');

        await sfc.setupResult.rerender();
        assert.equal(rootEl.children[0].className, 'winner');

        // Synchronous error inside createViewer during rerender() emits 'error' instead of throwing
        failSyncCreate = true;
        await sfc.setupResult.rerender();
        assert.ok(sfc.emitted.some(e => e.name === 'error' && e.args[0].message === 'sync create boom'));
        failSyncCreate = false;

        failPreview = true;
        sfc.setProp('src', enc.encode('broken').buffer);
        await new Promise(r => setTimeout(r, 15));
        assert.ok(sfc.emitted.some(e => e.name === 'error' && e.args[0].message === 'pptx parse fail'));
        assert.equal(rootEl.children.length, 0);

        failPreview = false;
        sfc.setProp('src', new Uint8Array([1, 2, 3, 4]).subarray(1, 3));
        await new Promise(r => setTimeout(r, 15));
        assert.equal(rootEl.children.length, 1);

        sfc.setupResult.save('deck.pptx');
        sfc.setupResult.save();
        assert.equal(downloads[0].n, 'deck.pptx');
        assert.match(downloads[1].n, /^abner-vue-office-pptx-\d+\.pptx$/);

        sfc.setProp('src', '');
        assert.equal(rootEl.children.length, 0);

        sfc.unmount();
        assert.ok(destroyedViewers.length >= 2);
    });

    await runWithDomGlobals({
        document: mockDocument,
        fetch: async (url) => ({
            ok: !url.includes('404'),
            status: url.includes('404') ? 404 : 200,
            arrayBuffer: async () => new TextEncoder().encode(`fetched:${url}`).buffer
        })
    }, async () => {
        const root2 = mockDocument.createElement('div');
        const seenOpts = [];
        const sfc2 = mountSfcScript(
            'packages/vue-pptx/src/main.vue',
            {
                initPptxPreviewer: (el, opts) => {
                    seenOpts.push(opts);
                    return initPptxPreviewer(el, opts);
                },
                downloadFile: () => {},
                normalizeFetchOptions: opts => opts || {}
            },
            { src: 'https://example.com/ok.pptx', options: { width: -100, height: NaN } },
            { rootRef: root2 }
        );
        sfc2.mount();
        await new Promise(r => setTimeout(r, 15));
        assert.equal(seenOpts[0].width, 800);
        assert.equal(seenOpts[0].height, 600);

        sfc2.setProp('src', new Blob([new TextEncoder().encode('from-blob')]));
        await new Promise(r => setTimeout(r, 15));
        assert.equal(root2.children[0].className, 'from-blob');

        sfc2.setProp('src', new Response(new TextEncoder().encode('from-resp')));
        await new Promise(r => setTimeout(r, 15));
        assert.equal(root2.children[0].className, 'from-resp');

        sfc2.setProp('src', 'https://example.com/404.pptx');
        await new Promise(r => setTimeout(r, 15));
        assert.ok(sfc2.emitted.some(e => e.name === 'error' && /404/.test(e.args[0].message)));

        sfc2.setProp('src', { invalid: true });
        await new Promise(r => setTimeout(r, 15));
        assert.ok(sfc2.emitted.some(e => e.name === 'error' && /不支持/.test(e.args[0].message)));

        sfc2.unmount();

        const prePptx = mountSfcScript(
            'packages/vue-pptx/src/main.vue',
            { initPptxPreviewer, downloadFile: () => {}, normalizeFetchOptions: opts => opts || {} },
            { src: 'a.pptx' }
        );
        prePptx.setProp('src', 'b.pptx');
        assert.equal(prePptx.emitted.length, 0);
    });
});
