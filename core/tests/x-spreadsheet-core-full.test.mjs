import test from 'node:test';
import assert from 'node:assert/strict';
import { loadStrippedModule, runWithDomGlobals } from './helpers/load-module.mjs';

const alphabetMod = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/alphabet.js');
const { CellRange } = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/cell_range.js', {
    expr2xy: alphabetMod.expr2xy,
    xy2expr: alphabetMod.xy2expr
});
const { Merges } = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/merge.js', { CellRange });
const helperMod = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/helper.js');
const { Rows } = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/row.js', {
    helper: helperMod,
    expr2expr: alphabetMod.expr2expr
});
const { Cols } = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/col.js', { helper: helperMod });
const History = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/history.js');
const Clipboard = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/clipboard.js');
const Scroll = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/scroll.js');
const CoreSelector = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/selector.js', { CellRange });
const AutoFilter = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/auto_filter.js', { CellRange });
const enLocale = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/locale/en.js');
const zhLocale = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/locale/zh-cn.js');
const deLocale = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/locale/de.js');
const nlLocale = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/locale/nl.js');
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
const formatMod = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/format.js', {
    tf: localeMod.tf
});
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
    Cols,
    Validations,
    CellRange,
    expr2xy: alphabetMod.expr2xy,
    xy2expr: alphabetMod.xy2expr,
    t: localeMod.t
});

test('config.js and locales cover 104-key parity across en/zh-cn/de/nl plus security & escaped dot lookup', async () => {
    await runWithDomGlobals({ window: undefined }, () => {
        const cfgSsr = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/config.js');
        assert.equal(cfgSsr.cssPrefix, 'x-spreadsheet');
        assert.equal(cfgSsr.dpr, 1);
    });
    await runWithDomGlobals({ window: { devicePixelRatio: 2 } }, () => {
        const cfgBrowser = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/config.js');
        assert.equal(cfgBrowser.dpr, 2);
    });

    const collectKeys = (obj, prefix = '') => {
        const keys = [];
        for (const [k, v] of Object.entries(obj)) {
            const full = prefix ? `${prefix}.${k}` : k;
            if (v && typeof v === 'object' && !Array.isArray(v)) {
                keys.push(...collectKeys(v, full));
            } else {
                keys.push(full);
            }
        }
        return keys.sort();
    };
    const enKeys = collectKeys(enLocale);
    assert.equal(enKeys.length, 104);
    assert.deepEqual(collectKeys(zhLocale), enKeys);
    assert.deepEqual(collectKeys(deLocale), enKeys);
    assert.deepEqual(collectKeys(nlLocale), enKeys);

    assert.equal(localeMod.t('toolbar.toString'), '');
    assert.equal(localeMod.tf('print.size')(), 'Paper size');
    localeMod.locale('custom', { a: { 'b.c': 'escaped', empty: '' } }, true);
    assert.equal(localeMod.t('a.b\\.c'), 'escaped');
    assert.equal(localeMod.t('a.empty'), '');
    assert.equal(localeMod.t('toolbar.undo'), '');
    localeMod.locale('en', enLocale, false);
    assert.equal(localeMod.t('toolbar.undo'), 'Undo');
});

test('algorithm/expression.js, bitmap.js, helper.js, and alphabet.js handle all edge cases', () => {
    const exprMod = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/algorithm/expression.js');
    assert.deepEqual(exprMod.infix2suffix('9+(3-1)*3+10/2'), ['9', '3', '1', '-', '3', '*', '+', '10', '2', '/', '+']);
    assert.deepEqual(exprMod.infix2suffix('(2*3+4)'), ['2', '3', '*', '4', '+']);
    assert.deepEqual(exprMod.infix2suffix('5-3-1'), ['5', '3', '-', '1', '-']);

    const bitmap = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/algorithm/bitmap.js');
    assert.equal(bitmap(5, -1, true), 5);
    assert.equal(bitmap(5, 31, true), 5);

    // helper.js prototype pollution guard, primitive override, array equals, numberCalc precision
    const pollutedTarget = helperMod.merge({ a: 1 }, JSON.parse('{"__proto__":{"polluted":true}}'), { a: { b: 2 } });
    assert.equal(({}).polluted, undefined);
    assert.deepEqual(pollutedTarget, { a: { b: 2 } });
    assert.equal(helperMod.arrayEquals([1], 'not-array'), false);
    assert.equal(helperMod.numberCalc('*', 0.5, 0.5), '0.25');
    assert.equal(helperMod.numberCalc('*', 0.1, 0.1), '0.01');
    assert.equal(helperMod.numberCalc('/', 1, 64), '0.015625');
    assert.equal(helperMod.numberCalc('+', 1.5e-7, 2.5e-7), '0.00000040');
    assert.equal(helperMod.numberCalc('+', 'foo', 2), 'foo+2');

    // alphabet.js lowercase, $ anchors, negative shift bounds
    assert.equal(alphabetMod.indexAt('aa'), 26);
    assert.deepEqual(alphabetMod.expr2xy('$B$10'), [1, 9]);
    assert.equal(alphabetMod.expr2expr('a1', 0, 1), 'A2');
    assert.equal(alphabetMod.expr2expr('$A$1', 2, 3), '$A$1');
    assert.equal(alphabetMod.expr2expr('A1', -1, 0), 'A1');
});

