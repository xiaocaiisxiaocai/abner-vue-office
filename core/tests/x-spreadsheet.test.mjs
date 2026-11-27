import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
    CORE_DIR,
    createDomMocks,
    loadStrippedModule,
    runWithDomGlobals
} from './helpers/load-module.mjs';

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
const { formulam } = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/formula.js', {
    tf: k => () => k,
    numberCalc: helperMod.numberCalc
});
const cellMod = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/cell.js', {
    expr2xy: alphabetMod.expr2xy,
    xy2expr: alphabetMod.xy2expr,
    numberCalc: helperMod.numberCalc
});
const { formatm } = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/format.js', {
    tf: k => () => k
});

test('x-spreadsheet format.js returns clean formatted strings', () => {
    assert.equal(formatm.number.render('1234.5'), '1,234.50');
    assert.equal(formatm.number.render(1000), '1,000.00');
    assert.equal(formatm.number.render(-9876.543), '-9,876.54');
    assert.equal(formatm.number.render(''), '');
    assert.equal(formatm.number.render('abc'), 'abc');
    assert.equal(formatm.rmb.render('12'), '￥12.00');
    assert.equal(formatm.usd.render('1234.5'), '$1,234.50');
    assert.equal(formatm.eur.render('12.345'), '€12.35');
    assert.equal(formatm.percent.render('25'), '25%');
});

