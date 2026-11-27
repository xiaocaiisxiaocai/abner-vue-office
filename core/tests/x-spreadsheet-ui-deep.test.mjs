import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createCanvasContextMock,
    createDomMocks,
    loadStrippedModule,
    runWithDomGlobals
} from './helpers/load-module.mjs';

function buildUiStack() {
    const alphabetMod = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/alphabet.js');
    const { CellRange } = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/cell_range.js', {
        expr2xy: alphabetMod.expr2xy,
        xy2expr: alphabetMod.xy2expr
    });
    const { Merges } = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/merge.js', { CellRange });
    const helperMod = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/helper.js');
    const { Rows } = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/row.js', {
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
        Resizer, Scrollbar, Selector, Editor, Print, ContextMenu, Table, Toolbar, ModalValidation, SortFilter, xtoast: messageMod.xtoast, cssPrefix: 'x-spreadsheet', formulas
    });
    const Spreadsheet = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/index.js', { h, DataProxy, Sheet, Bottombar, cssPrefix: 'x-spreadsheet', locale });

    return {
        eventMod, h, DataProxy, Spreadsheet, Print, Suggest, SortFilter, Resizer,
        Bottombar, BorderPalette, DropdownColor, FormSelect, ModalValidation, messageMod, tooltipMod, CellRange
    };
}

