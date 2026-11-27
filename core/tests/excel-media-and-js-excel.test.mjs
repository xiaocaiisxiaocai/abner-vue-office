import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import {
    getImageMimeType,
    calcPosition,
    renderImage,
    clearCache
} from '../packages/vue-excel/src/media.js';
import { CORE_DIR, createDomMocks, runWithDomGlobals } from './helpers/load-module.mjs';

const require = createRequire(import.meta.url);
const debounce = require('lodash/debounce');

test('media.js getImageMimeType and calcPosition handle anchors, hidden tracks, scroll, dpr, and SSR', async () => {
    assert.equal(getImageMimeType('jpg'), 'image/jpeg');
    assert.equal(getImageMimeType('JPEG'), 'image/jpeg');
    assert.equal(getImageMimeType('png'), 'image/png');
    assert.equal(getImageMimeType('gif'), 'image/gif');
    assert.equal(getImageMimeType('webp'), 'image/webp');
    assert.equal(getImageMimeType('svg'), 'image/svg+xml');
    assert.equal(getImageMimeType('tif'), 'image/tiff');
    assert.equal(getImageMimeType('ico'), 'image/x-icon');
    assert.equal(getImageMimeType('avif'), 'image/avif');
    assert.equal(getImageMimeType(''), 'image/png');

    const sheet = {
        _columns: [{ width: 20 }, { _hidden: true }, null],
        _rows: [{ height: 30 }, { _hidden: true }, null]
    };

    await runWithDomGlobals({ window: { devicePixelRatio: 2 } }, () => {
        const twoCellPos = calcPosition(
            sheet,
            {
                tl: { nativeCol: 0, nativeColOff: 127000, nativeRow: 0, nativeRowOff: 127000 },
                br: { nativeCol: 2, nativeColOff: 254000, nativeRow: 2, nativeRowOff: 127000 }
            },
            { scroll: { x: 10, y: 5 } },
            { widthOffset: 5, heightOffset: 2 }
        );
        assert.equal(twoCellPos.x, (60 + 10 - 10) * 2);
        assert.equal(twoCellPos.y, (24 + 10 - 5) * 2);
        assert.equal(twoCellPos.width, ((125 - 10) + 0 + 20) * 2);
        assert.equal(twoCellPos.height, ((32 - 10) + 0 + 10) * 2);

        const sameCellPos = calcPosition(
            sheet,
            {
                tl: { nativeCol: 1, nativeColOff: 0, nativeRow: 1, nativeRowOff: 0 },
                br: { nativeCol: 1, nativeColOff: 1270000, nativeRow: 1, nativeRowOff: 635000 }
            },
            null,
            null
        );
        assert.equal(sameCellPos.width, 200);
        assert.equal(sameCellPos.height, 100);
    });

        await runWithDomGlobals({ window: undefined }, () => {
        const oneCellPos = calcPosition(
            sheet,
            {
                tl: { nativeCol: 0, nativeColOff: 0, nativeRow: 0, nativeRowOff: 0 },
                ext: { width: 160, height: 80 }
            },
            undefined,
            undefined
        );
        assert.equal(oneCellPos.x, 60);
        assert.equal(oneCellPos.y, 24);
        assert.ok(Math.abs(oneCellPos.width - 120) < 0.01);
        assert.ok(Math.abs(oneCellPos.height - 60) < 0.01);

        const clampedPos = calcPosition(
            sheet,
            {
                tl: { nativeCol: 1, nativeColOff: 0, nativeRow: 1, nativeRowOff: 0 },
                br: { nativeCol: 3, nativeColOff: 0, nativeRow: 3, nativeRowOff: 0 }
            },
            null,
            { widthOffset: -500, heightOffset: -500 }
        );
        assert.equal(clampedPos.x, 61);
        assert.equal(clampedPos.y, 25);
        assert.equal(clampedPos.width, 1);
        assert.equal(clampedPos.height, 1);
    });
});

