import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { getUrlAsync } from '../utils/url.js';
import { calcPosition, renderImage } from '../packages/vue-excel/src/media.js';
import {
    CORE_DIR,
    createDomMocks,
    loadExcelModule,
    loadStrippedModule,
    runWithDomGlobals
} from './helpers/load-module.mjs';

const require = createRequire(import.meta.url);
const xlsx = require('xlsx');
const JSZip = require('jszip');

function toArrayBuffer(buf) {
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

test('real fixture test.xlsx integrates through excel.js, media.js, and x-spreadsheet without circularity', async () => {
    const excelMod = loadExcelModule();
    const raw = fs.readFileSync(path.join(CORE_DIR, 'public/static/test-files/test.xlsx'));
    const wb = await excelMod.readExcelData(toArrayBuffer(raw), false);
    const transferred = excelMod.transferExcelToSpreadSheet(wb, { minColLength: 0, minRowLength: 0 });

    const sheetNames = transferred.workbookData.map(s => s.name);
    assert.deepEqual(sheetNames, ['色彩', '图片预览', '公式', '空白']);

    // Sheet 1 (色彩): 18 merges, style deduplication, valid non-circular JSON
    assert.equal(transferred.workbookData[0].merges.length, 18);
    assert.ok(transferred.workbookData[0].styles.length > 0);
    assert.doesNotThrow(() => JSON.stringify(transferred.workbookData));

    // Sheet 2 (图片预览): outer red right border preserved on A3:G3 + 1 image drawn onto canvas
    const picSheet = transferred.workbookData[1];
    assert.equal(picSheet.merges.length, 3);
    const a3Cell = picSheet.rows[2].cells[0];
    assert.ok(a3Cell && a3Cell.style !== undefined);
    assert.equal(picSheet.styles[a3Cell.style].border.right[1].toLowerCase(), '#ff0000');

    const srcPicSheet = transferred.workbookSource._worksheets[1];
    assert.equal(transferred.medias.length, 1);
    assert.equal(srcPicSheet._media.length, 1);

    const pos = calcPosition(srcPicSheet, srcPicSheet._media[0].range, { scroll: { x: 0, y: 0 } }, {});
    assert.ok(Number.isFinite(pos.width) && pos.width > 0);
    assert.ok(Number.isFinite(pos.height) && pos.height > 0);

    const drawn = [];
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = () => 'blob:fixture-img';
    URL.revokeObjectURL = () => {};
    class MockImage {
        constructor() { this.width = 200; this.height = 100; }
        set src(_v) { queueMicrotask(() => this.onload && this.onload()); }
    }
    try {
        await runWithDomGlobals({ window: { devicePixelRatio: 1 }, Image: MockImage }, async () => {
            await renderImage(
                { drawImage: (...args) => drawn.push(args) },
                transferred.medias,
                srcPicSheet,
                { scroll: { x: 0, y: 0 } },
                {},
                () => true
            );
            assert.equal(drawn.length, 1);
        });
    } finally {
        URL.createObjectURL = origCreate;
        URL.revokeObjectURL = origRevoke;
    }

    // Sheet 3 (公式) & Sheet 4 (空白)
    assert.ok(Object.keys(transferred.workbookData[2].rows).length >= 2);
    assert.ok(Number.isInteger(transferred.workbookData[3].rows.len) && transferred.workbookData[3].rows.len >= 0);
    assert.ok(Number.isInteger(transferred.workbookData[3].cols.len) && transferred.workbookData[3].cols.len >= 0);

    // Load all 4 sheets into real Spreadsheet
    const { mockDocument, mockWindow } = createDomMocks();
    await runWithDomGlobals({ document: mockDocument, window: mockWindow, getComputedStyle: mockWindow.getComputedStyle }, () => {
        const alphabetMod = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/alphabet.js');
        const { CellRange } = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/cell_range.js', {
            expr2xy: alphabetMod.expr2xy, xy2expr: alphabetMod.xy2expr
        });
        const { Merges } = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/merge.js', { CellRange });
        const helperMod = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/helper.js');
        const { Rows } = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/row.js', { helper: helperMod, expr2expr: alphabetMod.expr2expr, expr2xy: alphabetMod.expr2xy, stringAt: alphabetMod.stringAt });
        const { Cols } = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/col.js', { helper: helperMod });
        const History = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/history.js');
        const Clipboard = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/clipboard.js');
        const Scroll = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/scroll.js');
        const CoreSelector = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/selector.js', { CellRange });
        const AutoFilter = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/auto_filter.js', { CellRange });
        const enLocale = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/locale/en.js');
        const { t, tf, locale } = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/locale/locale.js', { en: enLocale });
        const Validator = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/validator.js', { t, helper: helperMod });
        const { Validations } = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/validation.js', { Validator, CellRange });
        const fontMod = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/font.js');
        const formatMod = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/format.js', { tf });
        const { formulas, formulam } = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/formula.js', { tf, numberCalc: helperMod.numberCalc });
        const cellMod = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/cell.js', { expr2xy: alphabetMod.expr2xy, xy2expr: alphabetMod.xy2expr, numberCalc: helperMod.numberCalc });
        const DataProxy = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/data_proxy.js', {
            Selector: CoreSelector, Scroll, History, Clipboard, AutoFilter, Merges, helper: helperMod, Rows, Cols, Validations, CellRange, expr2xy: alphabetMod.expr2xy, xy2expr: alphabetMod.xy2expr, t
        });
        const eventMod = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/event.js');
        const { Element, h } = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/element.js');
        const Icon = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/icon.js', { Element, h, cssPrefix: 'x-spreadsheet' });
        const Button = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/button.js', { Element, cssPrefix: 'x-spreadsheet', t });
        const tooltipMod = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/tooltip.js', { h, bind: eventMod.bind, unbind: eventMod.unbind, cssPrefix: 'x-spreadsheet' });
        const messageMod = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/message.js', { h, Icon, bind: eventMod.bind, unbind: eventMod.unbind, cssPrefix: 'x-spreadsheet' });
        const Dropdown = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/dropdown.js', { Element, h, bindClickoutside: eventMod.bindClickoutside, unbindClickoutside: eventMod.unbindClickoutside, cssPrefix: 'x-spreadsheet' });
        const ColorPalette = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/color_palette.js', { h, cssPrefix: 'x-spreadsheet' });
        const DropdownColor = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/dropdown_color.js', { Dropdown, ColorPalette, Icon });
        const DropdownAlign = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/dropdown_align.js', { Dropdown, h, Icon, cssPrefix: 'x-spreadsheet' });
        const DropdownFont = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/dropdown_font.js', { Dropdown, h, baseFonts: fontMod.baseFonts, cssPrefix: 'x-spreadsheet' });
        const DropdownFontSize = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/dropdown_fontsize.js', { Dropdown, h, fontSizes: fontMod.fontSizes, cssPrefix: 'x-spreadsheet' });
        const DropdownFormat = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/dropdown_format.js', { Dropdown, h, baseFormats: formatMod.baseFormats, cssPrefix: 'x-spreadsheet' });
        const DropdownFormula = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/dropdown_formula.js', { Dropdown, h, Icon, baseFormulas: formulas, cssPrefix: 'x-spreadsheet' });
        const DropdownLineType = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/dropdown_linetype.js', { Dropdown, h, Icon, cssPrefix: 'x-spreadsheet' });
        const BorderPalette = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/border_palette.js', { h, Icon, DropdownColor, DropdownLineType, cssPrefix: 'x-spreadsheet' });
        const DropdownBorder = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/dropdown_border.js', { Dropdown, Icon, BorderPalette });
        const ContextMenu = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/contextmenu.js', { h, bindClickoutside: eventMod.bindClickoutside, unbindClickoutside: eventMod.unbindClickoutside, cssPrefix: 'x-spreadsheet', tf });
        const Scrollbar = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/scrollbar.js', { h, cssPrefix: 'x-spreadsheet' });
        const Item = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/item.js', { cssPrefix: 'x-spreadsheet', tooltip: tooltipMod, h, t });
        const IconItem = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/icon_item.js', { Item, Icon });
        const ToggleItem = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/toggle_item.js', { Item, Icon });
        const DropdownItem = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/dropdown_item.js', { Dropdown, Item });
        const Toolbar = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/index.js', {
            Align: loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/align.js', { DropdownItem, DropdownAlign }),
            Valign: loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/valign.js', { DropdownItem, DropdownAlign }),
            Autofilter: loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/autofilter.js', { ToggleItem }),
            Bold: loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/bold.js', { ToggleItem }),
            Italic: loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/italic.js', { ToggleItem }),
            Strike: loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/strike.js', { ToggleItem }),
            Underline: loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/underline.js', { ToggleItem }),
            Border: loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/border.js', { DropdownItem, DropdownBorder }),
            Clearformat: loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/clearformat.js', { IconItem }),
            Paintformat: loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/paintformat.js', { ToggleItem }),
            TextColor: loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/text_color.js', { DropdownItem, DropdownColor }),
            FillColor: loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/fill_color.js', { DropdownItem, DropdownColor }),
            FontSize: loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/font_size.js', { DropdownItem, DropdownFontSize, DropdownFontsize: DropdownFontSize }),
            Font: loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/font.js', { DropdownItem, DropdownFont }),
            Format: loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/format.js', { DropdownItem, DropdownFormat }),
            Formula: loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/formula.js', { DropdownItem, DropdownFormula }),
            Freeze: loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/freeze.js', { ToggleItem }),
            Merge: loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/merge.js', { ToggleItem }),
            Redo: loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/redo.js', { IconItem }),
            Undo: loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/undo.js', { IconItem }),
            Print: loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/print.js', { IconItem }),
            Textwrap: loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/textwrap.js', { ToggleItem }),
            More: loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/more.js', { Dropdown, DropdownItem, cssPrefix: 'x-spreadsheet', h, Icon }),
            Item, h, cssPrefix: 'x-spreadsheet', bind: eventMod.bind, unbind: eventMod.unbind, hideTooltip: tooltipMod.hideTooltip
        });
        const Suggest = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/suggest.js', { h, bindClickoutside: eventMod.bindClickoutside, unbindClickoutside: eventMod.unbindClickoutside, cssPrefix: 'x-spreadsheet' });
        const Calendar = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/calendar.js', { h, Icon, t });
        const Datepicker = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/datepicker.js', { Calendar, h, cssPrefix: 'x-spreadsheet' });
        const Editor = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/editor.js', { h, Suggest, Datepicker, cssPrefix: 'x-spreadsheet' });
        const FormInput = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/form_input.js', { h, cssPrefix: 'x-spreadsheet' });
        const FormSelect = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/form_select.js', { h, Suggest, cssPrefix: 'x-spreadsheet' });
        const FormField = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/form_field.js', { h, cssPrefix: 'x-spreadsheet', t });
        const Modal = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/modal.js', { h, Icon, cssPrefix: 'x-spreadsheet', bind: eventMod.bind, unbind: eventMod.unbind });
        const ModalValidation = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/modal_validation.js', { Modal, FormInput, FormSelect, FormField, Button, t, h, cssPrefix: 'x-spreadsheet' });
        const SortFilter = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/sort_filter.js', { h, Button, bindClickoutside: eventMod.bindClickoutside, unbindClickoutside: eventMod.unbindClickoutside, cssPrefix: 'x-spreadsheet', t });
        const Resizer = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/resizer.js', { h, mouseMoveUp: eventMod.mouseMoveUp, cssPrefix: 'x-spreadsheet' });
        const Selector = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/selector.js', { h, cssPrefix: 'x-spreadsheet', CellRange });
        const drawMod = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/canvas/draw.js');
        const Table = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/table.js', {
            stringAt: alphabetMod.stringAt, getFontSizePxByPt: fontMod.getFontSizePxByPt, _cell: cellMod, formulam, formatm: formatMod.formatm, Draw: drawMod.Draw, DrawBox: drawMod.DrawBox, thinLineWidth: drawMod.thinLineWidth, npx: drawMod.npx
        });
        const Print = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/print.js', { h, cssPrefix: 'x-spreadsheet', Button, Draw: drawMod.Draw, npx: drawMod.npx, renderCell: Table.renderCell, t });
        const Bottombar = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/bottombar.js', { h, bindClickoutside: eventMod.bindClickoutside, unbindClickoutside: eventMod.unbindClickoutside, cssPrefix: 'x-spreadsheet', Icon, FormInput, Dropdown, tf });
        const Sheet = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/sheet.js', {
            h, bind: eventMod.bind, unbind: eventMod.unbind, mouseMoveUp: eventMod.mouseMoveUp, bindTouch: eventMod.bindTouch, createEventEmitter: eventMod.createEventEmitter,
            Resizer, Scrollbar, Selector, Editor, Print, ContextMenu, Table, Toolbar, ModalValidation, SortFilter, xtoast: messageMod.xtoast, clearToasts: messageMod.clearToasts, cssPrefix: 'x-spreadsheet', formulas
        });
        const Spreadsheet = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/index.js', { h, DataProxy, Sheet, Bottombar, cssPrefix: 'x-spreadsheet', locale });

        const host = mockDocument.createElement('div');
        const xs = new Spreadsheet(host, { mode: 'read', evalPaused: true, showToolbar: false, view: { width: () => 1000, height: () => 600 } });
        xs.loadData(transferred.workbookData);
        assert.equal(xs.datas.length, 4);
        assert.doesNotThrow(() => xs.reRender());
        xs.destroy();
    });
});