test('x-spreadsheet UI fixes: event bindTouch, print npx/printable, suggest, sortFilter "all", resizer, border_palette, form_select, bottombar', async () => {
    const { mockDocument, mockWindow, windowListeners } = createDomMocks();
    const docListeners = new Map();
    mockDocument.addEventListener = (t, fn) => {
        if (!docListeners.has(t)) docListeners.set(t, new Set());
        docListeners.get(t).add(fn);
    };
    mockDocument.removeEventListener = (t, fn) => {
        docListeners.get(t)?.delete(fn);
    };
    mockWindow.devicePixelRatio = 2;

    const origCreate = mockDocument.createElement.bind(mockDocument);
    const rectCalls = [];
    const filledTexts = [];
    mockDocument.createElement = (tag) => {
        const el = origCreate(tag);
        if (tag === 'canvas') {
            el.getContext = () => ({
                ...createCanvasContextMock(),
                rect: (...a) => rectCalls.push(a),
                fillText: (t) => filledTexts.push(t)
            });
        }
        return el;
    };

    await runWithDomGlobals({ document: mockDocument, window: mockWindow, getComputedStyle: mockWindow.getComputedStyle }, () => {
        const ui = buildUiStack();

        // event.js bindTouch + calTouchDirection + deadzone
        const target = mockDocument.createElement('div');
        const moves = [];
        const ends = [];
        const unbind = ui.eventMod.bindTouch(target, {
            move: (dir, dist) => moves.push([dir, dist]),
            end: (dir, dist) => ends.push([dir, dist])
        });
        target.dispatchEvent({ type: 'touchstart', touches: [{ pageX: 10, pageY: 10 }] });
        target.dispatchEvent({ type: 'touchmove', changedTouches: [{ pageX: 15, pageY: 12 }] }); // <= 10px deadzone
        assert.equal(moves.length, 0);
        target.dispatchEvent({ type: 'touchmove', changedTouches: [{ pageX: 40, pageY: 12 }] });
        target.dispatchEvent({ type: 'touchmove', changedTouches: [{ pageX: 40, pageY: 0 }] });
        target.dispatchEvent({ type: 'touchend', changedTouches: [{ pageX: 20, pageY: 0 }] });
        assert.deepEqual(moves, [['right', 30], ['up', -12]]);
        assert.deepEqual(ends, [['left', -20]]);
        unbind();

        // print.js HiDPI npx() clip, printable: false skip, offscreen iframe
        const dp = new ui.DataProxy('P1', { mode: 'edit' });
        dp.setCellText(0, 0, 'PrintMe', 'finished');
        dp.setCellText(1, 0, 'NoPrint', 'finished');
        dp.getCell(1, 0).printable = false;
        const p = new ui.Print(dp);
        p.preview();
        assert.ok(rectCalls.some(r => r[0] === 100 && r[1] === 100)); // padding=50 * dpr=2
        assert.equal(filledTexts.includes('PrintMe'), true);
        assert.equal(filledTexts.includes('NoPrint'), false);
        p.destroy();
        assert.equal(p.canvases.length, 0);

        // Suggest resets itemIndex on search
        const sug = new ui.Suggest(['SUM', 'SUBTOTAL', 'AVERAGE'], () => {});
        sug.search('SU');
        sug.el.el.parentNode = mockDocument.body;
        const inputEl = ui.h('input', '');
        sug.bindInputEvents(inputEl);
        inputEl.el.dispatchEvent({ type: 'keydown', keyCode: 40 });
        inputEl.el.dispatchEvent({ type: 'keydown', keyCode: 40 }); // itemIndex = 1
        sug.search('AVG_NONE_MATCH_OR_ONE');
        sug.setItems(['AVERAGE']);
        sug.search('AV'); // shrinks to length 1
        assert.doesNotThrow(() => inputEl.el.dispatchEvent({ type: 'keydown', keyCode: 13 }));

        // SortFilter literal 'all' item toggles individually without toggleAll
        const sf = new ui.SortFilter();
        sf.set(0, { all: 2, keep: 1 }, null, null);
        sf.filterClick(0, 'all');
        assert.deepEqual(sf.filterValues, ['keep']);
        sf.toggleAll();
        assert.deepEqual(sf.filterValues, ['all', 'keep']);
        sf.setOffset({ left: 900, top: 580 }, { width: 1000, height: 600 });
        assert.ok(parseFloat(sf.el.css('left')) <= 740);
        assert.ok(parseFloat(sf.el.css('top')) <= 260);

        // Resizer unhideIndex === 0 & -5px guide
        let unhid = null;
        const res = new ui.Resizer(true, 40);
        res.unhideFn = idx => { unhid = idx; };
        res.showUnhide(0);
        res.mousedblclickHandler();
        assert.equal(unhid, 0);
        res.show({ left: 60, top: 0, width: 80, height: 24 }, { height: 500 });
        res.mousedownHandler({ buttons: 1, clientX: 140, clientY: 10 });
        mockWindow.dispatchEvent({ type: 'mousemove', buttons: 1, clientX: 160, clientY: 10 });
        assert.equal(res.el.css('left'), '155px'); // 60 + 100 - 5
        mockWindow.dispatchEvent({ type: 'mouseup' });

        // BorderPalette all modes + DropdownColor + FormSelect + ModalValidation AAA1
        const bp = new ui.BorderPalette();
        const borderModes = [];
        bp.change = d => borderModes.push(d.mode);
        bp.el.el.querySelectorAll('.x-spreadsheet-border-palette-cell').forEach(cell => cell.click());
        assert.equal(borderModes.length, 10);

        const dc = new ui.DropdownColor('text', '#000');
        let picked = null;
        dc.change = c => { picked = c; };
        dc.contentEl.el.querySelector('td').children[0].dispatchEvent({ type: 'click', stopPropagation: () => {} });
        assert.ok(picked && picked.startsWith('#'));

        const fsel = new ui.FormSelect('list', ['list', 'number'], '100px', it => it);
        assert.equal(fsel.val(), 'list');

        const mv = new ui.ModalValidation();
        assert.equal(mv.rf.validate(), false);
        mv.rf.val('AAA1:XFD10');
        assert.equal(mv.rf.validate(), true);
        mv.hide();
    });
    assert.equal(windowListeners.get('mousemove')?.size || 0, 0);
});

