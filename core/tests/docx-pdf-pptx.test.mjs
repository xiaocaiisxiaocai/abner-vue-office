import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { isXlsName } from '../src/hooks/usePreview.js';
import { createDomMocks, runWithDomGlobals, loadStrippedModule } from './helpers/load-module.mjs';

const require = createRequire(import.meta.url);
const debounce = require('lodash/debounce');
const omit = require('lodash/omit');

test('usePreview isXlsName distinguishes .xls from .xlsx accurately', () => {
    assert.equal(isXlsName('report.xls'), true);
    assert.equal(isXlsName('https://example.com/report.XLS?token=1#hash'), true);
    assert.equal(isXlsName('report.xlsx'), false);
    assert.equal(isXlsName(null), false);
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
    const container = mockDocument.createElement('div');
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
        const instance = init(container, { inWrapper: true }, { withCredentials: true });
        instance.setOptions({ ignoreFonts: true });
        assert.deepEqual(instance.options, { inWrapper: true, ignoreFonts: true });

        await assert.rejects(instance.preview(''), /预览地址不能为空/);
        await assert.rejects(instance.preview({ bad: 1 }), /Unsupported docx data/);

        const pendingSlow = instance.preview('slow');
        instance.destroy();
        await pendingSlow;
        assert.equal(instance.isDestroyed, true);
        assert.equal(container.children.length, 0);
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
