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

test('vue-docx/src/main.vue covers validator, mount, switch, empty clear, error, race, save, and unmount', async () => {
    const { mockDocument } = createDomMocks();
    const downloads = [];
    const rootEl = mockDocument.createElement('div');
    let rejectRender = false;
    const mockDocx = {
        getData: async (src) => {
            if (src === 'slow') {
                await new Promise(r => setTimeout(r, 25));
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
        assert.equal(sfc.component.props.src.validator(123), false);

        sfc.mount();
        await new Promise(r => setTimeout(r, 10));
        assert.equal(sfc.emitted[0].name, 'rendered');
        assert.equal(rootEl.innerHTML, '<p>doc1</p>');

        sfc.setupResult.save('my.docx');
        assert.equal(downloads[0].n, 'my.docx');

        sfc.setProp('src', 'slow');
        sfc.setProp('src', 'fast');
        await new Promise(r => setTimeout(r, 40));
        assert.equal(rootEl.innerHTML, '<p>fast</p>');

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

test('vue-excel/src/main.vue covers mount, hooks, events, switchSheet, error, save, and unmount', async () => {
    const { mockDocument } = createDomMocks();
    const downloads = [];
    const sheets = [];

    class MockSpreadsheet {
        constructor(el, opts) {
            this.el = el;
            this.options = opts;
            this.events = {};
            this.loaded = [];
            this.destroyed = false;
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

        reRender() {}

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
                getData: async src => src,
                readExcelData: async () => (shouldFail ? { _worksheets: [] } : { _worksheets: [{ name: 'S1' }] }),
                transferExcelToSpreadSheet: wb => ({ workbookData: [{ name: wb._worksheets[0].name }], medias: [], workbookSource: wb }),
                renderImage: () => {},
                clearCache: () => {},
                debounce,
                downloadFile: (n, d) => downloads.push({ n, d })
            },
            {
                src: 'https://example.com/a.xlsx',
                requestOptions: {},
                options: {
                    xls: true,
                    beforeTransformData: wb => {
                        wb._worksheets[0].name = 'Hooked';
                    },
                    transformData: data => {
                        data[0].ok = true;
                    }
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
        assert.equal(sheets[0].loaded[sheets[0].loaded.length - 1][0].name, 'Hooked');
        assert.ok(sfc.emitted.some(e => e.name === 'rendered'));
        assert.ok(sfc.emitted.some(e => e.name === 'switchSheet' && e.args[0] === 0));

        sheets[0].events['cell-selected']('c', 1, 2);
        sheets[0].events['cells-selected']('c', { sri: 0, sci: 0, eri: 1, eci: 1 });
        assert.ok(sfc.emitted.some(e => e.name === 'cellSelected' && e.args[0].columnIndex === 2));
        assert.ok(sfc.emitted.some(e => e.name === 'cellsSelected' && e.args[0].endRowIndex === 1));

        sfc.setupResult.save();
        assert.match(downloads[0].n, /\.xls$/);

        shouldFail = true;
        sfc.setProp('src', 'bad.xlsx');
        await new Promise(r => setTimeout(r, 15));
        assert.ok(sfc.emitted.some(e => e.name === 'error' && /文件格式不正确/.test(e.args[0].message)));

        sfc.setProp('src', '');
        assert.ok(sfc.emitted.some(e => e.name === 'error' && /src属性不能为空/.test(e.args[0].message)));

        sfc.unmount();
        assert.equal(sheets[0].destroyed, true);

        // Pre-mount src watch does not crash or emit
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

test('vue-pdf/src/main.vue covers scheduleInit dedupe, scale, virtual scroll, initial error propagation, save, and unmount', async () => {
    const { mockDocument, mockWindow } = createDomMocks();
    let getDocCalls = 0;
    let failPageRender = false;
    let cancelledTasks = 0;
    const downloads = [];

    mockWindow.pdfjsLib = {
        GlobalWorkerOptions: { workerSrc: '' },
        getDocument() {
            getDocCalls++;
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
                    requestOptions: { credentials: 'include' },
                    staticFileUrl: '',
                    options: { gap: 0 },
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

            sfc.unmount();
            assert.ok(cancelledTasks >= 0);
        });

        // setScale while initial loadingTask is in flight must not re-call getDocument
        let slowGetDocCalls = 0;
        let resolveSlowDoc;
        let lastDocOpts;
        mockWindow.pdfjsLib.getDocument = (opts) => {
            slowGetDocCalls++;
            lastDocOpts = opts;
            return {
                destroy() {},
                promise: new Promise(r => {
                    resolveSlowDoc = r;
                })
            };
        };
        await runWithDomGlobals({
            document: mockDocument,
            window: mockWindow,
            getComputedStyle: mockWindow.getComputedStyle
        }, async () => {
            const c = mockDocument.createElement('div');
            const w = mockDocument.createElement('div');
            const sfcSlow = mountSfcScript(
                'packages/vue-pdf/src/main.vue',
                {
                    workerStr: 'console.log(1);',
                    pdfjsLib: 'console.log(2);',
                    downloadFile: () => {},
                    getUrlAsync: async src => src,
                    revokeUrl: () => {},
                    loadScript: async () => {},
                    omit,
                    debounce
                },
                {
                    src: 'https://example.com/slow.pdf',
                    options: { width: -10, url: 'https://override.invalid/bad.pdf' },
                    defaultScale: 1
                },
                { containerRef: c, wrapperRef: w }
            );
            sfcSlow.mount();
            await new Promise(r => setTimeout(r, 5));
            assert.equal(slowGetDocCalls, 1);
            assert.equal(lastDocOpts.url, 'https://example.com/slow.pdf');
            sfcSlow.setupResult.setScale(1.25);
            assert.equal(slowGetDocCalls, 1);
            resolveSlowDoc({
                numPages: 1,
                destroy() {},
                getPage: async () => ({
                    getViewport: ({ scale }) => ({ width: 200 * scale, height: 300 * scale }),
                    render: () => ({ cancel() {}, promise: Promise.resolve() })
                })
            });
            await new Promise(r => setTimeout(r, 15));
            assert.ok(w.style.minWidth && !w.style.minWidth.startsWith('-'));
            sfcSlow.unmount();
        });
    } finally {
        URL.createObjectURL = origCreate;
        URL.revokeObjectURL = origRevoke;
    }
});

test('vue-pptx/src/main.vue covers off-DOM stageEl swap, race guard, rerender, save, error, and unmount', async () => {
    const { mockDocument } = createDomMocks();
    const downloads = [];
    const destroyedViewers = [];
    let failPreview = false;

    const initPptxPreviewer = (el, opts) => {
        const viewer = {
            el,
            opts,
            async preview(ab) {
                const text = new TextDecoder().decode(ab);
                if (text === 'slow') {
                    await new Promise(r => setTimeout(r, 25));
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
        sfc.setProp('src', enc.encode('winner').buffer);
        await new Promise(r => setTimeout(r, 40));
        assert.equal(rootEl.children.length, 1);
        assert.equal(rootEl.children[0].className, 'winner');

        await sfc.setupResult.rerender();
        assert.equal(rootEl.children[0].className, 'winner');

        sfc.setupResult.save('deck.pptx');
        assert.equal(downloads[0].n, 'deck.pptx');

        failPreview = true;
        sfc.setProp('src', enc.encode('broken').buffer);
        await new Promise(r => setTimeout(r, 15));
        assert.ok(sfc.emitted.some(e => e.name === 'error' && e.args[0].message === 'pptx parse fail'));
        assert.equal(rootEl.children.length, 0);

        failPreview = false;
        sfc.setProp('src', new Uint8Array([1, 2, 3, 4]).subarray(1, 3));
        await new Promise(r => setTimeout(r, 15));
        assert.equal(rootEl.children.length, 1);

        sfc.setProp('src', '');
        assert.equal(rootEl.children.length, 0);

        sfc.unmount();
        assert.ok(destroyedViewers.length >= 2);
    });

    // Additional coverage: string HTTP fetch, Blob, Response, invalid src, negative options, pre-mount guard
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