test('x-spreadsheet core cell/formula/alphabet/range/merges/rows/cols/helper logic', () => {
    assert.equal(alphabetMod.stringAt(0), 'A');
    assert.equal(alphabetMod.stringAt(702), 'AAA');
    assert.equal(alphabetMod.stringAt(728), 'ABA');
    assert.equal(alphabetMod.indexAt('ABA'), 728);
    assert.equal(alphabetMod.expr2expr('A1', 2, 3), 'C4');

    const cells = { '0,0': '10', '0,1': '20', '1,0': '30', '1,1': '40', '0,2': '=SUM(A1:B2)' };
    const getter = (x, y) => cells[`${x},${y}`] ?? '';
    assert.equal(cellMod.render('=SUM(A1:B2)', formulam, getter), '100');
    assert.equal(cellMod.render('=AVERAGE(A1,B1)', formulam, getter), 20);
    assert.equal(cellMod.render('=MAX(A1:B2)', formulam, getter), 40);
    assert.equal(cellMod.render('=MIN(A1:B2)', formulam, getter), 10);
    assert.equal(cellMod.render('=IF(B1>A1, 100, 0)', formulam, getter), 100);
    assert.equal(cellMod.render('=CONCAT("ab", "cd")', formulam, getter), 'abcd');
    assert.equal(cellMod.render('=1+2*3', formulam, getter), '7');
    assert.equal(cellMod.render('=(1+2)*3', formulam, getter), '9');
    assert.equal(cellMod.render('=UNKNOWN(A1)', formulam, getter), '=UNKNOWN(A1)');

    const r1 = CellRange.valueOf('B2:D4');
    assert.deepEqual(r1.size(), [3, 3]);
    assert.equal(r1.includes('C3'), true);
    assert.equal(r1.includes('A1'), false);
    assert.equal(r1.toString(), 'B2:D4');

    const merges = new Merges([CellRange.valueOf('A1:B2')]);
    assert.equal(merges.intersects(CellRange.valueOf('B2:C3')), true);
    assert.equal(merges.intersects(CellRange.valueOf('C1:D2')), false);
    merges.shift('row', 0, 2, () => {});
    assert.deepEqual(merges.getData(), ['A3:B4']);

    const rows = new Rows({ len: 10, height: 24 });
    rows.setData({ len: 0, 0: { cells: { 0: { text: 'v' } } } });
    assert.equal(rows.len, 0);
    rows.setData(null);

    const cols = new Cols({ len: 10, width: 80, indexWidth: 60, minWidth: 60 });
    cols.setData({ len: 0 });
    assert.equal(cols.len, 0);
    cols.setData(null);

    assert.equal(helperMod.numberCalc('+', 0.1, 0.2), '0.3');
    assert.equal(helperMod.equals({ a: 1, b: [2] }, { a: 1, b: [2] }), true);
    assert.equal(helperMod.equals({ a: [1] }, { a: [1, 2] }), false);
    assert.equal(helperMod.equals({ a: null }, { a: {} }), false);
    assert.deepEqual(helperMod.merge({ a: 1 }, null, { b: 2 }), { a: 1, b: 2 });

    // Cell string comparison & circular numeric safety
    assert.equal(cellMod.render('=IF("a"="a", 1, 0)', formulam, getter), 1);
    assert.equal(cellMod.render('=IF("a"="b", 1, 0)', formulam, getter), 0);
    const circularCells = { '0,0': '=A1+50' };
    assert.equal(cellMod.render('=A1+50', formulam, (x, y) => circularCells[`${x},${y}`] ?? ''), '50');
    assert.equal(formulam.AVERAGE.render([]), 0);

    // CellRange.difference edge cases
    const outer = CellRange.valueOf('A1:D4');
    assert.deepEqual(
        outer.difference(CellRange.valueOf('B2:C3')).map(r => r.toString()),
        ['A1:D1', 'A4:D4', 'A2:A3', 'D2:D3']
    );
    assert.deepEqual(
        CellRange.valueOf('A1:B2').difference(CellRange.valueOf('D4:E5')).map(r => r.toString()),
        ['A1:B2']
    );
    assert.equal(CellRange.valueOf('B2:C3').difference(outer).length, 0);

    // Bitmap & expression
    const bitmap = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/algorithm/bitmap.js');
    assert.equal(bitmap(0, 2, true), 4);
    assert.equal(bitmap(4, 2, false), 0);
    assert.equal(bitmap(0, 2, false), 0);

    const exprMod = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/algorithm/expression.js');
    assert.deepEqual(exprMod.infix2suffix('(1+2)*3'), ['1', '2', '+', '3', '*']);
    assert.deepEqual(exprMod.infix2suffix('1+2)'), ['1', '2', '+']);

    // Validator & Validations & AutoFilter & Rows & History & Clipboard & Scroll & CoreSelector & Font
    const Validator = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/validator.js', {
        t: k => k,
        helper: helperMod
    });
    const emailVal = new Validator('email', true);
    assert.equal(emailVal.validate('user@example.com')[0], true);
    assert.equal(emailVal.validate('bad-email')[0], false);
    const dateVal = new Validator('date', false, '2025-05-01', 'eq');
    assert.equal(dateVal.validate('2025-05-01')[0], true);
    assert.equal(dateVal.validate('2025-05-02')[0], false);
    const rangeVal = new Validator('number', false, [10, 20], 'be');
    assert.equal(rangeVal.validate('15')[0], true);
    assert.equal(rangeVal.validate('25')[0], false);

    const { Validations } = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/validation.js', {
        Validator,
        CellRange
    });
    const vals = new Validations();
    vals.add('cell', 'A1:B2', { type: 'number', required: true, operator: 'gte', value: '5' });
    vals.validate(0, 0, '');
    assert.ok(vals.getError(0, 0));
    vals.validate(0, 0, '8');
    assert.equal(vals.getError(0, 0), undefined);
    vals.remove(CellRange.valueOf('A1:A2'));
    assert.equal(vals.get(0, 0), null);
    assert.ok(vals.get(0, 1));

    const AutoFilter = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/auto_filter.js', { CellRange });
    const af = new AutoFilter();
    af.setData({ ref: 'A1:A4' });
    const afItems = af.items(0, ri => ({ text: ri === 1 ? 0 : '' }));
    assert.equal(afItems['0'], 1);
    assert.equal(afItems[''], 2);

    const History = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/history.js');
    const hist = new History();
    hist.add({ step: 1 });
    assert.equal(hist.canUndo(), true);
    let restored = null;
    hist.undo({ step: 2 }, d => { restored = d; });
    assert.deepEqual(restored, { step: 1 });
    assert.equal(hist.canRedo(), true);
    hist.redo({ step: 1 }, d => { restored = d; });
    assert.deepEqual(restored, { step: 2 });

    const Clipboard = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/clipboard.js');
    const cb = new Clipboard();
    cb.copy(CellRange.valueOf('A1'));
    assert.equal(cb.isCopy(), true);
    cb.cut(CellRange.valueOf('A1'));
    assert.equal(cb.isCut(), true);
    cb.clear();
    assert.equal(cb.isClear(), true);

    const Scroll = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/scroll.js');
    const sc = new Scroll();
    assert.equal(sc.x, 0);

    const CoreSelector = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/selector.js', { CellRange });
    const cs = new CoreSelector();
    cs.setIndexes(2, 3);
    assert.equal(cs.ri, 2);
    assert.deepEqual(cs.size(), [1, 1]);

    const fontMod = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/font.js');
    assert.equal(fontMod.getFontSizePxByPt(12), 16);
    assert.ok(fontMod.fonts().Arial);

    // Rows cutPaste & delete >9 string key fix
    const r2 = new Rows({ len: 12, height: 24 });
    r2.setCellText(0, 0, 'move');
    r2.cutPaste(CellRange.valueOf('A1:A1'), CellRange.valueOf('B1:B1'));
    assert.equal(r2.getCell(0, 1).text, 'move');
    r2.setCellText(10, 0, 'stay-row10');
    r2.delete(1, 2);
    assert.equal(r2.getCell(8, 0).text, 'stay-row10');
});

