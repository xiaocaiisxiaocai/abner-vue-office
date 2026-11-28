import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
    createCanvasContextMock,
    createDomMocks,
    loadStrippedModule,
    loadXSpreadsheetStack,
    mountSfcScript,
    runWithDomGlobals
} from './helpers/load-module.mjs';

const require = createRequire(import.meta.url);
const debounce = require('lodash/debounce');

function createProportionalCanvasCtx() {
    let font = '13px Arial';
    let fillStyle = '#000000';
    const fillCalls = [];
    const parseFontPx = () => {
        const m = String(font).match(/(\d+(?:\.\d+)?)px/);
        return m ? Number(m[1]) : 13;
    };
    const isBold = () => /\bbold\b/i.test(String(font));
    return {
        ...createCanvasContextMock(),
        fillCalls,
        get font() {
            return font;
        },
        set font(v) {
            font = String(v || '');
        },
        get fillStyle() {
            return fillStyle;
        },
        set fillStyle(v) {
            fillStyle = v;
        },
        fill() {
            fillCalls.push(fillStyle);
        },
        measureText(txt) {
            const px = parseFontPx();
            const boldScale = isBold() ? 1.1 : 1;
            let w = 0;
            for (const ch of Array.from(String(txt || ''))) {
                const cp = ch.codePointAt(0) || 0;
                w += (cp >= 0x2E80 ? px * 1.0 : px * 0.6) * boldScale;
            }
            return { width: w };
        }
    };
}

function setupSpreadsheetDom() {
    const mocks = createDomMocks();
    const origCreate = mocks.mockDocument.createElement.bind(mocks.mockDocument);
    mocks.mockDocument.createElement = (tag) => {
        const el = origCreate(tag);
        if (tag === 'canvas') {
            el.getContext = () => createProportionalCanvasCtx();
        }
        return el;
    };
    return mocks;
}