test('cell.js, formula.js, format.js, and font.js evaluate nested formulas, strings, and formats accurately', () => {
    const grid = {
        '0,0': 'Hello',
        '1,0': 'World',
        '0,1': '-5',
        '1,1': '10',
        '2,1': '20',
        '0,3': '=(-A4)'
    };
    const getter = (x, y) => grid[`${x},${y}`] ?? '';

    assert.equal(cellMod.render('=2*(3+4)', formulam, getter), '14');
    assert.equal(cellMod.render('=10/(2+3)', formulam, getter), '2');
    assert.equal(cellMod.render('=A1', formulam, getter), 'Hello');
    assert.equal(cellMod.render('=CONCAT(A1, B1)', formulam, getter), 'HelloWorld');
    assert.equal(cellMod.render('=IF(A1="Hello", "OK", "NO")', formulam, getter), 'OK');
    assert.equal(cellMod.render('=IF(1=2, 1, "")', formulam, getter), '');
    assert.equal(cellMod.render('=SUM(B2)', formulam, getter), '10');
    assert.equal(cellMod.render('=SUM(1, 2+3)', formulam, getter), '6');
    assert.equal(cellMod.render('=SUM(A1:B2)', formulam, getter), '5');
    assert.equal(cellMod.render('=SUM(B2, SUM(B2:C2))', formulam, getter), '40');
    assert.equal(cellMod.render('=SUM(B2, AVERAGE(B2, C2), C2)', formulam, getter), '45');
    assert.equal(cellMod.render('=1>5', formulam, getter), false);
    assert.equal(cellMod.render('=1<>2', formulam, getter), true);
    assert.equal(cellMod.render('=IF(A2=-5, 1, 0)', formulam, getter), 1);
    assert.equal(cellMod.render('=IF(B2>-5, 1, 0)', formulam, getter), 1);
    assert.equal(cellMod.render('=MAX(C2:B2)', formulam, getter), 20);
    assert.equal(cellMod.render('=AVERAGE(10, "", 20)', formulam, getter), 15);
    assert.equal(cellMod.render('=(-A4)', formulam, getter), 0);
    assert.equal(cellMod.render('=SUM(A1:XFD1048576)', formulam, getter), '=SUM(A1:XFD1048576)');

    assert.equal(formulam.AND.render([true, false]), false);
    assert.equal(formulam.OR.render([false, true]), true);
    assert.equal(formulam.IF.render([false, 'yes']), false);

    assert.equal(formatMod.formatm.usd.render(-10), '-$10.00');
    assert.equal(formatMod.formatm.usd.render(''), '');
    assert.equal(formatMod.formatm.percent.render(''), '');
    assert.equal(formatMod.formatm.rmb.render('Total'), 'Total');
    assert.equal(fontMod.getFontSizePxByPt(20), 26.7);
});

