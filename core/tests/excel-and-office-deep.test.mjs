import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { isTest } from '../utils/test.js';
import { normalizeFetchOptions, loadScript } from '../utils/url.js';
import { calcPosition, renderImage } from '../packages/vue-excel/src/media.js';
import {
    CORE_DIR,
    createDeferred,
    createDomMocks,
    loadExcelModule,
    loadStrippedModule,
    mountScriptSetup,
    mountSfcScript,
    runWithDomGlobals
} from './helpers/load-module.mjs';

const require = createRequire(import.meta.url);
const debounce = require('lodash/debounce');
const omit = require('lodash/omit');

test('excel.js deep formatting fixes: fractions, conditionals, currency zero-sec, padding+commas, rounding, dates, 1904, colors, borders, merges, XHR', async () => {
    const excelMod = loadExcelModule();

    // 1. Fractions
    assert.equal(excelMod.formatNumberValue(1.5, '# ?/?'), '1 1/2');
    assert.equal(excelMod.formatNumberValue(0.25, '# ?/?'), '1/4');
    assert.equal(excelMod.formatNumberValue(2, '# ?/?'), '2');
    assert.equal(excelMod.formatNumberValue(1.375, '0 ?/8'), '1 3/8');
    assert.equal(excelMod.formatNumberValue(1.3125, '# ?/16'), '1 5/16');
    assert.equal(excelMod.formatNumberValue(1 + 2 / 105, '0 ?/105'), '1 2/105');

    // 2. Conditional sections
    assert.equal(excelMod.formatNumberValue(500, '[>=10000]0.0,"万";0'), '500');
    assert.equal(excelMod.formatNumberValue(-500, '[>=10000]0.0,"万";0'), '-500');
    assert.equal(excelMod.formatNumberValue(25000, '[>=10000]0.0,"万";0'), '25.0万');
    assert.equal(excelMod.formatNumberValue(-5, '[<0]"Loss";[>0]"Gain";"Flat"'), 'Loss');
    assert.equal(excelMod.formatNumberValue(5, '[<0]"Loss";[>0]"Gain";"Flat"'), 'Gain');
    assert.equal(excelMod.formatNumberValue(0, '[<0]"Loss";[>0]"Gain";"Flat"'), 'Flat');

    // 3. Zero-section currency & escaped literals
    assert.equal(excelMod.formatNumberValue(0, '_ * #,##0.00_ ;_ * -#,##0.00_ ;_ [$¥-804]* "-"??_ ;_ @_ '), '¥-');
    assert.equal(excelMod.formatNumberValue(0, '0;-0;\\-'), '-');

    // 4. Zero-padding with grouping comma & scaling comma + space/literal
    assert.equal(excelMod.formatNumberValue(5, '0,000'), '0,005');
    assert.equal(excelMod.formatNumberValue(42, '00,000.00'), '00,042.00');
    assert.equal(excelMod.formatNumberValue(1500, '0000, "K"'), '0002 K');

    // 5. Floating-point half-away-from-zero rounding
    assert.equal(excelMod.formatNumberValue(0.285, '0%'), '29%');
    assert.equal(excelMod.formatNumberValue(1.005, '0.00'), '1.01');

    // 6. Edge literals, signs, scientific, parens, masked integer, section color, @ text section
    assert.equal(excelMod.formatNumberValue(15, '#,##0.00 €'), '15.00 €');
    assert.equal(excelMod.formatNumberValue(100, '"USD" #,##0.00'), 'USD 100.00');
    assert.equal(excelMod.formatNumberValue(100, '$ #,##0.00'), '$ 100.00');
    assert.equal(excelMod.formatNumberValue(0.125, '+0.0%;-0.0%;0.0%'), '+12.5%');
    assert.equal(excelMod.formatNumberValue(-500, '0.00E-00;[Red]0.00E-00'), '5.00E02');
    assert.equal(excelMod.formatNumberWithMeta(-500, '0.00E-00;[Red]0.00E-00').color, '#FF0000');
    assert.equal(excelMod.formatNumberValue(5e-324, '0.00E+00'), '4.94E-324');
    assert.equal(excelMod.formatNumberValue(-100, '#,##0.00;(#,##0.00)"元"'), '(100.00)元');
    assert.equal(excelMod.formatNumberValue(-100, '#,##0.00;#,##0.00-'), '100.00-');
    assert.equal(excelMod.formatNumberValue(0.1234, '%0.00'), '%12.34');
    assert.equal(excelMod.formatNumberValue(1234567, '000-0000'), '123-4567');
    assert.equal(excelMod.getCellText({ type: 3, value: 'Apple', style: { numFmt: '"Item: "@' } }), 'Item: Apple');

    // 7. Elapsed durations (including type 2 numeric, 1904 epoch, quoted "[h]", escaped \s, [hhh], null)
    assert.equal(excelMod.getCellText({ type: 2, value: 1.5, style: { numFmt: '[h]' } }), '36');
    assert.equal(excelMod.formatElapsedDuration(new Date(Date.UTC(1904, 0, 2, 12, 0, 0)), '[h]:mm:ss', true), '36:00:00');
    assert.equal(excelMod.formatElapsedDuration(null, '[h]:mm'), '');
    assert.equal(excelMod.formatElapsedDuration(5 / 24 + 10 / 1440, '[hhh]:mm'), '005:10');
    assert.equal(excelMod.formatElapsedDuration(1.5, '[h]\\s'), '36');
    assert.equal(excelMod.formatExcelDateByNumFmt(new Date(Date.UTC(2024, 0, 5)), 'yyyy-mm-dd "[h]"'), '2024-01-05');

    // 8. Date formats: mm:ss, Chinese dates, slash dates, single d, h:mmAM/PM, multi-section, numeric serial
    assert.equal(excelMod.formatExcelDateByNumFmt(new Date(Date.UTC(1899, 11, 30, 0, 5, 30)), 'mm:ss'), '05:30');
    assert.equal(excelMod.formatExcelDateByNumFmt(new Date(Date.UTC(2024, 0, 5)), 'yyyy"年"m"月"d"日"'), '2024年1月5日');
    assert.equal(excelMod.formatExcelDateByNumFmt(new Date(Date.UTC(2024, 0, 5)), 'm"月"d"日"'), '1月5日');
    assert.equal(excelMod.formatExcelDateByNumFmt(new Date(Date.UTC(2024, 0, 5)), 'yyyy/mm/dd'), '2024/01/05');
    assert.equal(excelMod.formatExcelDateByNumFmt(new Date(Date.UTC(2024, 0, 5, 14, 30, 0)), 'yyyy/m/d h:mm;@'), '2024/1/5 14:30');
    assert.equal(excelMod.formatExcelDateByNumFmt(new Date(Date.UTC(2024, 0, 5, 14, 30, 0)), 'h:mmAM/PM'), '2:30 PM');
    assert.equal(excelMod.formatExcelDateByNumFmt(new Date(Date.UTC(2024, 0, 5, 14, 30, 0)), 'h:mm;ddd'), '14:30');
    assert.equal(excelMod.formatExcelDate(45306, 'YYYY-MM-DD'), '2024-01-15');

    // 9. Theme XML namespace-agnostic + sysClr + fills + borders + semi-transparent ARGB + hyperlink number/boolean
    const paletteNoPrefix = excelMod.extractWorkbookThemeColors({
        _themes: {
            customTheme: '<clrScheme xmlns="http://schemas.openxmlformats.org/drawingml/2006/main"><dk1><sysClr lastClr="112233"/></dk1><accent1><srgbClr val="AABBCC"/></accent1></clrScheme>'
        }
    });
    assert.equal(paletteNoPrefix[1], '#112233');
    assert.equal(paletteNoPrefix[4], '#AABBCC');

    assert.equal(excelMod.getStyle({ style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { indexed: 64 } } } }).bgcolor, undefined);
    assert.equal(excelMod.getStyle({ style: { fill: { type: 'pattern', pattern: 'gray125', fgColor: { indexed: 64 }, bgColor: { indexed: 65 } } } }).bgcolor, '#FFFFFF');
    assert.equal(excelMod.getStyle({ style: { fill: { type: 'pattern', pattern: 'solid', fgColor: { auto: 1 } } } }).bgcolor, undefined);
    assert.match(excelMod.transferArgbColor('80FF0000'), /^rgba\(255, 0, 0, 0\.5/);
    assert.equal(excelMod.getStyle({ style: { font: { color: { theme: NaN } } } }).color, '#C7C9CC');
    assert.equal(excelMod.getStyle({ style: { font: { color: { theme: undefined, indexed: 2 } } } }).color, '#FF0000');
    assert.equal(excelMod.getStyle({ style: { border: { top: { style: 'none', color: { auto: 1 } }, bottom: { style: 'thin', color: { argb: '00000000' } } } } }).border, undefined);
    assert.equal(excelMod.getCellText({ type: 5, value: { text: 1234.5 }, style: { numFmt: '#,##0.00' } }), '1,234.50');
    assert.equal(excelMod.getCellText({ type: 5, value: { text: true } }), 'TRUE');
    assert.equal(excelMod.getCellText({ type: 8, value: { richText: [null, { text: 0 }, { text: 'x' }] } }), '0x');

    // 10. Hidden-top-row merge remapping produces remapped A1 range (A2:B3), no empty {} slaves, plain worksheets fallback, integer minRowLength
    const plainWb = {
        worksheets: [{
            name: 'Plain',
            _merges: {
                A1: { tl: 'A1', br: 'B3', model: { top: 1, left: 1, bottom: 3, right: 2 } }
            },
            columns: [{ width: 10 }, { width: 10 }],
            _rows: [
                { _hidden: true, _cells: [{ type: 3, value: 'TopVal', _address: 'A1', style: {} }] },
                { _cells: [{ type: 3, value: '', isMerged: true, master: { address: 'A1' }, _address: 'A2', style: {} }, { type: 3, value: '', isMerged: true, master: { address: 'A1' }, _address: 'B2', style: {} }] },
                { _cells: [{ type: 3, value: '', isMerged: true, master: { address: 'A1' }, _address: 'A3', style: {} }, { type: 3, value: '', isMerged: true, master: { address: 'A1' }, _address: 'B3', style: {} }] }
            ]
        }]
    };
    const resPlain = excelMod.transferExcelToSpreadSheet(plainWb, { minRowLength: 5.9, minColLength: 3.7 });
    assert.deepEqual(resPlain.workbookData[0].merges, ['A2:B3']);
    assert.equal(resPlain.workbookData[0].rows[1].cells[0].text, 'TopVal');
    assert.deepEqual(resPlain.workbookData[0].rows[1].cells[0].merge, [1, 1]);
    assert.equal(resPlain.workbookData[0].rows[2].cells[0], undefined); // No empty {} slave cell!
    assert.equal(resPlain.workbookData[0].rows.len, 5);
    assert.equal(resPlain.workbookData[0].cols.len, 3);

    // 11. requestExcel SSR guard, in-flight AbortSignal abort, and sync xhr.send() throw listener cleanup
    await runWithDomGlobals({ XMLHttpRequest: undefined }, async () => {
        await assert.rejects(excelMod.getData('https://example.com/a.xlsx'), /XMLHttpRequest is not available/);
    });
    let xhrAborted = false;
    let removedAbortListener = false;
    class InFlightXhr {
        open() {}
        abort() { xhrAborted = true; }
        send() {
            if (this._throwSync) throw new Error('send boom');
        }
    }
    await runWithDomGlobals({ XMLHttpRequest: InFlightXhr }, async () => {
        const ac = new AbortController();
        const p = excelMod.getData('https://example.com/inflight.xlsx', { signal: ac.signal });
        ac.abort();
        await assert.rejects(p, /Request aborted/);
        assert.equal(xhrAborted, true);
    });
    class SyncThrowXhr {
        open() {}
        send() { throw new Error('sync send fail'); }
    }
    const fakeSignal = {
        aborted: false,
        addEventListener() {},
        removeEventListener() { removedAbortListener = true; }
    };
    await runWithDomGlobals({ XMLHttpRequest: SyncThrowXhr }, async () => {
        await assert.rejects(excelMod.getData('https://example.com/sync-fail.xlsx', { signal: fakeSignal }), /sync send fail/);
        assert.equal(removedAbortListener, true);
    });
});

