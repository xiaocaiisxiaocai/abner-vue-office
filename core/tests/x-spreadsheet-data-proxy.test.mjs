import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createCanvasContextMock,
    loadStrippedModule,
    loadXSpreadsheetStack,
    runWithDomGlobals
} from './helpers/load-module.mjs';

test('DataProxy covers shiftRefsAndMeta, all 10 border modes, setSelectedCellAttr, merge/unmerge locks, and sortedRowMap', () => {
    const xs = loadXSpreadsheetStack();
    const { DataProxy, CellRange } = xs;
    const dp = new DataProxy('S1', {
        mode: 'edit',
        row: { len: 12, height: 24 },
        col: { len: 8, width: 80, indexWidth: 60, minWidth: 60 }
    });

    // Populate data + autoFilter + validation + errors
    dp.setCellText(0, 0, 'Header', 'finished');
    dp.setCellText(1, 0, '30', 'finished');
    dp.setCellText(2, 0, '10', 'finished');
    dp.setCellText(3, 0, '20', 'finished');
    dp.setCellText(4, 0, 'bad', 'finished');

    dp.selector.range = CellRange.valueOf('A1:B4');
    assert.equal(dp.canAutofilter(), true);
    dp.autofilter();
    assert.equal(dp.canAutofilter(), false);
    assert.equal(dp.autoFilter.ref, 'A1:B4');

    dp.setAutoFilter(0, 'asc', 'in', ['10', '20', '30']);
    // Visual row 1 maps to underlying row 2 ('10'), visual row 3 maps to underlying row 1 ('30')
    assert.equal(dp.mapRowIndex(1), 2);
    assert.equal(dp.mapRowIndex(3), 1);

    // Interactive edit inside active autoFilter syncs 'in' filter using _editingOrigin BEFORE change()
    dp.selector.setIndexes(1, 0);
    dp.selector.range = CellRange.valueOf('A2:A2');
    let filterSeenInChange = null;
    dp.change = () => {
        filterSeenInChange = dp.autoFilter.getFilter(0).value.slice();
    };
    dp.setSelectedCellText('15', 'input');
    dp.setSelectedCellText('15', 'finished');
    assert.ok(filterSeenInChange.includes('15'));
    assert.equal(filterSeenInChange.includes('10'), false);
    dp.change = () => {};

    // Border modes under active sortedRowMap hit mapped underlying rows
    const borderModes = ['all', 'outside', 'none', 'inside', 'horizontal', 'vertical', 'top', 'bottom', 'left', 'right'];
    dp.selector.range = CellRange.valueOf('A2:B3');
    for (const mode of borderModes) {
        dp.setSelectedCellAttr('border', { mode, style: 'thin', color: '#112233' });
    }
    const mappedStyle = dp.getCellStyle(dp.mapRowIndex(1), 0);
    assert.ok(mappedStyle && mappedStyle.border && mappedStyle.border.right);

    // Single-cell outside/inside border + out-of-bounds style index returns null (not undefined)
    dp.selector.range = CellRange.valueOf('C1:C1');
    dp.setSelectedCellAttr('border', { mode: 'inside', style: 'thin', color: '#000' });
    dp.setSelectedCellAttr('border', { mode: 'outside', style: 'medium', color: '#333' });
    dp.getCell(0, 2).style = 9999;
    assert.equal(dp.getCellStyle(0, 2), null);

    // Clear autoFilter via toggle
    dp.autofilter();
    assert.equal(dp.autoFilter.active(), false);

    // addValidation validates existing cells immediately, shifts on row/col insert & delete
    dp.addValidation('cell', 'A5:B6', { type: 'number', required: false, operator: 'gt', value: '0' });
    assert.ok(dp.validations.getError(4, 0));
    dp.selector.setIndexes(4, 0);
    dp.selector.range = CellRange.valueOf('A5:A5');
    assert.ok(dp.getSelectedValidator());
    assert.equal(dp.getSelectedValidation().mode, 'cell');

    // Insert row at row 1 -> shifts validation ref A5:B6 -> A6:B7 and error 4_0 -> 5_0
    dp.selector.range = CellRange.valueOf('A2:A2');
    dp.insert('row', 1);
    assert.deepEqual(dp.validations._[0].refs, ['A6:B7']);
    assert.ok(dp.validations.getError(5, 0));
    assert.equal(dp.validations.getError(4, 0), undefined);

    // Insert column at col 0 -> shifts validation ref A6:B7 -> B6:C7 and error 5_0 -> 5_1
    dp.selector.range = CellRange.valueOf('A1:A1');
    dp.insert('column', 1);
    assert.deepEqual(dp.validations._[0].refs, ['B6:C7']);
    assert.ok(dp.validations.getError(5, 1));

    // Delete column 0 -> shifts back to A6:B7 and error 5_0
    dp.selector.range = CellRange.valueOf('A1:A1');
    dp.delete('column');
    assert.deepEqual(dp.validations._[0].refs, ['A6:B7']);
    assert.ok(dp.validations.getError(5, 0));

    // Remove validation clears rule and error
    dp.selector.range = CellRange.valueOf('A6:B7');
    dp.removeValidation();
    assert.equal(dp.validations._.length, 0);
    assert.equal(dp.validations.errors.size, 0);

    // Undo / redo round-trip
    assert.equal(dp.canUndo(), true);
    dp.undo();
    assert.equal(dp.validations._.length, 1);
    assert.equal(dp.canRedo(), true);
    dp.redo();
    assert.equal(dp.validations._.length, 0);

    // setSelectedCellAttr covers format, font-*, strike, textwrap, underline, align, valign, color, bgcolor, formula (col/row/single), custom
    dp.selector.setIndexes(0, 0);
    dp.selector.range = CellRange.valueOf('A1:B2');
    dp.setSelectedCellAttr('format', 'number');
    dp.setSelectedCellAttr('font-bold', true);
    dp.setSelectedCellAttr('font-italic', true);
    dp.setSelectedCellAttr('font-name', 'Georgia');
    dp.setSelectedCellAttr('font-size', 14);
    dp.setSelectedCellAttr('strike', true);
    dp.setSelectedCellAttr('textwrap', true);
    dp.setSelectedCellAttr('underline', true);
    dp.setSelectedCellAttr('align', 'center');
    dp.setSelectedCellAttr('valign', 'top');
    dp.setSelectedCellAttr('color', '#ff0000');
    dp.setSelectedCellAttr('bgcolor', '#eeeeee');
    dp.setSelectedCellAttr('printable', false);
    const st = dp.getCellStyle(0, 0);
    assert.equal(st.format, 'number');
    assert.equal(st.font.bold, true);
    assert.equal(st.font.italic, true);
    assert.equal(st.font.name, 'Georgia');
    assert.equal(st.font.size, 14);
    assert.equal(st.strike, true);
    assert.equal(st.textwrap, true);
    assert.equal(st.underline, true);
    assert.equal(st.align, 'center');
    assert.equal(st.valign, 'top');
    assert.equal(st.color, '#ff0000');
    assert.equal(st.bgcolor, '#eeeeee');
    assert.equal(dp.getCell(0, 0).printable, false);

    // Multi-row formula, multi-col formula, single-cell formula
    dp.setSelectedCellAttr('formula', 'SUM');
    assert.equal(dp.getCell(2, 0).text, '=SUM(A1:A2)');
    assert.equal(dp.getCell(2, 1).text, '=SUM(B1:B2)');
    dp.selector.setIndexes(0, 0);
    dp.selector.range = CellRange.valueOf('A1:B1');
    dp.setSelectedCellAttr('formula', 'AVERAGE');
    assert.equal(dp.getCell(0, 2).text, '=AVERAGE(A1:B1)');
    dp.selector.setIndexes(3, 3);
    dp.selector.range = CellRange.valueOf('D4:D4');
    dp.setSelectedCellAttr('formula', 'MIN');
    assert.equal(dp.getCell(3, 3).text, '=MIN()');

    // merge() aborts if any covered cell is editable: false
    dp.setCellText(6, 1, 'Locked', 'finished');
    dp.getCell(6, 1).editable = false;
    dp.selector.range = CellRange.valueOf('A7:B7');
    dp.setSelectedCellAttr('merge', true);
    assert.equal(dp.merges.getFirstIncludes(6, 0), null);

    // merge() on editable range succeeds and unmerge() works
    dp.selector.range = CellRange.valueOf('C7:D8');
    dp.setSelectedCellAttr('merge', true);
    assert.equal(dp.canUnmerge(), true);
    assert.equal(dp.isSingleSelected(), true);
    dp.setSelectedCellAttr('merge', false);
    assert.equal(dp.canUnmerge(), false);
});

