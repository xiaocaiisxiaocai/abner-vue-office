import test from 'node:test';
import assert from 'node:assert/strict';
import { getDarkColor, getLightColor } from '../packages/vue-excel/src/color.js';
import { isTest } from '../utils/test.js';
import {
    createCanvasContextMock,
    loadExcelModule,
    loadStrippedModule,
    runWithDomGlobals
} from './helpers/load-module.mjs';

function buildCoreSuite() {
    const alphabetMod = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/alphabet.js');
    const { CellRange } = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/cell_range.js', {
        expr2xy: alphabetMod.expr2xy,
        xy2expr: alphabetMod.xy2expr
    });
    const { Merges } = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/merge.js', { CellRange });
    const helperMod = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/helper.js');
    const { Rows, shiftFormulaRefs } = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/row.js', {
        helper: helperMod,
        expr2expr: alphabetMod.expr2expr,
        expr2xy: alphabetMod.expr2xy,
        stringAt: alphabetMod.stringAt
    });
    const { Cols } = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/col.js', { helper: helperMod });
    const History = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/history.js');
    const Clipboard = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/clipboard.js');
    const Scroll = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/scroll.js');
    const CoreSelector = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/selector.js', { CellRange });
    const AutoFilter = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/auto_filter.js', { CellRange });
    const enLocale = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/locale/en.js');
    const localeMod = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/locale/locale.js', { en: enLocale });
    const Validator = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/validator.js', {
        t: localeMod.t,
        helper: helperMod
    });
    const { Validations } = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/validation.js', {
        Validator,
        CellRange
    });
    const fontMod = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/font.js');
    const formatMod = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/format.js', { tf: localeMod.tf });
    const { formulam } = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/formula.js', {
        tf: localeMod.tf,
        numberCalc: helperMod.numberCalc
    });
    const cellMod = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/cell.js', {
        expr2xy: alphabetMod.expr2xy,
        xy2expr: alphabetMod.xy2expr,
        numberCalc: helperMod.numberCalc
    });
    const DataProxy = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/data_proxy.js', {
        Selector: CoreSelector,
        Scroll,
        History,
        Clipboard,
        AutoFilter,
        Merges,
        helper: helperMod,
        Rows,
        shiftFormulaRefs,
        Cols,
        Validations,
        CellRange,
        expr2xy: alphabetMod.expr2xy,
        xy2expr: alphabetMod.xy2expr,
        t: localeMod.t
    });

    return {
        alphabetMod, CellRange, Merges, helperMod, Rows, Cols, History, Clipboard,
        AutoFilter, enLocale, localeMod, Validator, Validations, fontMod, formatMod, formulam, cellMod, DataProxy
    };
}