test('rich BIFF8 .xls preserves numFmt dates, percents, currencies, and merges', async () => {
    const excelMod = loadExcelModule();
    const xlsWb = xlsx.utils.book_new();
    const ws = xlsx.utils.aoa_to_sheet([
        ['Date', 'Rate', 'Amount'],
        [45672, 0.256, -1234.56]
    ]);
    ws.A2.z = 'yyyy-mm-dd';
    ws.B2.z = '0.0%';
    ws.C2.z = '#,##0.00';
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
    xlsx.utils.book_append_sheet(xlsWb, ws, 'RichXls');
    const xlsBytes = xlsx.write(xlsWb, { bookType: 'xls', type: 'array' });

    const parsed = await excelMod.readExcelData(new Uint8Array(xlsBytes).buffer, true);
    const { workbookData } = excelMod.transferExcelToSpreadSheet(parsed, { minColLength: 0, minRowLength: 0 });
    const s = workbookData[0];
    assert.equal(s.name, 'RichXls');
    assert.equal(s.rows[1].cells[0].text, '2025-01-15');
    assert.equal(s.rows[1].cells[1].text, '25.6%');
    assert.equal(s.rows[1].cells[2].text, '-1,234.56');
    assert.deepEqual(s.merges, ['A1:B1']);
});