test('DataProxy fixes copyPaste/autofill/cutPaste locks, tall-last-row scroll, setData reset/clamp/clone, delete formula shift, hit-test, and freeze clipping', async () => {
    const xs = loadXSpreadsheetStack();
    const { DataProxy, CellRange } = xs;
    const dp = new DataProxy('S2', {
        mode: 'edit',
        row: { len: 6, height: 25 },
        col: { len: 4, width: 80, indexWidth: 60, minWidth: 60 }
    });

    // Autofill 2-row merged A1:A2 into 1-row A3:A3 must strip overflowing cell.merge (no dangling merge)
    dp.setCellText(0, 0, '1.5', 'finished');
    dp.selector.range = CellRange.valueOf('A1:A2');
    dp.merge();
    assert.equal(dp.autofill(CellRange.valueOf('A3:A3'), 'all'), true);
    assert.equal(dp.getCell(2, 0).merge, undefined);
    assert.equal(dp.merges.getFirstIncludes(2, 0), null);
    // Single-cell decimal autofill increments numerically (1.5 -> 2.5 -> 3.5), not '1.6'
    dp.setCellText(0, 1, '1.5', 'finished');
    dp.selector.range = CellRange.valueOf('B1:B1');
    assert.equal(dp.autofill(CellRange.valueOf('B2:B3'), 'all'), true);
    assert.equal(dp.getCell(1, 1).text, '2.5');
    assert.equal(dp.getCell(2, 1).text, '3.5');
    // Zero-padded suffix rollover: item09 -> item10
    dp.setCellText(0, 3, 'item09', 'finished');
    dp.selector.range = CellRange.valueOf('D1:D1');
    assert.equal(dp.autofill(CellRange.valueOf('D2:D2'), 'all'), true);
    assert.equal(dp.getCell(1, 3).text, 'item10');

    // cutPaste onto locked destination must NOT desync merges
    dp.setCellText(0, 2, 'LockDst', 'finished');
    dp.getCell(0, 2).editable = false;
    dp.selector.range = CellRange.valueOf('A1:A2');
    dp.cut();
    dp.selector.range = CellRange.valueOf('C1:C2');
    dp.paste('all');
    assert.equal(dp.getCell(0, 2).text, 'LockDst');
    assert.equal(dp.merges.getFirstIncludes(0, 0)?.toString(), 'A1:A2');
    assert.equal(dp.merges.getFirstIncludes(0, 2), null);

    // Deleting top row of merge with formula shifts formula and overwrites locked covered cell cleanly
    dp.setCellText(0, 0, '=SUM(B2:B5)', 'finished');
    dp.rows.setCell(1, 0, { text: 'hiddenLock', editable: false }, 'all', true);
    dp.selector.range = CellRange.valueOf('A1:A1');
    dp.delete('row');
    assert.equal(dp.getCell(0, 0).text, '=SUM(B1:B4)');
    assert.equal(dp.getCell(0, 0).merge, undefined);

    // Deleting all rows or all cols is blocked (keeps len >= 1)
    dp.selector.range = new CellRange(0, 0, dp.rows.len - 1, 0);
    const prevRowLen = dp.rows.len;
    dp.delete('row');
    assert.equal(dp.rows.len, prevRowLen);
    dp.selector.range = new CellRange(0, 0, 0, dp.cols.len - 1);
    const prevColLen = dp.cols.len;
    dp.delete('column');
    assert.equal(dp.cols.len, prevColLen);

    // Tall last row scrolly clamps scroll.y to row start (never past totalHeight -> blank viewport)
    const dpTall = new DataProxy('Tall', {
        mode: 'edit',
        row: { len: 3, height: 25 },
        col: { len: 3, width: 80, indexWidth: 60, minWidth: 60 }
    });
    dpTall.rows.setHeight(2, 600);
    dpTall.cols.setWidth(2, 900);
    let scrolled = 0;
    dpTall.scrolly(150, () => { scrolled++; });
    assert.equal(dpTall.scroll.ri, 2);
    assert.equal(dpTall.scroll.y, 50); // NOT 650!
    dpTall.scrollx(250, () => { scrolled++; });
    assert.equal(dpTall.scroll.ci, 2);
    assert.equal(dpTall.scroll.x, 160); // NOT 1060!
    assert.equal(scrolled, 2);

    // setData resets omitted rows, resets invalid freeze, clamps scroll/selector, revalidates errors, deep-clones data
    const dpSet = new DataProxy('OrigName', {
        mode: 'edit',
        row: { len: 5, height: 25 },
        col: { len: 4, width: 80, indexWidth: 60, minWidth: 60 }
    });
    dpSet.setFreeze(2, 1);
    dpSet.setCellText(0, 0, 'OldData', 'finished');
    dpSet.scroll.ri = 4;
    dpSet.scroll.y = 100;
    const extStyles = [{ color: '#111' }];
    dpSet.setData({
        name: '   ',
        freeze: null,
        styles: extStyles,
        rows: { len: 3, 0: { cells: { 0: { text: 'bad-num' } } } },
        validations: [{ mode: 'cell', refs: ['A1'], type: 'number', required: false, operator: 'gt', value: '0' }]
    });
    assert.equal(dpSet.name, 'OrigName');
    assert.deepEqual(dpSet.freeze, [0, 0]);
    assert.equal(dpSet.scroll.ri, 0);
    assert.equal(dpSet.scroll.y, 0);
    assert.ok(dpSet.validations.getError(0, 0));
    extStyles[0].color = '#999';
    assert.equal(dpSet.styles[0].color, '#111');
    const exported = dpSet.getData();
    exported.styles[0].color = '#000';
    assert.equal(dpSet.styles[0].color, '#111');
    // Omitting rows in setData resets rows
    dpSet.setData({ name: 'ResetSheet' });
    assert.equal(dpSet.getCell(0, 0), null);
    assert.equal(dpSet.name, 'ResetSheet');

    // setCellText fires validations BEFORE change() and does not leave phantom empty cells in undo
    const dpEdit = new DataProxy('Edit', { mode: 'edit', row: { len: 5, height: 25 }, col: { len: 4, width: 80, indexWidth: 60, minWidth: 60 } });
    dpEdit.addValidation('cell', 'A1', { type: 'number', required: true, operator: 'gt', value: '0' });
    let errDuringChange = null;
    dpEdit.change = () => {
        errDuringChange = dpEdit.validations.getError(0, 0);
    };
    dpEdit.setCellText(0, 0, 'not-a-num', 'input');
    assert.ok(errDuringChange);
    dpEdit.setCellText(0, 0, '10', 'finished');
    assert.equal(errDuringChange, undefined);
    dpEdit.undo();
    assert.equal(dpEdit.getCell(0, 0), null); // No phantom { text: '' }

    // getCellRowByY / getCellColByX boundary & trailing hidden row/col skip + freeze viewRange & xyInSelectedRect
    const dpHit = new DataProxy('Hit', {
        mode: 'edit',
        view: { width: () => 500, height: () => 400 },
        row: { len: 5, height: 25 },
        col: { len: 4, width: 80, indexWidth: 60, minWidth: 60 }
    });
    dpHit.rows.setHide(4, true);
    dpHit.cols.setHide(3, true);
    dpHit.scroll.y = 25;
    dpHit.scroll.ri = 1;
    // Exact boundary y = 25 (rows.height) while scrolled hits row 1, NOT scrolled-off row 0
    assert.equal(dpHit.getCellRectByXY(70, 25).ri, 1);
    // Past end skips hidden trailing row 4 / col 3
    assert.equal(dpHit.getCellRectByXY(500, 500).ri, 3);
    assert.equal(dpHit.getCellRectByXY(500, 500).ci, 2);

    // Freeze + scroll: viewRange clamps to freeze, xyInSelectedRect false when scrolled under freeze
    dpHit.setFreeze(2, 1);
    dpHit.scroll.ri = 1;
    dpHit.scroll.ci = 0;
    assert.equal(dpHit.viewRange().sri, 2);
    assert.equal(dpHit.viewRange().sci, 1);
    dpHit.selector.range = CellRange.valueOf('B3:B3');
    dpHit.scroll.y = 50; // B3 scrolled under frozen rows 0..1
    assert.equal(dpHit.xyInSelectedRect(160, 40), false);

    // hideRowsOrCols & unhideRowsOrCols + pasteFromText skipping exceptRowSet & auto-expanding bounds
    dpHit.selector.range = new CellRange(0, 1, dpHit.rows.len - 1, 1);
    dpHit.hideRowsOrCols();
    assert.equal(dpHit.cols.isHide(1), true);
    dpHit.unhideRowsOrCols('col', 1);
    assert.equal(dpHit.cols.isHide(1), false);

    dpHit.exceptRowSet = new Set([1]);
    dpHit.selector.range = CellRange.valueOf('A1:A1');
    dpHit.pasteFromText('r0\nr2\nr3\nr4\nr5\nr6');
    assert.equal(dpHit.getCell(0, 0).text, 'r0');
    assert.equal(dpHit.getCell(1, 0), null); // skipped filtered row 1
    assert.equal(dpHit.getCell(2, 0).text, 'r2');
    assert.ok(dpHit.rows.len >= 7);

    // pasteFromSystemClipboard with mocked navigator.clipboard
    await runWithDomGlobals({
        navigator: {
            clipboard: {
                readText: async () => 'p1\tp2\tp3\tp4\tp5',
                writeText: async () => {}
            }
        }
    }, async () => {
        dpHit.exceptRowSet = new Set();
        dpHit.selector.range = CellRange.valueOf('A1:A1');
        let resetCount = 0;
        let pastedRows = null;
        await dpHit.pasteFromSystemClipboard(() => { resetCount++; }, r => { pastedRows = r; });
        assert.equal(resetCount, 1);
        assert.ok(pastedRows);
        assert.equal(dpHit.getCell(0, 4).text, 'p5');
        assert.ok(dpHit.cols.len >= 5);
    });
});