test('x-spreadsheet canvas/draw.js SSR dpr, DrawBox, and numeric border lineWidth', async () => {
    await runWithDomGlobals({ window: undefined }, () => {
        const drawModSsr = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/canvas/draw.js');
        assert.equal(drawModSsr.thinLineWidth(), 0.5);
        assert.equal(drawModSsr.npx(10), 10);
    });

    await runWithDomGlobals({ window: { devicePixelRatio: 2 } }, () => {
        const drawMod = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/canvas/draw.js');
        assert.equal(drawMod.thinLineWidth(), 1.5);
        const box = new drawMod.DrawBox(10, 20, 100, 40, 5);
        assert.equal(box.innerWidth(), 88);
        assert.equal(box.textx('center'), 60);
        const fakeCtx = {
            scale: () => {},
            save: () => {},
            restore: () => {},
            beginPath: () => {},
            moveTo: () => {},
            lineTo: () => {},
            stroke: () => {},
            fillText: () => {},
            measureText: () => ({ width: 40 }),
            dashCalls: [],
            setLineDash(v) { this.dashCalls.push(v); },
            lineWidth: 0,
            strokeStyle: ''
        };
        const fakeCanvas = {
            style: {},
            getContext: () => fakeCtx
        };
        const d = new drawMod.Draw(fakeCanvas, 200, 100);
        d.border('dashed', '#000');
        d.border('thin', '#000');
        assert.deepEqual(fakeCtx.dashCalls[fakeCtx.dashCalls.length - 1], []);
        assert.equal(typeof d.ctx.lineWidth, 'number');
        assert.equal(d.ctx.lineWidth, 1.5);

        // HiDPI underline length uses CSS width (measureText.width / dpr)
        const linesDrawn = [];
        d.line = (...pts) => {
            linesDrawn.push(pts);
            return d;
        };
        d.text('hi', box, {
            align: 'left',
            valign: 'middle',
            font: { name: 'Arial', size: 12 },
            color: '#000',
            underline: true,
            strike: true
        }, false);
        assert.equal(linesDrawn.length, 2);
        assert.equal(linesDrawn[0][1][0] - linesDrawn[0][0][0], 20);
    });

    const draw2Mod = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/canvas/draw2.js');
    const transformArgs = [];
    const d2 = new draw2Mod.Draw({
        width: 10,
        height: 10,
        getContext: () => ({
            transform: (...args) => transformArgs.push(args),
            clearRect: () => {}
        })
    });
    d2.transform(1, 0, 0, 1, 5, 6);
    assert.deepEqual(transformArgs[0], [1, 0, 0, 1, 5, 6]);
});

test('x-spreadsheet DataProxy, locale SSR, Bottombar, Modal, and Dropdown clickoutside cleanup', async () => {
    const localeSsr = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/locale/locale.js', {
        en: { validation: { required: 'Required', between: 'between {} and {}' } }
    });
    const enLocale = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/locale/en.js');
    const deLocale = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/locale/de.js');
    const nlLocale = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/locale/nl.js');
    assert.equal(enLocale.dataValidation.modeType.column, 'Column');
    assert.equal(enLocale.dataValidation.operator.nbe, 'not between');
    assert.equal(deLocale.toolbar.fontName, 'Schriftart');
    assert.equal(deLocale.toolbar.valign, 'Vertikale Ausrichtung');
    assert.equal(nlLocale.toolbar.bgcolor, 'Opvulkleur');

    await runWithDomGlobals({ window: undefined }, () => {
        assert.equal(localeSsr.t('validation.required'), 'Required');
        assert.equal(localeSsr.t('validation.between', 1, 9), 'between 1 and 9');
        assert.equal(localeSsr.t(''), '');
        assert.equal(localeSsr.t('missing.key'), '');
        localeSsr.locale('zh-cn', undefined);
        assert.equal(localeSsr.t('validation.required'), 'Required');
    });

    const { mockDocument, mockWindow, windowListeners } = createDomMocks();
    await runWithDomGlobals({ document: mockDocument, window: mockWindow }, () => {
        const eventMod = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/event.js');
        const { Element, h } = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/element.js');
        const Icon = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/icon.js', {
            Element,
            h,
            cssPrefix: 'x-spreadsheet'
        });
        const Dropdown = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/dropdown.js', {
            Element,
            h,
            bindClickoutside: eventMod.bindClickoutside,
            unbindClickoutside: eventMod.unbindClickoutside,
            cssPrefix: 'x-spreadsheet'
        });
        const FormInput = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/form_input.js', {
            h,
            cssPrefix: 'x-spreadsheet'
        });
        const Bottombar = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/bottombar.js', {
            h,
            bindClickoutside: eventMod.bindClickoutside,
            unbindClickoutside: eventMod.unbindClickoutside,
            cssPrefix: 'x-spreadsheet',
            Icon,
            FormInput,
            Dropdown,
            tf: k => () => k
        });
        const Modal = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/modal.js', {
            h,
            Icon,
            cssPrefix: 'x-spreadsheet',
            bind: eventMod.bind,
            unbind: eventMod.unbind
        });

        const parentWrap = h('div', 'wrap');
        const dd = new Dropdown('Menu', '120px', true, 'bottom-left');
        parentWrap.child(dd);
        dd.show();
        assert.equal(mockDocument.body.listeners.get('click').size, 1);
        dd.show();
        assert.equal(mockDocument.body.listeners.get('click').size, 1);
        dd.hide();
        assert.equal(mockDocument.body.listeners.get('click').size, 0);

        const detachedDd = new Dropdown('Detached', '100px', false, 'bottom-left');
        detachedDd.show();
        detachedDd.hide();

        const bar = new Bottombar();
        bar.addItem('S1', true, { mode: 'read' });
        assert.ok(bar.activeEl);
        bar.clear();
        assert.equal(bar.activeEl, null);
        assert.equal(bar.deleteEl, null);

        const modal = new Modal('Title', [h('div', 'body')]);
        modal.show();
        assert.equal(mockDocument.body.children.length, 1);
        assert.equal(windowListeners.get('keydown').size, 1);
        modal.hide();
        assert.equal(mockDocument.body.children.length, 0);
        assert.equal(windowListeners.get('keydown').size, 0);
    });
});