test('real fixtures test.docx and test2.docx are valid OOXML archives and work through vue-docx/src/docx.js getBlob', async () => {
    const docxHelper = loadStrippedModule('packages/vue-docx/src/docx.js', {
        normalizeFetchOptions: opts => opts || {},
        parseAsync: async b => b,
        renderDocument: async () => {}
    });

    for (const fname of ['test.docx', 'test2.docx']) {
        const raw = fs.readFileSync(path.join(CORE_DIR, 'public/static/test-files', fname));
        const ab = toArrayBuffer(raw);
        const zip = await JSZip.loadAsync(ab);
        assert.ok(zip.file('word/document.xml'), `${fname} missing word/document.xml`);
        assert.ok(zip.file('[Content_Types].xml'), `${fname} missing [Content_Types].xml`);
        assert.ok(zip.file('_rels/.rels'), `${fname} missing _rels/.rels`);

        const sub = new Uint8Array(ab).subarray(0);
        const blobFromView = await docxHelper.getBlob(sub);
        assert.ok(blobFromView instanceof Blob);
        assert.equal(blobFromView.size, ab.byteLength);

        const resp = new Response(ab);
        const blobFromResp = await docxHelper.getBlob(resp);
        assert.ok(blobFromResp instanceof Blob);
        assert.equal(blobFromResp.size, ab.byteLength);
    }

    await assert.rejects(JSZip.loadAsync(new Uint8Array([0x50, 0x4b, 0xff, 0x00])));
});

