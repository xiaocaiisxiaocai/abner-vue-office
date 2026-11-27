import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import {
    CORE_DIR,
    createDeferred,
    createDomMocks,
    mountSfcScript,
    runWithDomGlobals
} from './helpers/load-module.mjs';

const require = createRequire(import.meta.url);
const debounce = require('lodash/debounce');
const omit = require('lodash/omit');

test('vue-pdf/src/main.vue covers validator, options.defaultScale precedence, cold-start failure retry, blob revocation, virtual scroll up/down, mixed pages, dpr>2, save/rerender', async () => {
    const { mockDocument, mockWindow } = createDomMocks();
    const revokedUrls = [];
    const createdUrls = [];
    const downloads = [];
    let failGetData = false;
    let loadAttempt = 0;

    mockWindow.devicePixelRatio = 3;

    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = (b) => {
        const u = `blob:pdf-${createdUrls.length + 1}`;
        createdUrls.push({ u, b });
        return u;
    };
    URL.revokeObjectURL = (u) => {
        revokedUrls.push(u);
    };

    try {
        // SSR validator check without Blob/Response
        await runWithDomGlobals({ Blob: undefined, Response: undefined }, () => {
            const ssrSfc = mountSfcScript('packages/vue-pdf/src/main.vue', {
                workerStr: '',
                pdfjsLib: '',
                downloadFile: () => {},
                getUrlAsync: async s => s,
                revokeUrl: () => {},
                loadScript: async () => {},
                omit,
                debounce
            }, { src: null, defaultScale: NaN, options: { defaultScale: 1.25 } });
            assert.equal(ssrSfc.component.props.src.validator('abc'), true);
            assert.equal(ssrSfc.component.props.src.validator(new ArrayBuffer(2)), true);
            assert.equal(ssrSfc.component.props.src.validator(123), false);
            assert.equal(ssrSfc.setupResult.getScale(), 1.25);

            // watch(src) pre-mount no-op
            ssrSfc.setProp('src', 'https://example.com/pre.pdf');
            assert.equal(ssrSfc.emitted.length, 0);
        });

        await runWithDomGlobals({
            document: mockDocument,
            window: mockWindow,
            getComputedStyle: mockWindow.getComputedStyle
        }, async () => {
            let docCount = 0;
            const c = mockDocument.createElement('div');
            const w = mockDocument.createElement('div');
            c.clientHeight = 200;

            // Missing window.pdfjsLib error -> retry -> success -> virtual scroll UP/DOWN -> mixed page aspect
            delete mockWindow.pdfjsLib;
            const renderCalls = [];
            const sfc = mountSfcScript(
                'packages/vue-pdf/src/main.vue',
                {
                    workerStr: 'console.log(1);',
                    pdfjsLib: 'console.log(2);',
                    downloadFile: (n, d) => downloads.push({ n, d }),
                    getUrlAsync: async (src) => (src instanceof Uint8Array ? URL.createObjectURL(new Blob([src])) : src),
                    revokeUrl: (u) => revokedUrls.push(u),
                    loadScript: async () => {
                        loadAttempt++;
                        if (loadAttempt === 1) {
                            throw new Error('cold script err');
                        }
                        if (loadAttempt === 2) {
                            // simulate script ran without defining window.pdfjsLib
                            return;
                        }
                        mockWindow.pdfjsLib = {
                            GlobalWorkerOptions: { workerSrc: '' },
                            getDocument(opts) {
                                docCount++;
                                return {
                                    destroy() { throw new Error('ignore destroy'); },
                                    promise: Promise.resolve({
                                        numPages: 12,
                                        opts,
                                        destroy() {},
                                        getData: async () => {
                                            if (failGetData) throw new Error('getData boom');
                                            return new Uint8Array([9, 8]);
                                        },
                                        async getPage(num) {
                                            return {
                                                getViewport: ({ scale }) => ({
                                                    width: 200 * scale,
                                                    height: (num === 2 ? 150 : 300) * scale
                                                }),
                                                render(cfg) {
                                                    renderCalls.push({ num, transform: cfg.transform });
                                                    return { cancel() {}, promise: Promise.resolve() };
                                                }
                                            };
                                        }
                                    })
                                };
                            }
                        };
                    },
                    omit,
                    debounce
                },
                {
                    src: new Uint8Array([1, 2, 3]),
                    requestOptions: { credentials: 'include' },
                    staticFileUrl: 'https://cdn.test/pdfjs',
                    options: { gap: 10 },
                    defaultScale: 0
                },
                { containerRef: c, wrapperRef: w }
            );

            assert.equal(sfc.setupResult.getScale(), 1);
            sfc.mount();
            await new Promise(r => setTimeout(r, 15));
            assert.ok(sfc.emitted.some(e => e.name === 'error' && /cold script err/.test(e.args[0].message)));

            // Second attempt: missing window.pdfjsLib
            sfc.setupResult.setScale(1.2);
            await new Promise(r => setTimeout(r, 15));
            assert.ok(sfc.emitted.some(e => e.name === 'error' && /window\.pdfjsLib未找到/.test(e.args[0].message)));

            // Third attempt succeeds
            sfc.setProp('src', new Uint8Array([4, 5, 6]));
            await new Promise(r => setTimeout(r, 20));
            assert.equal(docCount, 1);
            // dpr=3 -> outputScale = 1.5; mixed page 2 adjusted canvas.width
            assert.ok(renderCalls.some(r => r.transform && r.transform[0] === 1.5));
            const canvas2 = w.children.find(ch => ch.getAttribute('data-id') === '2');
            assert.ok(canvas2 && canvas2.style.width);

            // Incremental scroll DOWN then scroll UP (insertBefore branch)
            c.scrollTop = 4500;
            sfc.setupResult.onScrollPdf({ target: c });
            sfc.setupResult.onScrollPdf.flush();
            await new Promise(r => setTimeout(r, 10));
            const maxVisible = Math.max(...w.children.map(ch => +ch.getAttribute('data-id')));
            assert.ok(maxVisible >= 6);

            c.scrollTop = 1000;
            sfc.setupResult.onScrollPdf({ target: c });
            sfc.setupResult.onScrollPdf.flush();
            await new Promise(r => setTimeout(r, 10));
            const minVisible = Math.min(...w.children.map(ch => +ch.getAttribute('data-id')));
            assert.ok(minVisible <= 3);

            // Empty src resets wrapper style & emits error
            sfc.setProp('src', '');
            assert.equal(w.style.height, '');
            assert.equal(w.style.minWidth, '');

            // Save default filename + error path
            sfc.setProp('src', new Uint8Array([7, 8]));
            await new Promise(r => setTimeout(r, 20));
            sfc.setupResult.save();
            await new Promise(r => setTimeout(r, 10));
            assert.match(downloads[0].n, /^abner-vue-office-pdf-\d+\.pdf$/);

            failGetData = true;
            sfc.setupResult.save();
            await new Promise(r => setTimeout(r, 10));
            assert.ok(sfc.emitted.some(e => e.name === 'error' && e.args[0].message === 'getData boom'));

            // Watching options.defaultScale triggers rescale
            sfc.setProp('options', { gap: 10, defaultScale: 2 });
            await new Promise(r => setTimeout(r, 15));
            assert.equal(sfc.setupResult.getScale(), 2);

            sfc.unmount();
            assert.ok(revokedUrls.length >= 2);
        });
    } finally {
        URL.createObjectURL = origCreate;
        URL.revokeObjectURL = origRevoke;
    }
});