test('media.js renderImage clips, deduplicates concurrent loads, clears cache, and retries on error', async () => {
    const drawn = [];
    const ctx = {
        drawImage(...args) {
            drawn.push(args);
        }
    };
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    let createCount = 0;
    let revokeCount = 0;
    let shouldFail = false;

    URL.createObjectURL = () => {
        createCount++;
        return `blob:img-${createCount}`;
    };
    URL.revokeObjectURL = () => {
        revokeCount++;
    };

    class MockImage {
        constructor() {
            this.width = 100;
            this.height = 50;
        }

        set src(val) {
            this._src = val;
            queueMicrotask(() => {
                if (shouldFail) {
                    this.onerror && this.onerror(new Error('img decode fail'));
                } else {
                    this.onload && this.onload();
                }
            });
        }
    }

    const medias = [{ buffer: new Uint8Array([1, 2, 3]), extension: 'png' }];
    const sheet = {
        _columns: [{ width: 20 }],
        _rows: [{ height: 30 }],
        _media: [
            {
                type: 'image',
                imageId: 0,
                range: {
                    tl: { nativeCol: 0, nativeColOff: 0, nativeRow: 0, nativeRowOff: 0 },
                    ext: { width: 133.3333, height: 66.6666 }
                }
            },
            {
                type: 'image',
                imageId: 0,
                range: {
                    tl: { nativeCol: 0, nativeColOff: 0, nativeRow: 0, nativeRowOff: 0 },
                    ext: { width: 133.3333, height: 66.6666 }
                }
            }
        ]
    };

    try {
        await runWithDomGlobals({ window: { devicePixelRatio: 1 }, Image: MockImage }, async () => {
            renderImage(ctx, medias, sheet, { scroll: { x: 20, y: 10 } }, {});
            await new Promise(r => setTimeout(r, 10));
            assert.equal(createCount, 1);
            assert.equal(revokeCount, 1);
            assert.equal(drawn.length, 2);
            assert.equal(drawn[0][5], 60);
            assert.equal(drawn[0][6], 24);
            assert.ok(drawn[0][7] < 100);
            assert.ok(drawn[0][8] < 50);

            renderImage(ctx, medias, sheet, { scroll: { x: 0, y: 0 } }, {}, () => false);
            await new Promise(r => setTimeout(r, 10));
            assert.equal(drawn.length, 2);

            clearCache(ctx);
            shouldFail = true;
            renderImage(ctx, medias, sheet, null, {});
            await new Promise(r => setTimeout(r, 10));
            assert.equal(createCount, 2);

            shouldFail = false;
            renderImage(ctx, medias, sheet, null, {});
            await new Promise(r => setTimeout(r, 10));
            assert.equal(createCount, 3);
            assert.equal(drawn.length, 4);

            // Sync throw inside Blob/createObjectURL must not poison cache
            clearCache(ctx);
            URL.createObjectURL = () => {
                throw new Error('sync blob fail');
            };
            renderImage(ctx, medias, sheet, null, {});
            await new Promise(r => setTimeout(r, 10));
            URL.createObjectURL = () => {
                createCount++;
                return `blob:img-${createCount}`;
            };
            renderImage(ctx, medias, sheet, null, {});
            await new Promise(r => setTimeout(r, 10));
            assert.equal(drawn.length, 6);

            // Early exit guards (null ctx, empty _media, invalid media buffer, completely clipped off-screen)
            renderImage(null, medias, sheet);
            renderImage(ctx, medias, { _media: [] });
            renderImage(ctx, [{}], { _media: [{ type: 'image', imageId: 0, range: {} }] });
            const clippedCountBefore = drawn.length;
            renderImage(ctx, medias, {
                _columns: [],
                _rows: [],
                _media: [{
                    type: 'image',
                    imageId: 0,
                    range: { tl: { nativeCol: 0, nativeColOff: 0, nativeRow: 0, nativeRowOff: 0 }, ext: { width: 10, height: 10 } }
                }]
            }, { scroll: { x: 500, y: 500 } }, {});
            await new Promise(r => setTimeout(r, 10));
            assert.equal(drawn.length, clippedCountBefore);
        });
    } finally {
        URL.createObjectURL = origCreate;
        URL.revokeObjectURL = origRevoke;
    }
});