test('autofit engine accurately measures ASCII/CJK/bold/large/multiline/wrapped/formula/merged/media cells and bounds', async () => {
    const { mockDocument, mockWindow } = setupSpreadsheetDom();
    await runWithDomGlobals({
        document: mockDocument,
        window: mockWindow,
        getComputedStyle: mockWindow.getComputedStyle
    }, () => {
        const { DataProxy, CellRange } = loadXSpreadsheetStack();
        const dp = new DataProxy('AutoFit', {
            mode: 'edit',
            evalPaused: false,
            view: { width: () => 900, height: () => 600 },
            row: { len: 12, height: 24 },
            col: { len: 8, width: 80, indexWidth: 60, minWidth: 24 }
        });

        dp.setData({
            name: 'AutoFit',
            styles: [
                { font: { name: 'Arial', size: 10, bold: false } },
                { font: { name: 'Arial', size: 24, bold: true } },
                { textwrap: true, font: { name: 'Arial', size: 10 } }
            ],
            merges: ['A5:C5', 'D1:D3'],
            media: [
                {
                    type: 'image',
                    imageId: 0,
                    range: {
                        tl: { nativeCol: 5, nativeRow: 7 },
                        br: { nativeCol: 5, nativeRow: 7 }
                    }
                }
            ],
            cols: {
                len: 8,
                0: { width: 50 },
                1: { width: 50 },
                2: { width: 50 },
                3: { width: 80 },
                4: { width: 60, hide: true },
                5: { width: 220 }
            },
            rows: {
                len: 12,
                0: {
                    height: 20,
                    cells: {
                        0: { text: '短', style: 0 },
                        1: { text: '这是一段很长的中文列标题用于测试列宽自适应', style: 0 },
                        2: { text: '=1000+2345', style: 0 },
                        3: { text: 'Row1\nRow2\nRow3\nRow4\nRow5\nRow6', merge: [2, 0], style: 0 },
                        4: { text: 'HIDDEN_COL_SHOULD_NOT_AFFECT_ROW_HEIGHT\nL2\nL3\nL4', style: 0 }
                    }
                },
                1: {
                    height: 20,
                    cells: {
                        0: { text: '大字号标题', style: 1 },
                        1: { text: '第一行\n第二行\n第三行', style: 0 }
                    }
                },
                2: {
                    height: 20,
                    cells: {
                        0: { text: '这是一段启用自动换行的超长文本内容用于验证在受限列宽下自动折行后行高能够正确撑开显示全部内容', style: 2 }
                    }
                },
                3: {
                    height: 20,
                    hide: true,
                    cells: {
                        0: { text: 'HIDDEN_ROW_SUPER_LONG_TEXT_SHOULD_NOT_STRETCH_COL_0_AT_ALL_1234567890', style: 0 }
                    }
                },
                4: {
                    height: 24,
                    cells: {
                        0: { text: '横跨三列的超宽合并大标题横跨三列的超宽合并大标题横跨三列的超宽合并大标题', merge: [0, 2], style: 0 }
                    }
                },
                7: {
                    height: 400,
                    cells: {
                        5: { text: '图', style: 0 }
                    }
                }
            }
        });

        // 1. Auto-fit all columns with maxColWidth cap
        const colWidths = dp.autoFitCols(0, null, { minColWidth: 40, maxColWidth: 260 });
        assert.ok(colWidths[1] > 200 && colWidths[1] <= 260, `Expected col 1 auto-fitted wide, got ${colWidths[1]}`);
        // Hidden column 4 remains hidden (width 0)
        assert.equal(dp.cols.isHide(4), true);
        assert.equal(dp.cols.getWidth(4), 0);
        // Horizontal merge A5:C5 distributes deficit smoothly rather than blowing up col 0 alone
        const mergedSpanW = dp.cols.getWidth(0) + dp.cols.getWidth(1) + dp.cols.getWidth(2);
        assert.ok(mergedSpanW >= 400, `Merged span width should expand across A..C, got ${mergedSpanW}`);
        // Media-anchored col 5 (width 220) is NOT shrunk down to fit single char '图'
        assert.ok(dp.cols.getWidth(5) >= 220, `Media column 5 must not shrink below 220, got ${dp.cols.getWidth(5)}`);
        // Empty column 6 remains at default 80
        assert.equal(dp.cols.getWidth(6), 80);

        // 2. Auto-fit all rows (respects textwrap, newlines, large fonts, vertical merges, media rows, hidden rows/cols)
        dp.cols.setWidth(0, 120); // Force narrow col 0 so row 2 wraps into many lines
        const rowHeights = dp.autoFitRows(0, null, { minRowHeight: 24, maxRowHeight: 600 });
        // Row 1 has 24pt bold text (~32px) AND 3 explicit lines -> > 55px
        assert.ok(rowHeights[1] >= 55, `Expected row 1 tall for 3 lines / 24pt, got ${rowHeights[1]}`);
        // Row 2 has textwrap long text at width 120 -> wraps into multiple lines -> tall row
        assert.ok(rowHeights[2] >= 75, `Expected wrapped row 2 tall, got ${rowHeights[2]}`);
        // Vertical merge D1:D3 (6 lines) ensures total height across rows 0..2 covers all 6 lines without crushing
        const vMergeTotal = dp.rows.getHeight(0) + dp.rows.getHeight(1) + dp.rows.getHeight(2);
        assert.ok(vMergeTotal >= 100);
        // Hidden row 3 stays hidden
        assert.equal(dp.rows.isHide(3), true);
        // Media-anchored row 7 (400px) is NOT shrunk to 24px!
        assert.ok(dp.rows.getHeight(7) >= 400, `Media row 7 must not shrink below 400, got ${dp.rows.getHeight(7)}`);
        // Edit mode pushes undo entry
        assert.equal(dp.canUndo(), true);

        // 3. Single column / single row auto-fit & SSR fallback (ctx: null)
        const ssrColW = dp.autoFitCol(2, { ctx: null, minColWidth: 40, maxColWidth: 300 });
        assert.ok(typeof ssrColW === 'number' && ssrColW >= 40);
        assert.equal(dp.autoFitCol(-1), null);
        assert.equal(dp.autoFitRow(999), null);

        // 4. autoFitAll runs columns first, then rows
        dp.selector.range = CellRange.valueOf('A1:A1');
        const allRes = dp.autoFitAll({ minColWidth: 40, maxColWidth: 300, minRowHeight: 24, maxRowHeight: 500 });
        assert.ok(allRes.cols && allRes.rows);

        // 5. Merge-only column/row stretched overly wide shrinks back cleanly on autoFit
        const dpMergeOnly = new DataProxy('MergeOnly', {
            mode: 'read',
            row: { len: 4, height: 24 },
            col: { len: 4, width: 80, indexWidth: 60, minWidth: 24 }
        });
        dpMergeOnly.setData({
            name: 'MergeOnly',
            merges: ['A1:B1', 'C1:C2'],
            cols: { len: 4, 0: { width: 280 }, 1: { width: 80 } },
            rows: {
                len: 4,
                0: { height: 200, cells: { 0: { text: '短标题', merge: [0, 1] }, 2: { text: '两行\n文本', merge: [1, 0] } } },
                1: { height: 200, cells: {} }
            }
        });
        dpMergeOnly.autoFitCol(0);
        assert.ok(dpMergeOnly.cols.getWidth(0) < 120, `Merge-only col 0 should shrink from 280, got ${dpMergeOnly.cols.getWidth(0)}`);
        dpMergeOnly.autoFitRow(0);
        assert.ok(dpMergeOnly.rows.getHeight(0) < 80, `Merge-only row 0 should shrink from 200, got ${dpMergeOnly.rows.getHeight(0)}`);
    });
});