test('media.js frozen-pane clipping, hidden anchor clamping, br < tl zeroing, and drawImageBitmap error isolation', async () => {
    const sheet = {
        views: [{ state: 'frozen', xSplit: 1, ySplit: 1 }],
        _columns: [{ _hidden: true }, { width: 20 }, { width: 20 }],
        _rows: [{ height: 30 }, { height: 30 }, { height: 30 }]
    };

    await runWithDomGlobals({ window: { devicePixelRatio: 1 } }, () => {
        // Hidden start col 0 with large offset does NOT shift or collapse image width to 0
        const pos = calcPosition(
            sheet,
            { tl: { nativeCol: 0, nativeColOff: 635000, nativeRow: 0, nativeRowOff: 0 }, br: { nativeCol: 1, nativeColOff: 635000, nativeRow: 1, nativeRowOff: 0 } },
            { scroll: { x: 0, y: 0 } },
            {}
        );
        assert.equal(pos.x, 60);
        assert.equal(pos.width, 50);

        // br < tl yields 0 dimensions
        const inverted = calcPosition(
            sheet,
            { tl: { nativeCol: 2, nativeColOff: 0, nativeRow: 2, nativeRowOff: 0 }, br: { nativeCol: 1, nativeColOff: 0, nativeRow: 1, nativeRowOff: 0 } },
            null,
            {}
        );
        assert.equal(inverted.width, 0);
        assert.equal(inverted.height, 0);

        // Scrollable image below frozen row 0 gets minY = clipHeight(24) + freezeHeight(30) = 54
        const frozenClip = calcPosition(
            sheet,
            { tl: { nativeCol: 1, nativeColOff: 0, nativeRow: 1, nativeRowOff: 0 }, ext: { width: 100, height: 100 } },
            { scroll: { x: 0, y: 20 } },
            {}
        );
        assert.equal(frozenClip.minY, 54);
    });

    // drawImageBitmap throw on image 1 does not break image 2 or cause unhandled rejection
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = () => 'blob:ok';
    URL.revokeObjectURL = () => {};
    class OkImage {
        constructor() { this.naturalWidth = 100; this.naturalHeight = 50; }
        set src(_v) { queueMicrotask(() => this.onload && this.onload()); }
    }
    let drawAttempt = 0;
    const ctx = {
        drawImage() {
            drawAttempt++;
            if (drawAttempt === 1) throw new Error('broken svg');
        }
    };
    try {
        await runWithDomGlobals({ window: { devicePixelRatio: 1 }, Image: OkImage }, async () => {
            await renderImage(
                ctx,
                [{ buffer: new Uint8Array([1]), extension: 'png' }, { buffer: new Uint8Array([2]), extension: 'png' }],
                {
                    _columns: [{ width: 20 }],
                    _rows: [{ height: 30 }],
                    _media: [
                        { type: 'image', imageId: 0, range: { tl: { nativeCol: 0, nativeRow: 0 }, ext: { width: 100, height: 50 } } },
                        { type: 'image', imageId: 1, range: { tl: { nativeCol: 0, nativeRow: 0 }, ext: { width: 100, height: 50 } } }
                    ]
                },
                null,
                {}
            );
            assert.equal(drawAttempt, 2);
        });
    } finally {
        URL.createObjectURL = origCreate;
        URL.revokeObjectURL = origRevoke;
    }
});