test('excel.js covers DST UTC dates, formatNumberValue scaling/sci/empty/currency, elapsed time/AM-PM, theme XML, and alignment/strike/underline', async () => {
    const excelMod = loadExcelModule();

    // DST transition dates must NOT shift by +-1 hour
    assert.equal(excelMod.formatExcelDate(new Date(Date.UTC(2025, 2, 9, 9, 30, 0)), 'YYYY-MM-DD HH:mm:ss'), '2025-03-09 09:30:00');
    assert.equal(excelMod.formatExcelDate(new Date(Date.UTC(2025, 10, 2, 8, 30, 0)), 'YYYY-MM-DD HH:mm:ss'), '2025-11-02 08:30:00');

    // Empty sections, scaling commas, scientific notation, trailing currency, multi quotes/escapes, percent with commas/literals
    assert.equal(excelMod.formatNumberValue(0, '0;-0;'), '');
    assert.equal(excelMod.formatNumberValue(-5, '0;;'), '');
    assert.equal(excelMod.formatNumberValue(1500000, '#,##0,'), '1,500');
    assert.equal(excelMod.formatNumberValue(1500000, '0.0,,"M"'), '1.5M');
    assert.equal(excelMod.formatNumberValue(12345, '0.00E+00'), '1.23E+04');
    assert.equal(excelMod.formatNumberValue(5, '0E+00'), '5E+00');
    assert.equal(excelMod.formatNumberValue(123.45, '#,##0.00 [$€-407]'), '123.45 €');
    assert.equal(excelMod.formatNumberValue(12.5, '0.00\\€'), '12.50€');
    assert.equal(excelMod.formatNumberValue(10, '"A""B"0"C""D"'), 'AB10CD');
    assert.equal(excelMod.formatNumberValue(12.3456, '#,##0.00%'), '1,234.56%');
    assert.equal(excelMod.formatNumberValue(0.125, '"增长 "0.0%"同比"'), '增长 12.5%同比');
    assert.equal(excelMod.formatNumberValue(-0.125, '0.00%;(0.00%)'), '(12.50%)');
    assert.equal(excelMod.formatNumberValue(0, 'General'), '0');

    // Elapsed time, quoted 'day' inside time, year-month, AM/PM, Chinese weekday
    assert.equal(excelMod.formatExcelDateByNumFmt(new Date(Date.UTC(1899, 11, 31, 12, 0, 0)), '[h]:mm:ss'), '36:00:00');
    assert.equal(excelMod.formatExcelDateByNumFmt(new Date(Date.UTC(1899, 11, 30, 9, 15, 0)), 'h:mm"day"'), '09:15');
    assert.equal(excelMod.formatExcelDateByNumFmt(new Date(Date.UTC(2025, 2, 15)), 'yyyy-mm'), '2025-03');
    assert.equal(excelMod.formatExcelDateByNumFmt(new Date(Date.UTC(2025, 2, 15, 14, 30, 0)), 'h:mm AM/PM'), '2:30 PM');
    assert.equal(excelMod.formatExcelDateByNumFmt(new Date(Date.UTC(2025, 0, 1)), '[$-F800]dddd, mmmm dd, yyyy'), '2025年1月1日 周三');

    // Hyperlink falsy 0 text
    assert.equal(excelMod.getCellText({ type: 5, value: { text: 0, hyperlink: 'https://example.com' } }), '0');
    assert.equal(excelMod.getCellText({ type: 10, value: null, text: { error: '#VALUE!' } }), '#VALUE!');
    assert.equal(excelMod.getCellText({ type: 8, text: 'FallbackRich', value: {} }), 'FallbackRich');

    // Style: strike, underline, justify/distributed normalization, gradient & indexed[65], workbook theme XML, freeze views
    const st = excelMod.getStyle({
        style: {
            fill: { type: 'gradient', stops: [{ color: { indexed: 65 } }] },
            font: { strike: true, underline: 'single', bold: true, italic: true, size: 16, name: 'Arial' },
            alignment: { horizontal: 'centerContinuous', vertical: 'justify' }
        }
    });
    assert.equal(st.bgcolor, '#FFFFFF');
    assert.equal(st.strike, true);
    assert.equal(st.underline, true);
    assert.equal(st.align, 'center');
    assert.equal(st.valign, 'middle');
    assert.equal(st.fill, undefined);
    assert.equal(st.border2, undefined);

    const wbWithThemeAndFreeze = {
        media: [],
        _themes: {
            theme1: '<a:clrScheme name="Custom"><a:accent1><a:srgbClr val="123456"/></a:accent1><a:hlink><a:srgbClr val="ABCDEF"/></a:hlink></a:clrScheme>'
        },
        eachSheet(cb) { cb(this._worksheets[1]); },
        _worksheets: [null, {
            name: 'Frozen',
            views: [{ state: 'frozen', ySplit: 2, xSplit: 1 }],
            _merges: {
                A1: { shortRange: 'A1:B2', tl: 'A1', br: 'B2', model: { top: 1, left: 1, bottom: 2, right: 2 } }
            },
            columns: [{ width: 0 }, { width: 15 }],
            _rows: [
                {
                    height: 30,
                    _cells: [
                        { type: 3, value: 'Master', _address: 'A1', style: { font: { color: { theme: 10 } }, border: { top: { style: 'thin', color: { argb: 'FF000000' } } } } },
                        { type: 3, value: 'TR', isMerged: true, master: { address: 'A1' }, _address: 'B1', style: { border: { right: { style: 'medium', color: { argb: 'FFFF0000' } } } } }
                    ]
                },
                {
                    height: 30,
                    _cells: [
                        { type: 3, value: 'BL', isMerged: true, master: { address: 'A1' }, _address: 'A2', style: { border: { bottom: { style: 'double', color: { argb: 'FF00FF00' } } } } },
                        { type: 3, value: 'BR', isMerged: true, master: { address: 'A1' }, _address: 'B2', style: {} }
                    ]
                }
            ]
        }]
    };
    const origWorksheets = wbWithThemeAndFreeze._worksheets;
    const out = excelMod.transferExcelToSpreadSheet(wbWithThemeAndFreeze, { minColLength: 0, minRowLength: 0, heightOffset: 5 });
    // Original _worksheets is NOT mutated
    assert.equal(wbWithThemeAndFreeze._worksheets, origWorksheets);
    assert.deepEqual(out.workbookData[0].freeze, [2, 1]);
    assert.equal(out.workbookData[0].cols[0].hide, true);
    // Col 0 is hidden (width: 0), so A1:B2 remaps its visible merge master to B1 (cells[1]) with B1:B2 range
    assert.deepEqual(out.workbookData[0].merges, ['B1:B2']);
    const masterStyle = out.workbookData[0].styles[out.workbookData[0].rows[0].cells[1].style];
    assert.equal(out.workbookData[0].rows[0].cells[1].text, 'Master');
    assert.equal(masterStyle.color, '#ABCDEF');
    assert.deepEqual(masterStyle.border.right, ['medium', '#ff0000']);
    assert.deepEqual(masterStyle.border.bottom, ['double', '#00ff00']);
    assert.equal(out.workbookData[0].rows[0].height, 35);

    // requestExcel tuple-array headers & AbortSignal
    const sentHeaders = [];
    let abortedXhr = false;
    class MockXhr {
        open() {}
        setRequestHeader(k, v) { sentHeaders.push([k, v]); }
        abort() { abortedXhr = true; this.onabort && this.onabort(); }
        send() {
            queueMicrotask(() => {
                this.status = 200;
                this.response = new ArrayBuffer(2);
                this.onload && this.onload();
            });
        }
    }
    await runWithDomGlobals({ XMLHttpRequest: MockXhr }, async () => {
        await excelMod.getData('https://example.com/a.xlsx', { headers: [['X-Custom', '1'], ['X-Skip', null]] });
        assert.deepEqual(sentHeaders, [['X-Custom', '1']]);

        const ac = new AbortController();
        ac.abort();
        await assert.rejects(excelMod.getData('https://example.com/abort.xlsx', { signal: ac.signal }), /Request aborted/);
        assert.equal(abortedXhr, false);
    });
});