test('Sheet read-only mode supports native Excel corner Select-All, Ctrl+A, straddling divider hover, batch header resize/auto-fit, and clean bottombar', async () => {
    const { mockDocument, mockWindow, windowListeners } = setupSpreadsheetDom();
    await runWithDomGlobals({
        document: mockDocument,
        window: mockWindow,
        getComputedStyle: mockWindow.getComputedStyle
    }, () => {
        const { Spreadsheet } = loadXSpreadsheetStack();
        const host = mockDocument.createElement('div');
        mockDocument.body.appendChild(host);

        const xs = new Spreadsheet(host, {
            mode: 'read',
            resizable: true,
            showToolbar: false,
            showContextmenu: false,
            showBottomBar: true,
            view: { width: () => 900, height: () => 500 },
            row: { len: 10, height: 24 },
            col: { len: 6, width: 60, indexWidth: 60, minWidth: 24 }
        });

        xs.loadData([
            {
                name: 'SheetA',
                styles: [{ textwrap: true, font: { name: 'Arial', size: 10 } }],
                cols: { len: 6, 0: { width: 50 }, 1: { width: 50 }, 2: { width: 50 } },
                rows: {
                    len: 10,
                    0: {
                        height: 20,
                        cells: {
                            0: { text: '一列非常长的中文标题需要自动展开宽度' },
                            1: { text: '第二列超长内容也需要自动展开宽度' },
                            2: { text: '第三列超长文本用于验证多列批量自适应隔离性' }
                        }
                    },
                    1: {
                        height: 20,
                        cells: {
                            0: { text: '第1行\n第2行\n第3行\n第4行', style: 0 }
                        }
                    },
                    2: {
                        height: 20,
                        cells: {
                            0: { text: '第三行A\n第三行B\n第三行C\n第三行D', style: 0 }
                        }
                    }
                }
            },
            {
                name: 'SheetB',
                cols: { len: 4, 0: { width: 45 } },
                rows: {
                    len: 5,
                    0: { height: 20, cells: { 0: { text: '第二个工作表的超长文本内容测试全部工作表自适应' } } }
                }
            }
        ]);

        // 0. Native bottombar: NO extra bottombar action buttons
        assert.equal(xs.bottombar.el.el.querySelectorAll('.x-spreadsheet-bottombar-actions').length, 0);
        assert.equal(xs.bottombar.el.el.querySelectorAll('.x-spreadsheet-bottombar-action-btn').length, 0);
        assert.equal(xs.bottombar.actionsEl, undefined);
        assert.equal(xs.bottombar.setShowAutoFitButtons, undefined);

        const canvasCtx = xs.sheet.table.draw.ctx;
        assert.ok(canvasCtx.fillCalls.includes('#c5c8ce'), 'Idle top-left Select-All triangle drawn in #c5c8ce');

        const selectedEvents = [];
        xs.on('cell-selected', (_cell, ri, ci) => selectedEvents.push(['cell', ri, ci]));
        xs.on('cells-selected', (_cell, range) => selectedEvents.push(['cells', range.sri, range.sci, range.eri, range.eci]));

        // 1. Clicking top-left Select-All corner selects entire sheet, fires cells-selected, and highlights triangle
        canvasCtx.fillCalls.length = 0;
        xs.sheet.overlayerEl.el.dispatchEvent({
            type: 'mousedown',
            button: 0,
            buttons: 1,
            clientX: 20,
            clientY: 12,
            offsetX: 20,
            offsetY: 12
        });
        mockWindow.dispatchEvent({ type: 'mouseup', buttons: 0, clientX: 20, clientY: 12 });
        assert.equal(xs.sheet.selector.range.sri, 0);
        assert.equal(xs.sheet.selector.range.sci, 0);
        assert.equal(xs.sheet.selector.range.eri, xs.data.rows.len - 1);
        assert.equal(xs.sheet.selector.range.eci, xs.data.cols.len - 1);
        assert.deepEqual(selectedEvents[0], ['cells', 0, 0, xs.data.rows.len - 1, xs.data.cols.len - 1]);
        assert.ok(canvasCtx.fillCalls.includes('#4b89ff'), 'Active Select-All triangle drawn in #4b89ff');

        // Clicking A1 restores single-cell selection and reverts triangle color
        canvasCtx.fillCalls.length = 0;
        xs.sheet.overlayerEl.el.dispatchEvent({
            type: 'mousedown',
            button: 0,
            buttons: 1,
            clientX: 80,
            clientY: 36,
            offsetX: 80,
            offsetY: 36
        });
        mockWindow.dispatchEvent({ type: 'mouseup', buttons: 0, clientX: 80, clientY: 36 });
        assert.equal(xs.sheet.selector.range.eri, 0);
        assert.equal(xs.sheet.selector.range.eci, 0);
        assert.ok(canvasCtx.fillCalls.includes('#c5c8ce'));

        // 2. Ctrl+A selects all when focusing is true, and never hijacks external inputs
        xs.sheet.focusing = true;
        let ctrlAPrevented = false;
        mockWindow.dispatchEvent({
            type: 'keydown',
            ctrlKey: true,
            keyCode: 65,
            preventDefault: () => { ctrlAPrevented = true; }
        });
        assert.equal(ctrlAPrevented, true);
        assert.equal(xs.sheet.selector.range.sri, 0);
        assert.equal(xs.sheet.selector.range.sci, 0);
        assert.equal(xs.sheet.selector.range.eri, xs.data.rows.len - 1);
        assert.equal(xs.sheet.selector.range.eci, xs.data.cols.len - 1);

        xs.sheet.overlayerEl.el.dispatchEvent({
            type: 'mousedown',
            button: 0,
            buttons: 1,
            clientX: 80,
            clientY: 36,
            offsetX: 80,
            offsetY: 36
        });
        mockWindow.dispatchEvent({ type: 'mouseup', buttons: 0, clientX: 80, clientY: 36 });
        const externalInput = mockDocument.createElement('input');
        mockDocument.body.appendChild(externalInput);
        mockDocument.activeElement = externalInput;
        let extPrevented = false;
        mockWindow.dispatchEvent({
            type: 'keydown',
            ctrlKey: true,
            keyCode: 65,
            target: externalInput,
            preventDefault: () => { extPrevented = true; }
        });
        assert.equal(extPrevented, false);
        assert.equal(xs.sheet.selector.range.eri, 0);
        mockDocument.activeElement = null;

        // 3. Hovering column header shows colResizer, and straddling 2px right of A|B divider targets Col A (ci = 0)
        xs.sheet.overlayerEl.el.dispatchEvent({
            type: 'mousemove',
            buttons: 0,
            clientX: 85,
            clientY: 12,
            offsetX: 85,
            offsetY: 12,
            target: xs.sheet.overlayerEl.el
        });
        assert.notEqual(xs.sheet.colResizer.el.css('display'), 'none');
        assert.equal(xs.sheet.colResizer.unhideHoverEl.css('display'), 'none');
        assert.equal(xs.sheet.colResizer.cRect.ci, 0);

        xs.sheet.overlayerEl.el.dispatchEvent({
            type: 'mousemove',
            buttons: 0,
            clientX: 112, // 2px right of A|B divider (60 + 50 = 110) inside Col B
            clientY: 12,
            offsetX: 112,
            offsetY: 12,
            target: xs.sheet.overlayerEl.el
        });
        assert.equal(xs.sheet.colResizer.cRect.ci, 0);
        assert.equal(xs.sheet.colResizer.el.css('left'), '105px');

        // Straddling 2px below Row 0|1 divider (24 + 20 = 44) inside Row 1 targets Row 0 (ri = 0)
        xs.sheet.overlayerEl.el.dispatchEvent({
            type: 'mousemove',
            buttons: 0,
            clientX: 25,
            clientY: 46,
            offsetX: 25,
            offsetY: 46,
            target: xs.sheet.overlayerEl.el
        });
        assert.equal(xs.sheet.rowResizer.cRect.ri, 0);
        assert.equal(xs.sheet.rowResizer.el.css('top'), '39px');

        // 4. Dragging single col & single row resizer in read mode updates sizes without undo history
        xs.sheet.overlayerEl.el.dispatchEvent({
            type: 'mousemove',
            buttons: 0,
            clientX: 85,
            clientY: 12,
            offsetX: 85,
            offsetY: 12,
            target: xs.sheet.overlayerEl.el
        });
        xs.sheet.colResizer.hoverEl.el.dispatchEvent({ type: 'mousedown', buttons: 1, clientX: 110, clientY: 12, stopPropagation() {} });
        Array.from(windowListeners.get('mousemove') || []).forEach(fn => fn({ buttons: 1, clientX: 180, clientY: 12 }));
        Array.from(windowListeners.get('mouseup') || []).forEach(fn => fn({ buttons: 0, clientX: 180, clientY: 12 }));
        assert.equal(xs.data.cols.getWidth(0), 120);
        assert.equal(xs.data.canUndo(), false);

        xs.sheet.overlayerEl.el.dispatchEvent({
            type: 'mousemove',
            buttons: 0,
            clientX: 25,
            clientY: 32,
            offsetX: 25,
            offsetY: 32,
            target: xs.sheet.overlayerEl.el
        });
        xs.sheet.rowResizer.hoverEl.el.dispatchEvent({ type: 'mousedown', buttons: 1, clientX: 25, clientY: 44, stopPropagation() {} });
        Array.from(windowListeners.get('mousemove') || []).forEach(fn => fn({ buttons: 1, clientX: 25, clientY: 94 }));
        Array.from(windowListeners.get('mouseup') || []).forEach(fn => fn({ buttons: 0, clientX: 25, clientY: 94 }));
        assert.equal(xs.data.rows.getHeight(0), 70);

        // 5. Double-click on colResizer hoverEl (after click without drag keeps hoverEl visible!) auto-fits column 0 only
        xs.sheet.overlayerEl.el.dispatchEvent({
            type: 'mousemove',
            buttons: 0,
            clientX: 85,
            clientY: 12,
            offsetX: 85,
            offsetY: 12,
            target: xs.sheet.overlayerEl.el
        });
        xs.sheet.colResizer.hoverEl.el.dispatchEvent({ type: 'mousedown', buttons: 1, clientX: 180, clientY: 12, stopPropagation() {} });
        Array.from(windowListeners.get('mouseup') || []).forEach(fn => fn({ buttons: 0, clientX: 180, clientY: 12 }));
        assert.notEqual(xs.sheet.colResizer.el.css('display'), 'none');
        xs.sheet.colResizer.hoverEl.el.dispatchEvent({ type: 'dblclick', stopPropagation() {} });
        assert.ok(xs.data.cols.getWidth(0) > 180, `Expected dblclick col 0 auto-fit > 180, got ${xs.data.cols.getWidth(0)}`);
        assert.equal(xs.data.cols.getWidth(1), 50);

        // 6. Select All (via corner click) -> dblclick ANY col divider auto-fits ALL columns; dblclick ANY row divider auto-fits ALL rows;
        //    drag ANY col/row divider uniformly resizes all visible cols/rows while preserving hidden col/row
        xs.data.cols.setWidth(0, 45);
        xs.data.cols.setWidth(1, 45);
        xs.data.cols.setWidth(2, 45);
        xs.data.rows.setHeight(0, 18);
        xs.data.rows.setHeight(1, 18);
        xs.data.rows.setHeight(2, 18);
        xs.data.cols.setHide(3, true);
        xs.data.rows.setHide(3, true);

        xs.sheet.overlayerEl.el.dispatchEvent({
            type: 'mousedown',
            button: 0,
            buttons: 1,
            clientX: 20,
            clientY: 12,
            offsetX: 20,
            offsetY: 12
        });
        xs.sheet.colResizer.cRect = { ri: -1, ci: 0, left: 60, top: 0, width: 45, height: 24 };
        xs.sheet.colResizer.hoverDblclickHandler();
        assert.ok(xs.data.cols.getWidth(0) > 150);
        assert.ok(xs.data.cols.getWidth(1) > 150);
        assert.ok(xs.data.cols.getWidth(2) > 150);
        assert.equal(xs.data.cols.isHide(3), true);

        xs.sheet.rowResizer.cRect = { ri: 0, ci: -1, left: 0, top: 24, width: 60, height: 18 };
        xs.sheet.rowResizer.hoverDblclickHandler();
        assert.ok(xs.data.rows.getHeight(1) >= 70);
        assert.ok(xs.data.rows.getHeight(2) >= 70);
        assert.equal(xs.data.rows.isHide(3), true);

        xs.sheet.colResizer.finishedFn({ ci: 0 }, 111);
        assert.equal(xs.data.cols.getWidth(0), 111);
        assert.equal(xs.data.cols.getWidth(1), 111);
        assert.equal(xs.data.cols.isHide(3), true);

        xs.sheet.rowResizer.finishedFn({ ri: 0 }, 33);
        assert.equal(xs.data.rows.getHeight(0), 33);
        assert.equal(xs.data.rows.getHeight(1), 33);
        assert.equal(xs.data.rows.isHide(3), true);

        xs.data.cols.unhide(3);
        xs.data.rows.unhide(3);

        // 7. Dragging across column headers A -> B even if cursor drifts down into cell area (offsetY=60) preserves full-col selection A:B
        xs.data.cols.setWidth(0, 45);
        xs.data.cols.setWidth(1, 45);
        xs.data.cols.setWidth(2, 45);
        xs.sheet.overlayerEl.el.dispatchEvent({
            type: 'mousedown',
            button: 0,
            buttons: 1,
            clientX: 80,
            clientY: 12,
            offsetX: 80,
            offsetY: 12
        });
        Array.from(windowListeners.get('mousemove') || []).forEach(fn => fn({
            buttons: 1,
            clientX: 125,
            clientY: 60,
            offsetX: 125,
            offsetY: 60
        }));
        Array.from(windowListeners.get('mouseup') || []).forEach(fn => fn({
            buttons: 0,
            clientX: 125,
            clientY: 60
        }));
        assert.deepEqual(
            [xs.sheet.selector.range.sri, xs.sheet.selector.range.sci, xs.sheet.selector.range.eri, xs.sheet.selector.range.eci],
            [0, 0, xs.data.rows.len - 1, 1]
        );
        xs.sheet.colResizer.cRect = { ri: -1, ci: 1, left: 105, top: 0, width: 45, height: 24 };
        xs.sheet.colResizer.hoverDblclickHandler();
        assert.ok(xs.data.cols.getWidth(0) > 150);
        assert.ok(xs.data.cols.getWidth(1) > 150);
        assert.equal(xs.data.cols.getWidth(2), 45, 'Unselected Col C must not change on A:B batch auto-fit');

        xs.sheet.colResizer.finishedFn({ ci: 1 }, 135);
        assert.equal(xs.data.cols.getWidth(0), 135);
        assert.equal(xs.data.cols.getWidth(1), 135);
        assert.equal(xs.data.cols.getWidth(2), 45);

        // Shift+Click column header from cell B3 -> selects B:D full columns
        xs.sheet.overlayerEl.el.dispatchEvent({
            type: 'mousedown',
            button: 0,
            buttons: 1,
            clientX: 210, // col 1 (60 + 135 = 195)
            clientY: 65,
            offsetX: 210,
            offsetY: 65
        });
        mockWindow.dispatchEvent({ type: 'mouseup', buttons: 0, clientX: 210, clientY: 65 });
        xs.sheet.overlayerEl.el.dispatchEvent({
            type: 'mousedown',
            button: 0,
            buttons: 1,
            shiftKey: true,
            clientX: 400, // col 3 (60 + 135 + 135 + 45 = 375)
            clientY: 12,
            offsetX: 400,
            offsetY: 12
        });
        assert.deepEqual(
            [xs.sheet.selector.range.sri, xs.sheet.selector.range.sci, xs.sheet.selector.range.eri, xs.sheet.selector.range.eci],
            [0, 1, xs.data.rows.len - 1, 3]
        );

        // 8. Dragging across row headers 1 -> 2 even if cursor drifts right into cell area preserves full-row selection 0:1
        xs.data.rows.setHeight(0, 18);
        xs.data.rows.setHeight(1, 18);
        xs.data.rows.setHeight(2, 18);
        xs.sheet.overlayerEl.el.dispatchEvent({
            type: 'mousedown',
            button: 0,
            buttons: 1,
            clientX: 25,
            clientY: 32,
            offsetX: 25,
            offsetY: 32
        });
        Array.from(windowListeners.get('mousemove') || []).forEach(fn => fn({
            buttons: 1,
            clientX: 120,
            clientY: 50,
            offsetX: 120,
            offsetY: 50
        }));
        Array.from(windowListeners.get('mouseup') || []).forEach(fn => fn({
            buttons: 0,
            clientX: 120,
            clientY: 50
        }));
        assert.deepEqual(
            [xs.sheet.selector.range.sri, xs.sheet.selector.range.sci, xs.sheet.selector.range.eri, xs.sheet.selector.range.eci],
            [0, 0, 1, xs.data.cols.len - 1]
        );
        xs.sheet.rowResizer.cRect = { ri: 1, ci: -1, left: 0, top: 42, width: 60, height: 18 };
        xs.sheet.rowResizer.hoverDblclickHandler();
        assert.ok(xs.data.rows.getHeight(1) >= 70);
        assert.equal(xs.data.rows.getHeight(2), 18, 'Unselected Row 3 must not change on 1:2 batch auto-fit');

        xs.sheet.rowResizer.finishedFn({ ri: 1 }, 42);
        assert.equal(xs.data.rows.getHeight(0), 42);
        assert.equal(xs.data.rows.getHeight(1), 42);
        assert.equal(xs.data.rows.getHeight(2), 18);

        // 9. Partial cell range selection A1:C1 + dragging Col 0 divider resizes ONLY Col 0
        xs.data.cols.setWidth(0, 50);
        xs.data.cols.setWidth(1, 60);
        xs.data.cols.setWidth(2, 70);
        xs.sheet.selector.set(0, 0);
        xs.sheet.selector.setEnd(0, 2, false);
        xs.sheet.colResizer.finishedFn({ ci: 0 }, 140);
        assert.equal(xs.data.cols.getWidth(0), 140);
        assert.equal(xs.data.cols.getWidth(1), 60);
        assert.equal(xs.data.cols.getWidth(2), 70);

        // 10. Double-clicking top-left corner selects all without running autoFitAll; programmatic allSheets:true still works
        xs.data.cols.setWidth(0, 40);
        xs.sheet.overlayerEl.el.dispatchEvent({
            type: 'mousedown',
            button: 0,
            buttons: 1,
            detail: 2,
            clientX: 20,
            clientY: 12,
            offsetX: 20,
            offsetY: 12
        });
        assert.equal(xs.data.cols.getWidth(0), 40);
        assert.equal(xs.sheet.selector.range.eri, xs.data.rows.len - 1);
        assert.equal(xs.sheet.selector.range.eci, xs.data.cols.len - 1);

        xs.autoFitAll({ allSheets: true });
        assert.ok(xs.datas[1].cols.getWidth(0) > 150, `Expected SheetB col 0 auto-fitted, got ${xs.datas[1].cols.getWidth(0)}`);

        // 11. resizable: false blocks hover resizer & resize finish
        xs.data.settings.resizable = false;
        const lockedW = xs.data.cols.getWidth(0);
        xs.sheet.overlayerEl.el.dispatchEvent({
            type: 'mousemove',
            buttons: 0,
            clientX: 85,
            clientY: 12,
            offsetX: 85,
            offsetY: 12,
            target: xs.sheet.overlayerEl.el
        });
        assert.equal(xs.sheet.colResizer.el.css('display'), 'none');
        xs.sheet.colResizer.finishedFn({ ci: 0 }, 999);
        assert.equal(xs.data.cols.getWidth(0), lockedW);

        xs.destroy();
    });
});