test('real fixtures test.pdf and test.pptx binary loading and base64 pdfjs bundles integrity', async () => {
    const pdfRaw = fs.readFileSync(path.join(CORE_DIR, 'public/static/test-files/test.pdf'));
    assert.equal(pdfRaw.subarray(0, 5).toString('ascii'), '%PDF-');

    const jsPdfStrMod = await import('../packages/js-pdf/src/pdf.js');
    const jsWorkerStrMod = await import('../packages/js-pdf/src/worker.js');
    const decodedPdf = Buffer.from(jsPdfStrMod.pdfLibJsStr, 'base64').toString('utf8');
    const decodedWorker = Buffer.from(jsWorkerStrMod.workerStr, 'base64').toString('utf8');
    assert.ok(decodedPdf.includes('pdfjsLib'));
    assert.ok(decodedWorker.includes('WorkerMessageHandler'));

    const vuePdfRaw = fs.readFileSync(path.join(CORE_DIR, 'packages/vue-pdf/src/pdf.js'), 'utf8');
    const vueWorkerRaw = fs.readFileSync(path.join(CORE_DIR, 'packages/vue-pdf/src/worker.js'), 'utf8');
    assert.ok(vuePdfRaw.includes('pdfjsLib'));
    assert.ok(vueWorkerRaw.includes('WorkerMessageHandler'));

    const pptxRaw = fs.readFileSync(path.join(CORE_DIR, 'public/static/test-files/test.pptx'));
    assert.equal(pptxRaw.subarray(0, 2).toString('ascii'), 'PK');
    const pptxAb = toArrayBuffer(pptxRaw);
    const createdUrls = [];
    const origCreate = URL.createObjectURL;
    URL.createObjectURL = (blob) => {
        createdUrls.push(blob);
        return `blob:mock-${createdUrls.length}`;
    };
    try {
        const u1 = await getUrlAsync(pdfRaw.subarray(0, 128), { type: 'application/pdf' });
        const u2 = await getUrlAsync(new Response(pptxAb.slice(0, 256)));
        assert.ok(u1.startsWith('blob:mock-'));
        assert.ok(u2.startsWith('blob:mock-'));
        assert.equal(createdUrls[0].size, 128);
        assert.equal(createdUrls[1].size, 256);
    } finally {
        URL.createObjectURL = origCreate;
    }
});