test('js-pdf/src/main.js covers large-page scale 0.5/1, tiny wrapper clamp, superseded getUrlAsync blob revoke, and error resilience', async () => {
    const { mockDocument, mockWindow } = createDomMocks();
    const src = fs.readFileSync(path.join(CORE_DIR, 'packages/js-pdf/src/main.js'), 'utf8')
        .replace(/^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"];\s*$/gm, '')
        .replace(/export\s+function\s+init/g, 'function init');

    const revoked = [];
    const slowUrl = createDeferred();
    const urlStarted = createDeferred();
    let baseWidth = 2000;
    const errors = [];
    let staleDocDestroyed = false;
    const slowDoc = createDeferred();
    const slowDocStarted = createDeferred();

    mockWindow.devicePixelRatio = 3;
    mockWindow.pdfjsLib = {
        GlobalWorkerOptions: { workerSrc: '' },
        getDocument(opts) {
            return {
                destroy() { throw new Error('destroy ignored'); },
                promise: (async () => {
                    if (opts.url === 'slow-promise') {
                        slowDocStarted.resolve();
                        await slowDoc.promise;
                        return {
                            numPages: 1,
                            destroy() { staleDocDestroyed = true; },
                            getPage: async () => ({ getViewport: ({ scale }) => ({ width: baseWidth * scale, height: 1000 * scale }) })
                        };
                    }
                    return {
                        numPages: 8,
                        destroy() { throw new Error('doc destroy ignored'); },
                        getPage: async (num) => ({
                            getViewport: ({ scale }) => ({
                                width: baseWidth * scale,
                                height: (num === 2 ? 800 : 1000) * scale
                            }),
                            render: () => ({
                                cancel() { throw new Error('cancel ignored'); },
                                promise: Promise.resolve()
                            })
                        })
                    };
                })()
            };
        }
    };

    const { init } = new Function(
        'workerStr', 'pdfLibJsStr', 'downloadFile', 'getUrlAsync', 'revokeUrl', 'loadScript', 'omit', 'debounce',
        `${src}\nreturn { init };`
    )(
        'e30=', 'e30=',
        () => {},
        async (s) => {
            if (s === 'await-url') {
                urlStarted.resolve();
                await slowUrl.promise;
                return 'blob:orphaned-url';
            }
            return s;
        },
        u => revoked.push(u),
        async () => {},
        omit,
        debounce
    );

    await runWithDomGlobals({ window: mockWindow, document: mockDocument, getComputedStyle: mockWindow.getComputedStyle }, async () => {
        const container = mockDocument.createElement('div');
        const pdf = init(container, { onError: e => errors.push(e) });

        // viewport.width 2000 > 780 * 1.5 -> scale 0.5, then domWidth > wrapperWidth downscales
        await pdf.preview('wide-doc');
        assert.equal(pdf.getViewportScale, 0.5);
        assert.ok(pdf.pageWidth <= 780);

        // viewport.width 900 > 780 -> scale 1
        baseWidth = 900;
        await pdf.rerender();
        assert.equal(pdf.getViewportScale, 1);

        // tiny 21px wrapper still yields >= 1px pageHeight so scrolling remains functional
        pdf.wrapper.getBoundingClientRect = () => ({ width: 21, height: 200, top: 0, left: 0 });
        await pdf.rerender();
        assert.ok(pdf.pageWidth >= 1 && pdf.pageHeight >= 1);

        // Scroll UP (insertBefore) after jumping down
        pdf.wrapper.getBoundingClientRect = () => ({ width: 800, height: 200, top: 0, left: 0 });
        await pdf.rerender();
        pdf.wrapper.scrollTop = 20000;
        pdf.onScroll({ target: pdf.wrapper });
        pdf.onScroll.flush();
        await new Promise(r => setTimeout(r, 10));
        pdf.wrapper.scrollTop = 300;
        pdf.onScroll({ target: pdf.wrapper });
        pdf.onScroll.flush();
        await new Promise(r => setTimeout(r, 10));
        assert.ok(pdf.wrapperMain.children.length > 0);

        // Superseded getUrlAsync revokes newly created blob URL
        const pAwaitUrl = pdf.preview('await-url');
        await urlStarted.promise;
        const pSlowPromise = pdf.preview('slow-promise');
        await slowDocStarted.promise;
        await pdf.preview('winner-url');
        slowUrl.resolve();
        slowDoc.resolve();
        await Promise.all([pAwaitUrl, pSlowPromise]);
        assert.ok(revoked.includes('blob:orphaned-url'));
        assert.equal(staleDocDestroyed, true);

        // save with no pdfDocument is safe no-op
        pdf.cleanupPdfResources();
        pdf.save('noop.pdf');
        pdf.destroy();
    });
});