test('media.js calcPosition tracks live sheetData column widths and row heights dynamically', async () => {
    const mediaMod = await import('../packages/vue-excel/src/media.js');
    const sheet = {
        _columns: [{ width: 10 }, { width: 10 }],
        _rows: [{ height: 24 }, { height: 24 }],
        views: []
    };
    const range = {
        tl: { nativeCol: 1, nativeColOff: 0, nativeRow: 1, nativeRowOff: 0 },
        br: { nativeCol: 2, nativeColOff: 0, nativeRow: 2, nativeRowOff: 0 }
    };
    const before = mediaMod.calcPosition(sheet, range, { scroll: { x: 0, y: 0 } }, {});
    assert.equal(before.x, 60 + 60); // clipWidth 60 + col0 (10*6)
    assert.equal(before.y, 24 + 24); // clipHeight 24 + row0 (24)

    const liveData = {
        cols: { indexWidth: 60, getWidth: i => (i === 0 ? 180 : 120) },
        rows: { height: 24, getHeight: i => (i === 0 ? 64 : 80) },
        freeze: [0, 0],
        scroll: { x: 0, y: 0 }
    };
    const after = mediaMod.calcPosition(sheet, range, null, { sheetData: liveData });
    assert.equal(after.x, 60 + 180);
    assert.equal(after.y, 24 + 64);
    assert.equal(after.width, 120);
    assert.equal(after.height, 80);
});