test('Spreadsheet & Sheet integration: single-char edit, Esc revert, IME guard, Formula focus, Read copy menu, multi-instance toast isolation', async () => {
    const { mockDocument, mockWindow } = createDomMocks();
    const origCreate = mockDocument.createElement.bind(mockDocument);
    mockDocument.createElement = (tag) => {
        const el = origCreate(tag);
        if (tag === 'canvas') {
            el.getContext = () => createCanvasContextMock();
        }
        return el;
    };

    await runWithDomGlobals({ document: mockDocument, window: mockWindow, getComputedStyle: mockWindow.getComputedStyle }, () => {
        const ui = buildUiStack();
        const host1 = mockDocument.createElement('div');
        mockDocument.body.appendChild(host1);
        const xs = new ui.Spreadsheet(host1, {
            mode: 'edit',
            showToolbar: true,
            showBottomBar: true,
            extendToolbar: {
                left: [{ tip: 'Custom', icon: 'icon.png', onClick: () => {} }]
            },
            view: { width: () => 800, height: () => 600 }
        });

        // autoFocus preserved after loadData
        xs.loadData([{ name: 'S1', rows: { 0: { cells: { 0: { text: 'old' } } } } }]);
        assert.equal(xs.sheet.selector.br.autoFocus, true);

        // Single-char edit commits & records Undo
        xs.sheet.focusing = true;
        const prevUndo = xs.data.history.undoItems.length;
        mockWindow.dispatchEvent({ type: 'keydown', keyCode: 65, key: 'A', preventDefault() {} });
        mockWindow.dispatchEvent({ type: 'keydown', keyCode: 13, key: 'Enter', preventDefault() {} });
        assert.equal(xs.cell(0, 0, 0).text, 'A');
        assert.equal(xs.data.history.undoItems.length, prevUndo + 1);

        // Escape cancel reverts mutated cell
        xs.sheet.selector.set(0, 0);
        xs.sheet.editor.setCell(xs.cell(0, 0, 0));
        xs.sheet.editor.textEl.el.value = 'changed';
        xs.sheet.editor.textEl.el.dispatchEvent({ type: 'input', target: xs.sheet.editor.textEl.el });
        assert.equal(xs.cell(0, 0, 0).text, 'changed');
        xs.sheet.editor.cancel();
        assert.equal(xs.cell(0, 0, 0).text, 'A');

        // IME composing Enter ignored by _onWindowKeydown
        xs.sheet.focusing = true;
        mockWindow.dispatchEvent({ type: 'keydown', keyCode: 13, key: 'Enter', isComposing: true, preventDefault() {} });
        assert.equal(xs.data.selector.ri, 0); // stays on row 0 after selector.set(0, 0)

        // Formula toolbar click sets focusing=true so Enter commits formula
        xs.sheet.focusing = false;
        xs.sheet.toolbar.change('formula', 'SUM');
        assert.equal(xs.sheet.focusing, true);
        mockWindow.dispatchEvent({ type: 'keydown', keyCode: 13, key: 'Enter', preventDefault() {} });
        assert.equal(xs.sheet.editor._editing, false);

        // Read mode with showContextmenu: true enables copy-only contextMenu
        const hostRead = mockDocument.createElement('div');
        mockDocument.body.appendChild(hostRead);
        const xsRead = new ui.Spreadsheet(hostRead, {
            mode: 'read',
            showToolbar: false,
            showContextmenu: true,
            view: { width: () => 800, height: () => 600 }
        });
        assert.equal(xsRead.sheet.contextMenu.isHide, false);
        xsRead.sheet.contextMenu.setMode('read');
        assert.notEqual(xsRead.sheet.contextMenu.menuItems[0].css('display'), 'none');
        assert.equal(xsRead.sheet.contextMenu.menuItems[1].css('display'), 'none');

        // Destroying xsRead does NOT dismiss unrelated toast on body
        ui.messageMod.xtoast('Keep', 'Other toast');
        assert.equal(mockDocument.body.children.filter(c => c.className.includes('x-spreadsheet-toast')).length, 1);
        xsRead.destroy();
        assert.equal(mockDocument.body.children.filter(c => c.className.includes('x-spreadsheet-toast')).length, 1);

        xs.destroy();
        ui.messageMod.clearToasts();
    });
});