test('js-excel/src/main.js lifecycle, transform hooks, race guard, save, and destroy safety', async () => {
    const { mockDocument } = createDomMocks();
    const downloads = [];
    const createdSheets = [];

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
            this.bottombar = {
                swapFunc: () => {}
            };
            this.sheet = {
                data: { getSelectedRect: () => ({ scroll: { x: 0, y: 0 } }) },
                table: { render: () => {} },
                editor: { setOffset: () => {} }
            };
            const canvas = mockDocument.createElement('canvas');
            el.appendChild(canvas);
            createdSheets.push(this);
        }

        loadData(d) {
            this.loaded.push(d);
            return this;
        }

        on(name, cb) {
            this.events[name] = cb;
            return this;
        }

        reRender() {
            this.reRenderCount++;
        }

        destroy() {
            this.destroyed = true;
        }
    }

    const src = fs.readFileSync(path.join(CORE_DIR, 'packages/js-excel/src/main.js'), 'utf8')
        .replace(/^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"];\s*$/gm, '')
        .replace(/export\s+function\s+init/g, 'function init');

    let getDataCalls = 0;
    let shouldFailRead = false;
    const mockGetData = async (input) => {
        getDataCalls++;
        if (input === 'slow') {
            await new Promise(r => setTimeout(r, 25));
            return new ArrayBuffer(8);
        }
        if (input === 'fast') {
            return new ArrayBuffer(16);
        }
        return input;
    };
    const mockReadExcelData = async () => {
        if (shouldFailRead) {
            throw new Error('corrupt workbook');
        }
        return { _worksheets: [{ name: 'S1' }] };
    };
    const mockTransfer = (wb) => ({
        workbookData: [{ name: wb.tag || 'S1', rows: {} }],
        medias: [],
        workbookSource: wb
    });

    const { init } = new Function(
        'Spreadsheet', 'getData', 'readExcelData', 'transferExcelToSpreadSheet', 'renderImage', 'clearCache', 'readOnlyInput', 'debounce', 'downloadFile',
        `${src}\nreturn { init };`
    )(
        MockSpreadsheet,
        mockGetData,
        mockReadExcelData,
        mockTransfer,
        () => {},
        () => {},
        () => {},
        debounce,
        (name, data) => downloads.push({ name, data })
    );

    assert.throws(() => init(null), /container is required/);

    await runWithDomGlobals({ document: mockDocument, MutationObserver: undefined }, async () => {
        const container = mockDocument.createElement('div');
        const switched = [];
        const selected = [];
        const rangeSelected = [];
        const excel = init(container, {
            xls: false,
            switchSheet: idx => switched.push(idx),
            cellSelected: ev => selected.push(ev),
            cellsSelected: ev => rangeSelected.push(ev),
            beforeTransformData: (wb) => {
                wb.tag = 'Mutated';
            },
            transformData: (data) => {
                data[0].transformed = true;
            }
        });

        assert.equal(createdSheets[0].options.evalPaused, true);
        createdSheets[0].events['cell-selected']({ text: 'A1' }, 0, 0);
        createdSheets[0].events['cells-selected']({ text: 'A1' }, { sri: 0, sci: 0, eri: 1, eci: 2 });
        assert.deepEqual(selected[0], { cell: { text: 'A1' }, rowIndex: 0, columnIndex: 0 });
        assert.deepEqual(rangeSelected[0].endColumnIndex, 2);

        await assert.rejects(excel.preview(''), /预览地址不能为空/);

        let releaseSlow;
        const slowGetData = mockGetData;
        const slowP = excel.preview('slow');
        await excel.preview('fast');
        await slowP;
        void releaseSlow;
        void slowGetData;
        assert.equal(excel.fileData.byteLength, 16);
        assert.equal(switched[0], 0);
        assert.equal(createdSheets[0].loaded[createdSheets[0].loaded.length - 1][0].name, 'Mutated');
        assert.equal(createdSheets[0].loaded[createdSheets[0].loaded.length - 1][0].transformed, true);

        const renderCalls = [];
        const { init: initReal } = new Function(
            'Spreadsheet', 'getData', 'readExcelData', 'transferExcelToSpreadSheet', 'renderImage', 'clearCache', 'readOnlyInput', 'debounce', 'downloadFile',
            `${src}\nreturn { init };`
        )(
            MockSpreadsheet,
            mockGetData,
            mockReadExcelData,
            mockTransfer,
            (_ctx, _m, sheet, off, _opts, shouldDraw) => {
                renderCalls.push({ sheetName: sheet.name, offset: off, ok: shouldDraw() });
            },
            () => {},
            () => {},
            debounce,
            (name, data) => downloads.push({ name, data })
        );
        const excel2 = initReal(mockDocument.createElement('div'), {
            switchSheet: idx => switched.push(idx)
        });
        await excel2.preview('fast');
        excel2.xs.sheet.editor.setOffset({ scroll: { x: 4, y: 8 } });
        assert.deepEqual(excel2.offset, { scroll: { x: 4, y: 8 } });
        excel2.xs.sheet.table.render();
        assert.equal(renderCalls.length, 1);
        assert.equal(renderCalls[0].ok, true);

        excel2.xs.bottombar.swapFunc(1);
        await new Promise(r => setTimeout(r, 15));
        assert.equal(switched[switched.length - 1], 1);
        excel2.destroy();

        excel.save('explicit.xlsx');
        excel.save();
        assert.equal(downloads[0].name, 'explicit.xlsx');
        assert.match(downloads[1].name, /\.xlsx$/);

        excel.setOptions({ xls: true });
        excel.setOptions(null);
        excel.setRequestOptions({ headers: { A: '1' } });
        excel.save();
        assert.match(downloads[2].name, /\.xls$/);

        shouldFailRead = true;
        await assert.rejects(excel.preview('fast'), /corrupt workbook/);
        assert.equal(excel.fileData, null);

        excel.destroy();
        const prevCalls = getDataCalls;
        await excel.preview('fast');
        assert.equal(getDataCalls, prevCalls);
        assert.equal(excel.isDestroyed, true);
        assert.deepEqual(excel.options, {});
        assert.deepEqual(excel.requestOptions, {});
        assert.equal(createdSheets[0].destroyed, true);
    });

    // Test MutationObserver lifecycle and swapFunc sheetIndex update before original swapFunc
    let disconnected = false;
    class MockObserver {
        constructor(cb) {
            this.cb = cb;
        }
        observe() {}
        disconnect() {
            disconnected = true;
        }
    }
    const renderedSheets = [];
    class MockSheetWithRender extends MockSpreadsheet {
        constructor(el, opts) {
            super(el, opts);
            this.datas = [
                { getSelectedRect: () => ({ scroll: { x: 0, y: 0 } }) },
                { getSelectedRect: () => ({ scroll: { x: 12, y: 34 } }) }
            ];
            this.bottombar.swapFunc = () => {
                renderedSheets.push(excelObs.sheetIndex);
            };
        }
    }
    let readOnlyCount = 0;
    const { init: initObs } = new Function(
        'Spreadsheet', 'getData', 'readExcelData', 'transferExcelToSpreadSheet', 'renderImage', 'clearCache', 'readOnlyInput', 'debounce', 'downloadFile',
        `${src}\nreturn { init };`
    )(MockSheetWithRender, mockGetData, async () => ({ _worksheets: [{ name: 'S1' }, { name: 'S2' }] }), mockTransfer, () => {}, () => {}, () => { readOnlyCount++; }, debounce, () => {});
    let excelObs;
    await runWithDomGlobals({ document: mockDocument, MutationObserver: MockObserver }, async () => {
        excelObs = initObs(mockDocument.createElement('div'));
        assert.equal(readOnlyCount, 1);
        excelObs.observer.cb();
        await new Promise(r => setTimeout(r, 220));
        assert.equal(readOnlyCount, 2);
        excelObs.xs.bottombar.swapFunc(1);
        assert.equal(renderedSheets[0], 1);
        excelObs.destroy();
        assert.equal(disconnected, true);
    });
});