test('x-spreadsheet sheet.js blocks read-only shortcuts and zero-delta scroll events', async () => {
    const sheetSrc = fs.readFileSync(
        path.join(CORE_DIR, 'packages/vue-excel/src/x-spreadsheet/component/sheet.js'),
        'utf8'
    );
    assert.match(sheetSrc, /if \(data\.settings\.mode === 'read'\) return;/);
    assert.match(sheetSrc, /if \(this\.data\.settings\.mode === 'read'\) return;/);
    assert.match(sheetSrc, /if \(temp === 0\) return;/);

    const { mockDocument, mockWindow, windowListeners } = createDomMocks();
    let triggerCount = 0;
    let movedY = 0;
    const listeners = new Map();
    const overlayerEl = {
        el: mockDocument.createElement('div'),
        on(name, cb) {
            listeners.set(name, cb);
            return this;
        },
        contains: () => true
    };
    const ctx = {
        focusing: true,
        data: {
            settings: { mode: 'read' },
            selector: { ci: 0, ri: 0 },
            rows: { len: 10, getHeight: () => 24 },
            cols: { len: 10, getWidth: () => 80 },
            scroll: { ri: 0, ci: 0 }
        },
        toolbar: { trigger: () => triggerCount++ },
        verticalScrollbar: { scroll: () => ({ top: 0 }), move: () => movedY++ },
        horizontalScrollbar: { scroll: () => ({ left: 0 }), move: () => movedY++ },
        contextMenu: { hide: () => {} },
        rowResizer: {},
        colResizer: {},
        editor: {},
        modalValidation: {},
        selector: {},
        sortFilter: {},
        overlayerEl,
        undo: () => triggerCount++,
        redo: () => triggerCount++
    };

    const fnBody = sheetSrc
        .slice(sheetSrc.indexOf('function overlayerMousescroll'), sheetSrc.indexOf('export default class Sheet'))
        .replace(/sheetReset\.call\(this\)/g, '(() => {})()');

    await runWithDomGlobals({ document: mockDocument, window: mockWindow }, () => {
        const harness = new Function(
            'cssPrefix', 'bind', 'unbind', 'mouseMoveUp', 'bindTouch', 'xtoast', 'clearToasts', 'throttle',
            `${fnBody}\nreturn { overlayerMousescroll, sheetInitEvents };`
        )(
            'x-spreadsheet',
            (t, n, fn) => t.addEventListener(n, fn),
            (t, n, fn) => t.removeEventListener(n, fn),
            () => {},
            () => {},
            () => {},
            () => {},
            fn => fn
        );

        harness.overlayerMousescroll.call(ctx, { deltaX: 0, deltaY: 0, detail: 0 });
        assert.equal(movedY, 0);

        harness.sheetInitEvents.call(ctx);
        const keydownHandler = Array.from(windowListeners.get('keydown'))[0];
        [66, 73, 85, 90, 89].forEach(code => {
            keydownHandler({ keyCode: code, ctrlKey: true, preventDefault() {} });
        });
        assert.equal(triggerCount, 0);
    });
});