test('x-spreadsheet core algorithms, formulas, validation, format, autoFilter, merges, rows/cols, and Draw/Draw2 fixes', async () => {
    const xs = loadXSpreadsheetStack();
    const {
        shiftFormulaRefs, cellMod, formulam, helperMod, Validator, Validations,
        AutoFilter, formatMod, Merges, Rows, Cols, drawMod, draw2Mod
    } = xs;
    const exprMod = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/algorithm/expression.js');

    // shiftFormulaRefs range deletion fixes (no inverted ranges, supports spaces & reversed ranges)
    assert.equal(
        shiftFormulaRefs('=SUM(A2:A3)', 0, -2, (_x, y) => y > 2, true, { axis: 'row', start: 1, end: 2 }),
        '=SUM(#REF!)'
    );
    assert.equal(
        shiftFormulaRefs('=SUM(A1:A2)', 0, -2, (_x, y) => y > 1, true, { axis: 'row', start: 0, end: 1 }),
        '=SUM(#REF!)'
    );
    assert.equal(
        shiftFormulaRefs('=SUM(A5:A2)', 0, -1, (_x, y) => y > 1, true, { axis: 'row', start: 1, end: 1 }),
        '=SUM(A4:A2)'
    );
    assert.equal(
        shiftFormulaRefs('=SUM(A3 : A5)', 0, -2, (_x, y) => y > 2, true, { axis: 'row', start: 1, end: 2 }),
        '=SUM(A2 : A3)'
    );
    assert.equal(
        shiftFormulaRefs('=SUM(B1:C1)', -2, 0, x => x > 2, true, { axis: 'col', start: 1, end: 2 }),
        '=SUM(#REF!)'
    );
    // Cross-sheet reference stays untouched
    assert.equal(
        shiftFormulaRefs('=Sheet2!A2+A5', 0, -1, (_x, y) => y > 1, true, { axis: 'row', start: 1, end: 1 }),
        '=Sheet2!A2+A4'
    );

    // cell.js malformed formula rejections & leading-zero circular self-ref
    const getCell = (x, y) => (x === 0 && y === 0 ? '=A01+1' : '10');
    assert.equal(cellMod.render('=SUM(1 + )', formulam, getCell), '=SUM(1 + )');
    assert.equal(cellMod.render('=SUM(1, +)', formulam, getCell), '=SUM(1, +)');
    assert.equal(cellMod.render('=SUM(1, ())', formulam, getCell), '=SUM(1, ())');
    assert.equal(cellMod.render('=SUM(1, (2, 3))', formulam, getCell), '=SUM(1, (2, 3))');
    assert.equal(cellMod.render('=SUM(A1:A2:A3)', formulam, getCell), '=SUM(A1:A2:A3)');
    assert.equal(cellMod.render('=A01+1', formulam, getCell, [], 'A1'), '1');
    assert.equal(cellMod.render('=TRUE+1', formulam, getCell), '2');
    assert.equal(cellMod.render('=(10>5)+(10>2)', formulam, getCell), '2');

    // helper.numberCalc boolean & tiny < 1e-100 numbers
    assert.equal(helperMod.numberCalc('+', true, 1), '2');
    assert.equal(helperMod.numberCalc('+', false, true), '1');
    assert.equal(helperMod.numberCalc('*', 1e-50, 1e-60), '1e-110');

    // expression.js unary minus fixes
    assert.deepEqual(exprMod.infix2suffix('-(3+1)'), ['0', '3', '1', '+', '-']);
    assert.deepEqual(exprMod.infix2suffix('--5'), ['0', '-5', '-']);
    assert.deepEqual(exprMod.infix2suffix('- 5'), ['0', '5', '-']);
    assert.deepEqual(exprMod.infix2suffix('3+-'), ['3', '+']);

    // validator.js impossible dates, Infinity, malformed be/nbe error message, Date passthrough
    const dateVal = new Validator('date', false, '', undefined);
    assert.equal(dateVal.validate('2024-02-31')[0], false);
    assert.equal(dateVal.validate('2023-02-29')[0], false);
    assert.equal(dateVal.validate('2024-02-29')[0], true);
    assert.equal(dateVal.validate(new Date(2024, 1, 29))[0], true);
    const numVal = new Validator('number', false, '', undefined);
    assert.equal(numVal.validate('Infinity')[0], false);
    assert.equal(numVal.validate('-Infinity')[0], false);
    const badBe = new Validator('number', false, [1], 'be');
    const [okBe, msgBe] = badBe.validate('5');
    assert.equal(okBe, false);
    assert.ok(msgBe.length > 0);
    const badNbe = new Validator('number', false, null, 'nbe');
    const [okNbe, msgNbe] = badNbe.validate('5');
    assert.equal(okNbe, false);
    assert.ok(msgNbe.length > 0);

    // Validations & Merges ignore invalid refs (do not corrupt A1)
    const vals = new Validations();
    vals.add('cell', 'not-a-ref', { type: 'number' });
    vals.add('cell', 'A1', null);
    assert.equal(vals._.length, 0);
    const m = new Merges();
    m.setData(['invalid', 'A1', 'A1:B2']);
    assert.deepEqual(m.getData(), ['A1:B2']);

    // AutoFilter numeric values
    const af = new AutoFilter();
    af.setData({ ref: 'A1:A3', filters: [{ ci: 0, operator: 'in', value: [10, 20] }] });
    assert.equal(af.filters[0].includes('10'), true);
    af.addFilter(0, 'eq', 10);
    assert.equal(af.filters[0].includes('10'), true);
    af.addFilter(0, 'neq', 10);
    assert.equal(af.filters[0].includes('10'), false);

    // format.js large hex/octal/+ prefixed numbers
    assert.equal(formatMod.formatm.number.render('+1000000000000000'), '1,000,000,000,000,000.00');
    assert.equal(formatMod.formatm.number.render('0x10000000000000'), '4,503,599,627,370,496.00');

    // Rows.getHeight & Cols.getWidth reject NaN/negative/string
    const r = new Rows({ len: 5, height: 24 });
    r.setData({ len: 5, 0: { height: '30' }, 1: { height: NaN }, 2: { height: -5 }, 3: { height: 40 } });
    assert.equal(r.getHeight(0), 24);
    assert.equal(r.getHeight(1), 24);
    assert.equal(r.getHeight(2), 24);
    assert.equal(r.getHeight(3), 40);
    const c = new Cols({ len: 5, width: 80, indexWidth: 60, minWidth: 60 });
    c.setData({ len: 5, 0: { width: '100' }, 1: { width: null }, 2: { width: 120 } });
    assert.equal(c.getWidth(0), 80);
    assert.equal(c.getWidth(1), 80);
    assert.equal(c.getWidth(2), 120);

    // Draw null ctx safety, setBorders(null), border styles, rect restores ctx on throw, Draw2 non-null ctx methods
    await runWithDomGlobals({ window: { devicePixelRatio: 1 } }, () => {
        const nullDraw = new drawMod.Draw(null, 100, 100);
        assert.doesNotThrow(() => {
            nullDraw.clear().attr({}).save().restore().beginPath().translate(1, 2).scale(1, 1)
                .clearRect(0, 0, 10, 10).fillRect(0, 0, 10, 10).fillText('a', 0, 0)
                .text('x', new drawMod.DrawBox(0, 0, 50, 20)).border('medium', '#000')
                .line([0, 0], [10, 10]);
            nullDraw.strokeBorders(new drawMod.DrawBox(0, 0, 10, 10));
            nullDraw.dropdown(new drawMod.DrawBox(0, 0, 20, 20));
            nullDraw.error(new drawMod.DrawBox(0, 0, 20, 20));
            nullDraw.frozen(new drawMod.DrawBox(0, 0, 20, 20));
            nullDraw.rect(new drawMod.DrawBox(0, 0, 20, 20), () => {});
        });

        let restored = 0;
        const rectCalls = [];
        const fillTexts = [];
        const ctx = {
            ...createCanvasContextMock(),
            restore: () => { restored++; },
            rect: (...args) => rectCalls.push(args),
            fillText: (...args) => fillTexts.push(args)
        };
        const d = new drawMod.Draw({ style: {}, getContext: () => ctx }, 200, 100);
        const box = new drawMod.DrawBox(0, 0, 80, 24, 4);
        assert.doesNotThrow(() => box.setBorders(null));
        assert.equal(box.innerHeight(), 14);
        assert.equal(box.textx('right'), 76);
        assert.equal(box.texty('top'), 4);
        assert.equal(box.texty('bottom', 10), 10);
        for (const bs of ['medium', 'thick', 'hair', 'dashed', 'mediumDashed', 'dashDot', 'slantDashDot', 'mediumDashDot', 'dashDotDot', 'mediumDashDotDot', 'dotted', 'double']) {
            d.border(bs, '#123456');
        }
        assert.throws(() => d.rect(box, () => { throw new Error('cb boom'); }), /cb boom/);
        assert.equal(restored, 1);
        // Column A / Row 1 rect starts at rx=1, ry=1 (never overwrites 0.5 border line!)
        assert.equal(rectCalls[0][0], 1);
        assert.equal(rectCalls[0][1], 1);
        // Wrapping surrogate pair text produces clean fillText calls
        d.text('Hello😀World', new drawMod.DrawBox(0, 0, 48, 40, 2), { font: { size: '12' }, underline: true, strike: true, valign: 'top', align: 'center' }, true);
        assert.ok(fillTexts.length >= 2);
        assert.equal(fillTexts.map(call => call[0]).join(''), 'Hello😀World');

        // Draw2 non-null ctx exercises all 16 methods and omits undefined maxWidth
        const d2Calls = [];
        const d2Ctx = {
            clearRect: (...a) => d2Calls.push(['clearRect', a]),
            save: () => d2Calls.push(['save']),
            beginPath: () => d2Calls.push(['beginPath']),
            restore: () => d2Calls.push(['restore']),
            closePath: () => d2Calls.push(['closePath']),
            measureText: s => ({ width: s.length * 5 }),
            rect: (...a) => d2Calls.push(['rect', a]),
            scale: (...a) => d2Calls.push(['scale', a]),
            rotate: (...a) => d2Calls.push(['rotate', a]),
            translate: (...a) => d2Calls.push(['translate', a]),
            transform: (...a) => d2Calls.push(['transform', a]),
            fillRect: (...a) => d2Calls.push(['fillRect', a]),
            strokeRect: (...a) => d2Calls.push(['strokeRect', a]),
            fillText: (...a) => d2Calls.push(['fillText', a]),
            strokeText: (...a) => d2Calls.push(['strokeText', a])
        };
        const d2 = new draw2Mod.Draw({ width: 50, height: 30, getContext: () => d2Ctx });
        d2.clear().attr({ fillStyle: '#fff' }).save().beginPath().rect(1, 2, 3, 4).scale(2, 2)
            .rotate(0.5).translate(3, 4).transform(1, 0, 0, 1, 0, 0).fillRect(0, 0, 5, 5)
            .strokeRect(0, 0, 5, 5).fillText('hi', 1, 2).fillText('hi', 1, 2, 50)
            .strokeText('lo', 3, 4).strokeText('lo', 3, 4, 40).closePath().restore();
        assert.equal(d2.measureText('abc').width, 15);
        assert.equal(d2Calls.find(c => c[0] === 'fillText')[1].length, 3);
        assert.equal(d2Calls.filter(c => c[0] === 'fillText')[1][1].length, 4);
    });
});