test('vue-excel and js-excel enable resizable by default, support autoFit on load, and expose autoFit APIs', async () => {
    const { mockDocument, mockWindow } = setupSpreadsheetDom();

    await runWithDomGlobals({
        document: mockDocument,
        window: mockWindow,
        getComputedStyle: mockWindow.getComputedStyle
    }, async () => {
        const createdInstances = [];
        class FakeSpreadsheet {
            constructor(el, options) {
                this.el = el;
                this.options = options;
                this.datas = [{ settings: { ...options }, getSelectedRect: () => ({ scroll: { x: 0, y: 0 } }) }];
                this.autoFitCalls = [];
                this.bottombar = {
                    swapFunc: () => {}
                };
                this.sheet = {
                    data: this.datas[0],
                    contextMenu: { isHide: !options.showContextmenu },
                    rowResizer: { hide() {} },
                    colResizer: { hide() {} },
                    table: { render() {} },
                    editor: { setOffset() {} },
                    reload() {}
                };
                createdInstances.push(this);
            }
            loadData() { return this; }
            on() { return this; }
            autoFitCol(ci, opts) { this.autoFitCalls.push(['col', ci, opts]); return this; }
            autoFitAllCols(opts) { this.autoFitCalls.push(['allCols', opts]); return this; }
            autoFitRow(ri, opts) { this.autoFitCalls.push(['row', ri, opts]); return this; }
            autoFitAllRows(opts) { this.autoFitCalls.push(['allRows', opts]); return this; }
            autoFitAll(opts) { this.autoFitCalls.push(['all', opts]); return this; }
            destroy() {}
        }

        // 1. vue-excel/src/main.vue
        const mountedVue = mountSfcScript(
            'packages/vue-excel/src/main.vue',
            {
                Spreadsheet: FakeSpreadsheet,
                getData: () => Promise.resolve(new ArrayBuffer(8)),
                readExcelData: () => Promise.resolve({ _worksheets: [{}] }),
                transferExcelToSpreadSheet: () => ({
                    workbookData: [{ name: 'S1' }],
                    medias: [],
                    workbookSource: { _worksheets: [{}] }
                }),
                renderImage: () => {},
                clearCache: () => {},
                readOnlyInput: () => {},
                debounce,
                downloadFile: () => {}
            },
            {
                src: 'https://example.com/demo.xlsx',
                options: { autoFit: true, autoFitMaxColWidth: 420 }
            },
            {
                wrapperRef: mockDocument.createElement('div'),
                rootRef: mockDocument.createElement('div')
            }
        );
        mountedVue.mount();
        await new Promise(r => setTimeout(r, 20));

        const vueXs = createdInstances[0];
        assert.equal(vueXs.options.resizable, true);
        assert.equal(vueXs.options.col.minWidth, 24);
        assert.ok(vueXs.autoFitCalls.some(c => c[0] === 'allCols' && c[1].allSheets === true && c[1].maxColWidth === 420));
        assert.ok(vueXs.autoFitCalls.some(c => c[0] === 'allRows' && c[1].allSheets === true));

        mountedVue.setupResult.autoFitCol(2);
        mountedVue.setupResult.autoFitRow(3);
        mountedVue.setupResult.autoFitAllCols();
        mountedVue.setupResult.autoFitAllRows();
        mountedVue.setupResult.autoFitAll({ allSheets: true });
        assert.ok(vueXs.autoFitCalls.some(c => c[0] === 'col' && c[1] === 2));
        assert.ok(vueXs.autoFitCalls.some(c => c[0] === 'row' && c[1] === 3));
        assert.ok(vueXs.autoFitCalls.some(c => c[0] === 'all' && c[1].allSheets === true));

        mountedVue.setProp('options', { autoFit: true, resizable: false });
        assert.equal(vueXs.datas[0].settings.resizable, false);
        mountedVue.unmount();

        // 2. js-excel/src/main.js
        const jsExcelMod = loadStrippedModule('packages/js-excel/src/main.js', {
            Spreadsheet: FakeSpreadsheet,
            getData: () => Promise.resolve(new ArrayBuffer(8)),
            readExcelData: () => Promise.resolve({ _worksheets: [{}] }),
            transferExcelToSpreadSheet: () => ({
                workbookData: [{ name: 'JS1' }],
                medias: [],
                workbookSource: { _worksheets: [{}] }
            }),
            renderImage: () => {},
            clearCache: () => {},
            readOnlyInput: () => {},
            debounce,
            downloadFile: () => {}
        });
        const container = mockDocument.createElement('div');
        const jsInst = jsExcelMod.init(container, { autoFitCol: true, autoFitRow: true });
        await jsInst.preview('https://example.com/demo.xlsx');

        const jsXs = createdInstances[1];
        assert.equal(jsXs.options.resizable, true);
        assert.ok(jsXs.autoFitCalls.some(c => c[0] === 'allCols' && c[1].allSheets === true));
        assert.ok(jsXs.autoFitCalls.some(c => c[0] === 'allRows' && c[1].allSheets === true));

        jsInst.autoFitCol(1);
        jsInst.autoFitRow(2);
        jsInst.autoFitAllCols();
        jsInst.autoFitAllRows();
        jsInst.autoFitAll({ allSheets: true });
        assert.ok(jsXs.autoFitCalls.some(c => c[0] === 'col' && c[1] === 1));
        assert.ok(jsXs.autoFitCalls.some(c => c[0] === 'row' && c[1] === 2));
        assert.ok(jsXs.autoFitCalls.some(c => c[0] === 'all' && c[1].allSheets === true));

        jsInst.setOptions({ resizable: false });
        assert.equal(jsXs.datas[0].settings.resizable, false);
        jsInst.destroy();
    });
});