test('color.js strict hex validation & utils/test.js location.href fallback', async () => {
    assert.equal(getDarkColor('#zzzz112233', 0.5), '#000000');
    assert.equal(getDarkColor('#ffffff', -0.5), '#ffffff');
    assert.equal(getLightColor('#000000', -0.5), '#000000');
    assert.equal(getLightColor('#808080', NaN), '#808080');

    await runWithDomGlobals({
        location: { href: 'https://example.com/demo/#/docx?test=true', search: '', hash: '' }
    }, () => {
        assert.equal(isTest(), true);
    });
    await runWithDomGlobals({
        location: { href: 'https://example.com/demo?test=FALSE', search: '', hash: '' }
    }, () => {
        assert.equal(isTest(), false);
    });
});

test('x-spreadsheet core fixes: DataProxy copyPaste, merges shift/delete, formulas, AutoFilter, Validator, Draw, locale, expression', async () => {
    const core = buildCoreSuite();

    // alphabet & CellRange guards
    assert.equal(core.alphabetMod.stringAt(Infinity), '');
    assert.equal(core.alphabetMod.stringAt(1.5), '');
    assert.equal(core.alphabetMod.expr2expr('$A$1', 1, 2, () => true, true), '$B$3');
    assert.equal(core.CellRange.valueOf('').toString(), 'A1');
    assert.equal(core.CellRange.valueOf('B2').includes(), false);

    // clipboard null guard & history atomic rollback
    const cb = new core.Clipboard();
    cb.copy(null);
    assert.equal(cb.isClear(), true);
    const hist = new core.History(2);
    hist.add({ a: 1 });
    assert.throws(() => hist.undo({ a: 2 }, () => { throw new Error('cb fail'); }), /cb fail/);
    assert.equal(hist.canUndo(), true);
    assert.equal(hist.canRedo(), false);

    // font & format & helper
    assert.equal(core.fontMod.getFontSizePxByPt(null), null);
    assert.equal(core.fontMod.getFontSizePxByPt(''), '');
    assert.equal(core.formatMod.formatm.number.render(-0.001), '0.00');
    assert.equal(core.formatMod.formatm.usd.render(-0.001), '$0.00');
    assert.equal(core.formatMod.formatm.number.render('1e-7'), '0.00');
    assert.equal(core.helperMod.cloneDeep(undefined), undefined);
    assert.deepEqual(core.helperMod.merge(null, { a: 1 }), { a: 1 });
    assert.equal(core.helperMod.equals(new Date(0), new Date(1000)), false);
    assert.equal(core.helperMod.equals(NaN, NaN), true);
    assert.equal(core.helperMod.numberCalc('/', 1234567890123, 1), '1234567890123');
    assert.equal(core.helperMod.numberCalc('*', 0.5, 2), '1');
    assert.equal(core.helperMod.numberCalc('+', '', 1), '1');

    // Formula toBool & AVERAGE float precision
    assert.equal(core.formulam.IF.render(['0', 'yes', 'no']), 'no');
    assert.equal(core.formulam.IF.render(['FALSE', 'yes', 'no']), 'no');
    assert.equal(core.formulam.AND.render([]), false);
    assert.equal(core.formulam.AND.render(['1', '0']), false);
    assert.equal(core.formulam.OR.render(['0', 'FALSE']), false);
    assert.equal(core.formulam.AVERAGE.render([0.1, 0.2]), 0.15);

    // Formula parser (multiline, escaped quotes, .5, 1E-2, TRUE/FALSE, empty arg, circular consistency, invalid tokens)
    const cells = { '0,0': '=100+A1', '1,0': '=A1', '2,0': '' };
    const get = (x, y) => cells[`${x},${y}`] ?? '';
    assert.equal(core.cellMod.render('=10\n-5', core.formulam, get), '5');
    assert.equal(core.cellMod.render('=CONCAT("a""b", "c")', core.formulam, get), 'a"bc');
    assert.equal(core.cellMod.render('=.5+.5', core.formulam, get), '1');
    assert.equal(core.cellMod.render('=1.5E+2+1E-2', core.formulam, get), '150.01');
    assert.equal(core.cellMod.render('=IF(TRUE, 10, 20)', core.formulam, get), 10);
    assert.equal(core.cellMod.render('=IF(1, , 2)', core.formulam, get), '');
    assert.equal(core.cellMod.render('=SUM  (1, 2)', core.formulam, get), '3');
    assert.equal(core.cellMod.render('=C1+1', core.formulam, get), '1');
    assert.equal(core.cellMod.render('=Sheet2!A1', core.formulam, get), '=Sheet2!A1');
    assert.equal(core.cellMod.render('=2^3', core.formulam, get), '=2^3');
    assert.equal(core.cellMod.render('=1+', core.formulam, get), '=1+');
    assert.equal(core.cellMod.render('=5-', core.formulam, get), '=5-');
    assert.equal(core.cellMod.render('=100+A1', core.formulam, get, [], 'A1'), '100');
    assert.equal(core.cellMod.render('=A1', core.formulam, get, [], 'B1'), '100');

    // Merges.shift partial top/left deletion
    const m1 = new core.Merges([core.CellRange.valueOf('A3:A5')]);
    m1.shift('row', 0, -3);
    assert.deepEqual(m1.getData(), ['A1:A2']);
    const m2 = new core.Merges([core.CellRange.valueOf('C1:E1')]);
    m2.shift('column', 0, -3);
    assert.deepEqual(m2.getData(), ['A1:B1']);

    // Rows: getOrNew sparse, formula string-literal & $A$5 structural shift, autofill item-1
    const rows = new core.Rows({ len: 10, height: 24 });
    rows.setData({ len: 10, 0: { height: 50 } });
    rows.setCellText(0, 0, '=CONCAT("A1", $A$5, LOG10(A2))');
    rows.insert(0, 1);
    assert.equal(rows.getCell(1, 0).text, '=CONCAT("A1", $A$6, LOG10(A3))');
    rows.setCellText(0, 1, '=SUM(A1:A5)');
    rows.delete(3, 4);
    assert.equal(rows.getCell(0, 1).text, '=SUM(A1:A3)');
    rows.setCellText(2, 0, 'item-1');
    rows.copyPaste(core.CellRange.valueOf('A3:A3'), core.CellRange.valueOf('A4:A4'), 'all', true);
    assert.equal(rows.getCell(3, 0).text, 'item-2');

    // DataProxy: copyPaste onto self/smaller dst/text-only, delete top merge row, insert(col, 0) guard, view bounds, freeze Infinity
    const dp = new core.DataProxy('Main', { mode: 'edit', row: { len: 10, height: 24 }, col: { len: 5, width: 80, indexWidth: 60, minWidth: 60 } });
    dp.setCellText(0, 0, 'hello', 'finished');
    dp.selector.range = core.CellRange.valueOf('A1:A1');
    dp.copy();
    dp.paste('all');
    assert.equal(dp.getCell(0, 0).text, 'hello');

    dp.setCellText(0, 1, 'B1', 'finished');
    dp.setCellText(1, 0, 'A2', 'finished');
    dp.setCellText(1, 1, 'B2', 'finished');
    dp.selector.range = core.CellRange.valueOf('A1:B2');
    dp.copy();
    dp.selector.range = core.CellRange.valueOf('C1:C1');
    dp.paste('all');
    assert.equal(dp.getCell(1, 3).text, 'B2');

    // Merge + paste('text') must NOT create zombie merge
    dp.selector.range = core.CellRange.valueOf('A4:B5');
    dp.merge();
    dp.copy();
    dp.selector.range = core.CellRange.valueOf('C4:D5');
    dp.paste('text');
    assert.equal(dp.merges.getFirstIncludes(3, 2), null);

    // Deleting top row of merge A4:B5 preserves master cell at row 3 as 1x2 A4:B4; deleting col A shrinks to 1x1
    dp.setCellText(3, 0, 'KeepTitle', 'finished');
    dp.selector.range = core.CellRange.valueOf('A4:B4');
    dp.delete('row');
    assert.equal(dp.getCell(3, 0).text, 'KeepTitle');
    assert.deepEqual(dp.getCell(3, 0).merge, [0, 1]);
    assert.equal(dp.merges.getFirstIncludes(3, 0)?.toString(), 'A4:B4');
    dp.selector.range = core.CellRange.valueOf('A4:A4');
    dp.delete('column');
    assert.equal(dp.getCell(3, 0).text, 'KeepTitle');
    assert.equal(dp.getCell(3, 0).merge, undefined);
    assert.equal(dp.merges.getFirstIncludes(3, 0), null);

    // insert('column', 0) no-op preserves col metadata; freeze: [Infinity, 0] rejected
    dp.cols.setWidth(0, 123);
    dp.insert('column', 0);
    assert.equal(dp.cols.getWidth(0), 123);
    dp.setData({ freeze: [Infinity, 0], styles: null });
    assert.deepEqual(dp.freeze, [0, 0]);
    assert.deepEqual(dp.styles, []);

    // Trailing CRLF & quoted multiline TSV paste
    assert.deepEqual(core.DataProxy.prototype.parseClipboardContent('hello\r\n'), [['hello']]);
    assert.deepEqual(core.DataProxy.prototype.parseClipboardContent('"a\nb"\t"c""d"\r\n'), [['a\nb', 'c"d']]);

    // AutoFilter empty cell numeric & setSort preservation & strict weak ordering
    const af = new core.AutoFilter();
    af.setData({ ref: '' });
    assert.equal(af.active(), false);
    af.addFilter(0, 'lt', 5);
    assert.equal(af.filters[0].includes(''), false);
    af.setSort(0, 'asc');
    af.setSort(1, null);
    assert.equal(af.sort.ci, 0);

    // Validator prototype lookup & number without operator
    const protoVal = new core.Validator('toString', false, '', undefined);
    assert.equal(protoVal.validate('hello')[0], true);
    const numVal = new core.Validator('number', false, '', undefined);
    assert.equal(numVal.validate('abc')[0], false);
    const listArrVal = new core.Validator('list', false, ['A', 'B']);
    assert.equal(listArrVal.validate('B')[0], true);

    // locale.js window.x_spreadsheet.$messages precedence & expression.js unary
    const exprMod = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/algorithm/expression.js');
    assert.deepEqual(exprMod.infix2suffix(null), []);
    assert.deepEqual(exprMod.infix2suffix('-3+5'), ['-3', '5', '+']);
    assert.deepEqual(exprMod.infix2suffix('12\t34'), ['12', '34']);

    await runWithDomGlobals({
        window: { x_spreadsheet: { $messages: { 'zh-cn': { toolbar: { undo: '撤销' } } } } }
    }, () => {
        core.localeMod.locale('zh-cn');
        assert.equal(core.localeMod.t('toolbar.undo'), '撤销');
        assert.equal(core.localeMod.t('validation.lessThan', undefined), 'it is less than ');
        core.localeMod.locale('en', core.enLocale, true);
    });

    // Draw & Draw2 fixes
    await runWithDomGlobals({ window: { devicePixelRatio: 0.5 } }, () => {
        const drawMod = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/canvas/draw.js');
        const dashArgs = [];
        const fillTexts = [];
        let seenFont = '';
        const ctx = {
            ...createCanvasContextMock(),
            setLineDash: arr => dashArgs.push(arr),
            fillText: (txt, x, y) => fillTexts.push({ txt, x, y }),
            set font(v) { seenFont = v; },
            get font() { return seenFont; }
        };
        const d = new drawMod.Draw({ style: {}, getContext: () => ctx }, -10, -20);
        assert.equal(d.el.style.width, '0px');
        assert.equal(d.el.style.height, '0px');
        d.border('dotted', '#000');
        assert.deepEqual(dashArgs[dashArgs.length - 1], [1, 1]);
        d.text('Line1\r\nLine2', new drawMod.DrawBox(0, 0, 100, 40, 2), { font: { name: '+mj-lt', size: undefined } });
        assert.equal(fillTexts[0].txt, 'Line1');
        assert.equal(fillTexts[1].txt, 'Line2');
        assert.ok(seenFont.includes('"+mj-lt"'));
        assert.equal(Number.isNaN(fillTexts[0].y), false);

        const draw2Mod = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/canvas/draw2.js');
        const d2 = new draw2Mod.Draw(null);
        d2.clear().attr({}).save().restore().beginPath().closePath().rect(0, 0, 1, 1).scale(1, 1).rotate(0).translate(0, 0).fillRect(0, 0, 1, 1).strokeRect(0, 0, 1, 1).fillText('a', 0, 0).strokeText('a', 0, 0);
        assert.deepEqual(d2.measureText('a'), { width: 0 });
    });
});