test('Rows, Cols, Merges, AutoFilter, Validations, and DataProxy cover full lifecycle without corruption', async () => {
    // Rows.cutPaste preserves metadata and doesn't lose forward-pasted data
    const rows = new Rows({ len: 10, height: 24 });
    rows.setHeight(0, 40);
    rows.setHeight(1, 50);
    rows.setCellText(0, 0, 'NEW');
    rows.setCellText(1, 0, 'OLD');
    rows.cutPaste(CellRange.valueOf('A1:A1'), CellRange.valueOf('A2:A2'));
    assert.equal(rows.getCell(1, 0).text, 'NEW');
    assert.equal(rows.getCell(0, 0), null);
    assert.equal(rows.getHeight(0), 40);
    assert.equal(rows.getHeight(1), 50);

    // copyPaste overlapping & bounded & autofill
    rows.setCellText(2, 0, '10');
    rows.setCellText(3, 0, '20');
    rows.copyPaste(CellRange.valueOf('A3:A4'), CellRange.valueOf('A4:A5'), 'all');
    assert.equal(rows.getCell(3, 0).text, '10');
    assert.equal(rows.getCell(4, 0).text, '20');
    rows.setCellText(6, 0, 'Hello.');
    rows.copyPaste(CellRange.valueOf('A7:A7'), CellRange.valueOf('A8:A8'), 'all', true);
    assert.equal(rows.getCell(7, 0).text, 'Hello.');
    rows.setCellText(0, 2, '=SUM(A2:A4)');
    rows.insert(1, 1);
    assert.equal(rows.getCell(0, 2).text, '=SUM(A3:A5)');
    assert.ok(rows.maxCell()[0] >= 8 && !Number.isNaN(rows.maxCell()[1]));

    // Merges.shift delete row & anchor safely
    const merges = new Merges([CellRange.valueOf('A1:B2'), CellRange.valueOf('C3:D4')]);
    merges.shift('row', 0, -1);
    assert.deepEqual(merges.getData(), ['A1:B1', 'C2:D3']);

    // Validator & Validations update & remove
    const vals = new Validations();
    vals.add('cell', 'A1', { type: 'number', required: false, operator: 'gt', value: '10' });
    assert.equal(vals.validate(0, 0, '5'), false);
    assert.ok(vals.getError(0, 0));
    vals.add('cell', 'A1', { type: 'number', required: false, operator: 'gt', value: '2' });
    assert.equal(vals.get(0, 0).validator.value, '2');
    assert.equal(vals.validate(0, 0, '5'), true);
    assert.equal(vals.getError(0, 0), undefined);
    const badNum = new Validator('number', false, '10', 'neq');
    assert.equal(badNum.validate('hello')[0], false);
    const listNum = new Validator('list', false, '1,2,3');
    assert.equal(listNum.validate(1)[0], true);

    // AutoFilter multi-filter & prototype-safe items & DataProxy sort/undo/merge
    const af = new AutoFilter();
    af.setData({
        ref: 'A1:B4',
        filters: [
            { ci: 0, operator: 'in', value: ['keep'] },
            { ci: 1, operator: 'gt', value: 10 }
        ]
    });
    const gridData = [
        ['keep', '20'],
        ['keep', '5'],
        ['toString', '30']
    ];
    const { rset, fset } = af.filteredRows((ri, ci) => ({ text: gridData[ri - 1][ci] }));
    assert.deepEqual([...fset], [1]);
    assert.deepEqual([...rset], [2, 3]);
    assert.equal(af.items(0, (ri, ci) => ({ text: gridData[ri - 1][ci] })).toString, 1);

    const dp = new DataProxy('Main', { mode: 'edit' });
    dp.setCellText(0, 0, 'Header1', 'finished');
    dp.setCellText(1, 0, 'Z', 'finished');
    dp.setCellText(2, 0, 'A', 'finished');
    dp.setCellText(1, 0, 'M', 'finished');
    assert.equal(dp.getCell(1, 0).text, 'M');
    dp.undo();
    assert.equal(dp.getCell(1, 0).text, 'Z');

    dp.autoFilter.ref = 'A1:A3';
    dp.setAutoFilter(0, 'asc', 'all', []);
    assert.equal(dp.sortedRowMap.get(1), 2);
    dp.selector.setIndexes(1, 0);
    assert.equal(dp.getSelectedCell().text, 'A');
    assert.equal(dp.exceptRowTotalHeight(0, 1), 0);

    // Draw.js constructor no double scale + wrapping
    await runWithDomGlobals({ window: { devicePixelRatio: 2 } }, () => {
        const drawMod = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/canvas/draw.js');
        let scaleCalled = 0;
        const fakeCtx = {
            scale: () => { scaleCalled++; },
            save: () => {},
            restore: () => {},
            beginPath: () => {},
            rect: () => {},
            clip: () => {},
            fill: () => {},
            fillRect: () => {},
            fillText: () => {},
            moveTo: () => {},
            lineTo: () => {},
            stroke: () => {},
            setLineDash: () => {},
            measureText: s => ({ width: String(s).length * 20 })
        };
        const d = new drawMod.Draw({ style: {}, getContext: () => fakeCtx }, 100, 100);
        assert.equal(scaleCalled, 0);
        const box = new drawMod.DrawBox(0, 0, 8, 24, 5);
        d.text('Hello😀World', box, {}, true);
    });
});