test('vue-excel, js-excel, vue-pdf, js-pdf, vue-docx, js-docx, vue-pptx cover all race, callback-isolation, and leak fixes', async () => {
    const { mockDocument, mockWindow } = createDomMocks();

    // 1. vue-excel: NO double switchSheet(0) on load (even when xs.loadData invokes bottombar.swapFunc(0)) and NO spurious switchSheet(0) on error
    class RealSwapSpreadsheet {
        constructor(el) {
            this.el = el;
            this.datas = [{ getSelectedRect: () => ({ scroll: { x: 0, y: 0 } }) }];
            this.bottombar = { swapFunc: () => {} };
            this.sheet = {
                data: { getSelectedRect: () => ({ scroll: { x: 0, y: 0 } }) },
                table: { render: () => {} },
                editor: { setOffset: () => {} },
                contextMenu: { isHide: true },
                reload: () => {}
            };
            el.appendChild(mockDocument.createElement('canvas'));
        }
        loadData() {
            this.bottombar.swapFunc(0);
            return this;
        }
        on() { return this; }
        destroy() {}
    }

    let readOnlyCalled = 0;
    let resizeDisconnected = false;
    let resizeCallback = null;
    class MockResizeObserver {
        constructor(cb) { resizeCallback = cb; }
        observe() {}
        disconnect() { resizeDisconnected = true; }
    }
    let mutationOpts = null;
    class MockMutationObserver {
        observe(_el, opts) { mutationOpts = opts; }
        disconnect() {}
    }

    await runWithDomGlobals({
        document: mockDocument,
        MutationObserver: MockMutationObserver,
        ResizeObserver: MockResizeObserver
    }, async () => {
        const wrapper = mockDocument.createElement('div');
        const root = mockDocument.createElement('div');
        let failRead = false;
        const sfc = mountSfcScript(
            'packages/vue-excel/src/main.vue',
            {
                Spreadsheet: RealSwapSpreadsheet,
                getData: async s => s,
                readExcelData: async () => {
                    if (failRead) throw new Error('bad file');
                    return { _worksheets: [{ name: 'S1' }] };
                },
                transferExcelToSpreadSheet: wb => ({ workbookData: [{ name: 'S1' }], medias: [], workbookSource: wb }),
                renderImage: () => {},
                clearCache: () => {},
                readOnlyInput: () => { readOnlyCalled++; },
                debounce,
                downloadFile: () => {}
            },
            { src: 'a.xlsx', options: { showContextmenu: false } },
            { wrapperRef: wrapper, rootRef: root }
        );
        sfc.mount();
        await new Promise(r => setTimeout(r, 20));
        // Only ONE switchSheet(0) emitted, NOT two!
        assert.equal(sfc.emitted.filter(e => e.name === 'switchSheet').length, 1);
        assert.equal(readOnlyCalled, 1);
        assert.deepEqual(mutationOpts, { childList: true, subtree: true });

        // Dynamic showContextmenu toggle updates contextMenu.isHide
        sfc.setProp('options', { showContextmenu: true });
        wrapper.clientWidth = 900;
        resizeCallback && resizeCallback();

        // Load error must NOT emit spurious switchSheet(0)
        failRead = true;
        sfc.setProp('src', 'bad.xlsx');
        await new Promise(r => setTimeout(r, 20));
        assert.equal(sfc.emitted.filter(e => e.name === 'switchSheet').length, 1);

        sfc.unmount();
        assert.equal(resizeDisconnected, true);
    });

    // 2. vue-pdf: fresh options object reference does NOT reset user's setScale(1.5), and setScale during load does NOT abort new PDF
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = () => 'blob:pdf-worker';
    URL.revokeObjectURL = () => {};
    let cleanedPages = 0;
    const slowDoc = createDeferred();
    const slowDocStarted = createDeferred();
    mockWindow.pdfjsLib = {
        GlobalWorkerOptions: { workerSrc: '' },
        getDocument(opts) {
            return {
                destroy: () => Promise.reject(new Error('async destroy ignored')),
                promise: (async () => {
                    if (opts.url === 'slow2.pdf') {
                        slowDocStarted.resolve();
                        await slowDoc.promise;
                    }
                    return {
                        numPages: 2,
                        destroy: () => Promise.reject(new Error('async doc destroy ignored')),
                        getPage: async (num) => ({
                            getViewport: ({ scale }) => ({ width: (num === 2 ? 1200 : 400) * scale, height: 600 * scale }),
                            render: () => ({ cancel() {}, promise: Promise.resolve() }),
                            cleanup: () => { cleanedPages++; }
                        })
                    };
                })()
            };
        }
    };

    try {
        await runWithDomGlobals({
            document: mockDocument,
            window: mockWindow,
            getComputedStyle: mockWindow.getComputedStyle
        }, async () => {
            const c = mockDocument.createElement('div');
            const w = mockDocument.createElement('div');
            const sfcPdf = mountSfcScript(
                'packages/vue-pdf/src/main.vue',
                {
                    workerStr: 'console.log(1)',
                    pdfjsLib: 'console.log(2)',
                    downloadFile: () => {},
                    getUrlAsync: async s => s,
                    revokeUrl: () => {},
                    loadScript: async () => {},
                    omit,
                    debounce
                },
                { src: 'doc1.pdf', options: { width: 400 }, defaultScale: 1 },
                { containerRef: c, wrapperRef: w }
            );
            sfcPdf.mount();
            await new Promise(r => setTimeout(r, 20));
            assert.ok(cleanedPages >= 1);
            // Mixed-orientation wider page 2 expanded minWidth beyond page 1's 420px!
            assert.ok(parseFloat(w.style.minWidth) > 420);

            sfcPdf.setupResult.setScale(1.5);
            await new Promise(r => setTimeout(r, 15));
            assert.equal(sfcPdf.setupResult.getScale(), 1.5);

            // Re-render parent passing a new inline options object with same defaultScale (undefined -> 1) MUST NOT reset 1.5!
            sfcPdf.setProp('options', { width: 400 });
            await new Promise(r => setTimeout(r, 10));
            assert.equal(sfcPdf.setupResult.getScale(), 1.5);

            // Switch to slow2.pdf, call setScale(1.8) mid-load -> must NOT abort slow2.pdf!
            sfcPdf.setProp('src', 'slow2.pdf');
            await slowDocStarted.promise;
            sfcPdf.setupResult.setScale(1.8);
            slowDoc.resolve();
            await new Promise(r => setTimeout(r, 25));
            assert.equal(sfcPdf.setupResult.getScale(), 1.8);
            assert.ok(sfcPdf.emitted.filter(e => e.name === 'rendered').length >= 2);

            // Unsupported src type rejected before getDocument
            sfcPdf.setProp('src', 12345);
            await new Promise(r => setTimeout(r, 15));
            assert.ok(sfcPdf.emitted.some(e => e.name === 'error' && /不支持/.test(e.args[0].message)));

            sfcPdf.unmount();
        });

        // 3. js-pdf: blob: workerSrc, credentials: 'omit' overrides options.withCredentials: true, options.width > wrapper respected, throwing onRendered does not destroy doc
        const jsPdfSrc = fs.readFileSync(path.join(CORE_DIR, 'packages/js-pdf/src/main.js'), 'utf8')
            .replace(/^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"];\s*$/gm, '')
            .replace(/export\s+function\s+init/g, 'function init');
        let lastJsPdfDocOpts = null;
        mockWindow.pdfjsLib = {
            version: '4.7.76',
            GlobalWorkerOptions: { workerSrc: '' },
            getDocument(opts) {
                lastJsPdfDocOpts = opts;
                return {
                    destroy: () => Promise.resolve(),
                    promise: Promise.resolve({
                        numPages: 1,
                        destroy: () => Promise.resolve(),
                        getPage: async () => ({
                            getViewport: ({ scale }) => ({ width: 500 * scale, height: 700 * scale }),
                            render: () => ({ cancel() {}, promise: Promise.resolve() }),
                            cleanup: () => {}
                        })
                    })
                };
            }
        };
        const { init: initJsPdf } = new Function(
            'workerStr', 'pdfLibJsStr', 'downloadFile', 'getUrlAsync', 'revokeUrl', 'loadScript', 'omit', 'debounce',
            `${jsPdfSrc}\nreturn { init };`
        )('Y29uc29sZS5sb2coMSk=', 'Y29uc29sZS5sb2coMik=', () => {}, async s => s, () => {}, async () => {}, omit, debounce);

        await runWithDomGlobals({ document: mockDocument, window: mockWindow, getComputedStyle: mockWindow.getComputedStyle }, async () => {
            const host = mockDocument.createElement('div');
            const errors = [];
            const pdf = initJsPdf(host, {
                width: 1200,
                withCredentials: true,
                data: new Uint8Array([1, 2]),
                onError: e => errors.push(e),
                onRendered: () => { throw new Error('user rendered callback error'); }
            }, { credentials: 'omit' });
            await assert.rejects(pdf.preview('https://example.com/a.pdf'), /user rendered callback error/);
            // Document was NOT wiped by onRendered throwing!
            assert.ok(pdf.pdfDocument);
            assert.equal(errors.length, 0);
            // workerSrc is blob: URL (not data: URI)
            assert.match(mockWindow.pdfjsLib.GlobalWorkerOptions.workerSrc, /^blob:/);
            // requestOptions.credentials: 'omit' took precedence over options.withCredentials: true
            assert.equal(lastJsPdfDocOpts.withCredentials, false);
            // options.data was stripped from getDocument args
            assert.equal('data' in lastJsPdfDocOpts, false);
            // Explicit options.width (1200) > wrapper width (800) was respected
            assert.equal(pdf.pageWidth, 1200);
            pdf.destroy();
        });
    } finally {
        URL.createObjectURL = origCreate;
        URL.revokeObjectURL = origRevoke;
    }

    // 4. vue-pptx: rerender() during in-flight src change does NOT revert to old deck; viewer.dom updated to rootRef
    const deck2Fetch = createDeferred();
    const deck2Started = createDeferred();
    let lastViewer = null;
    await runWithDomGlobals({
        document: mockDocument,
        fetch: async (url) => {
            if (url === 'deck2.pptx') {
                deck2Started.resolve();
                await deck2Fetch.promise;
            }
            return { ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode(url).buffer };
        }
    }, async () => {
        const rootEl = mockDocument.createElement('div');
        const sfcPptx = mountSfcScript(
            'packages/vue-pptx/src/main.vue',
            {
                initPptxPreviewer: (el) => {
                    const v = {
                        dom: el,
                        async preview(ab) {
                            const slide = mockDocument.createElement('div');
                            slide.className = new TextDecoder().decode(ab);
                            el.appendChild(slide);
                            return { ok: true };
                        },
                        destroy() {}
                    };
                    lastViewer = v;
                    return v;
                },
                downloadFile: () => {},
                normalizeFetchOptions: o => ({ ...(o || {}) })
            },
            { src: 'deck1.pptx' },
            { rootRef: rootEl }
        );
        sfcPptx.mount();
        await new Promise(r => setTimeout(r, 15));
        assert.equal(rootEl.children[0].className, 'deck1.pptx');
        assert.equal(lastViewer.dom, rootEl);

        sfcPptx.setProp('src', 'deck2.pptx');
        await deck2Started.promise;
        const rerenderP = sfcPptx.setupResult.rerender(); // Must NOT cancel deck2 or revert to deck1!
        deck2Fetch.resolve();
        await rerenderP;
        await new Promise(r => setTimeout(r, 15));
        assert.equal(rootEl.children[0].className, 'deck2.pptx');
        sfcPptx.unmount();
    });
});

test('utils/test.js #fragment strip, utils/url.js method trim & data/blob script cleanup, scripts edge cases, and demo fixes', async () => {
    // utils/test.js strips #fragment in location.href fallback
    await runWithDomGlobals({ location: { href: 'https://example.com/?test=0#section', search: '', hash: '' } }, () => {
        assert.equal(isTest(), false);
    });
    await runWithDomGlobals({ location: { href: 'https://example.com/?test=false#top', search: '', hash: '' } }, () => {
        assert.equal(isTest(), false);
    });

    // utils/url.js trims fetchOptions.method, removes blob:/data: <script> on onload, truncates long src in error
    const trimmedPost = normalizeFetchOptions({ method: ' POST ', body: 'abc' });
    assert.equal(trimmedPost.method, 'POST');
    assert.equal(trimmedPost.body, 'abc');

    const { mockDocument } = createDomMocks();
    await runWithDomGlobals({ document: mockDocument }, async () => {
        const pBlob = loadScript('blob:https://example.com/123');
        assert.equal(mockDocument.body.children.length, 1);
        mockDocument.body.children[0].onload();
        await pBlob;
        assert.equal(mockDocument.body.children.length, 0);

        const hugeDataUrl = `data:text/javascript;base64,${'A'.repeat(1000)}`;
        const pFail = loadScript(hugeDataUrl);
        mockDocument.body.children[0].onerror();
        await assert.rejects(pFail, err => err.message.length < 250 && err.message.endsWith('...'));
    });

    // script/copy.js missing src does NOT create empty dest directory; same-path is safe no-op
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'abner-deep-script-'));
    try {
        const copyScript = path.join(CORE_DIR, 'script/copy.js');
        const uncreatedDir = path.join(tmpDir, 'should-not-exist/out.txt');
        const missRes = spawnSync(process.execPath, [copyScript, path.join(tmpDir, 'nope.txt'), uncreatedDir], { cwd: tmpDir, encoding: 'utf8' });
        assert.equal(missRes.status, 1);
        assert.equal(fs.existsSync(path.dirname(uncreatedDir)), false);

        const selfFile = path.join(tmpDir, 'same.txt');
        fs.writeFileSync(selfFile, 'keep', 'utf8');
        const sameRes = spawnSync(process.execPath, [copyScript, selfFile, selfFile], { cwd: tmpDir, encoding: 'utf8' });
        assert.equal(sameRes.status, 0);
        assert.equal(fs.readFileSync(selfFile, 'utf8'), 'keep');

        // bak-vue.js rejects invalid arg
        const bakRes = spawnSync(process.execPath, [path.join(CORE_DIR, 'script/bak-vue.js'), 'invalid-arg'], { cwd: tmpDir, encoding: 'utf8' });
        assert.equal(bakRes.status, 1);

        // switch-cli.js exits 1 when v2/index.js artifact is missing
        const libDir = path.join(tmpDir, 'lib');
        const sDir = path.join(libDir, 'script');
        fs.mkdirSync(sDir, { recursive: true });
        fs.copyFileSync(path.join(CORE_DIR, 'script/utils.js'), path.join(sDir, 'utils.js'));
        fs.copyFileSync(path.join(CORE_DIR, 'script/switch-cli.js'), path.join(sDir, 'switch-cli.js'));
        const missSwitch = spawnSync(process.execPath, [path.join(sDir, 'switch-cli.js'), '2'], { cwd: tmpDir, encoding: 'utf8' });
        assert.equal(missSwitch.status, 1);
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }

    // Demo hooks & components: getStaticFileUrl on file:// origin='null' & .htm; App.vue /js-excel exact sync & initial '/' hash fallback; PreviewWrapper type switch cancels read
    const { getStaticFileUrl } = loadStrippedModule('src/hooks/usePreview.js', { ref: v => ({ value: v }) });
    await runWithDomGlobals({ location: { origin: 'null', pathname: '/demo/index.htm' } }, () => {
        assert.equal(getStaticFileUrl('static/test.pdf'), '/demo/static/test.pdf');
    });

    await runWithDomGlobals({ location: { hash: '#/js-excel' } }, () => {
        const appComp = mountScriptSetup('src/App.vue', {
            useRouter: () => ({ push: () => {} }),
            useRoute: () => ({ path: '/', query: {} })
        }, {}, ['current', 'syncMenu']);
        appComp.mount();
        assert.deepEqual(appComp.bindings.current.value, ['js-excel']);
        appComp.bindings.syncMenu('/js-docx');
        assert.deepEqual(appComp.bindings.current.value, ['js-docx']);
        appComp.bindings.syncMenu('/js-pdf');
        assert.deepEqual(appComp.bindings.current.value, ['js-pdf']);
    });

    let cancelCalls = 0;
    let pwRef = null;
    const makeLocalRef = (init) => {
        let v = init;
        return {
            get value() { return v; },
            set value(next) {
                if (next !== v) {
                    v = next;
                    pwRef && pwRef.triggerWatchers();
                }
            }
        };
    };
    const typeRef = makeLocalRef('upload');
    pwRef = mountScriptSetup('src/common/PreviewWrapper.vue', {
        usePreview: () => ({
            type: typeRef,
            inputSrc: makeLocalRef(''),
            src: makeLocalRef(''),
            xls: makeLocalRef(false),
            beforeUpload: () => false,
            cancelRead: () => { cancelCalls++; }
        }),
        isXlsName: () => false,
        useLoading: { showLoading: () => {}, hideLoading: () => {} },
        isTest: () => false
    }, { accept: '.xlsx', placeholder: '', defaultSrc: '' }, ['type']);
    typeRef.value = 'url';
    assert.equal(cancelCalls, 1);
});
