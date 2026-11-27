import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createDomMocks,
    loadStrippedModule,
    runWithDomGlobals
} from './helpers/load-module.mjs';

function buildFullUiModules() {
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
    const { t, tf, locale } = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/locale/locale.js', { en: enLocale });
    const Validator = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/validator.js', { t, helper: helperMod });
    const { Validations } = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/validation.js', { Validator, CellRange });
    const fontMod = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/font.js');
    const formatMod = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/format.js', { tf });
    const { formulas, formulam } = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/formula.js', {
        tf,
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
        t
    });

    const eventMod = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/event.js');
    const { Element, h } = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/element.js');
    const Icon = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/icon.js', {
        Element,
        h,
        cssPrefix: 'x-spreadsheet'
    });
    const Button = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/button.js', {
        Element,
        cssPrefix: 'x-spreadsheet',
        t
    });
    const tooltipMod = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/tooltip.js', {
        h,
        bind: eventMod.bind,
        unbind: eventMod.unbind,
        cssPrefix: 'x-spreadsheet'
    });
    const messageMod = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/message.js', {
        h,
        Icon,
        bind: eventMod.bind,
        unbind: eventMod.unbind,
        cssPrefix: 'x-spreadsheet'
    });
    const Dropdown = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/dropdown.js', {
        Element,
        h,
        bindClickoutside: eventMod.bindClickoutside,
        unbindClickoutside: eventMod.unbindClickoutside,
        cssPrefix: 'x-spreadsheet'
    });
    const ColorPalette = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/color_palette.js', {
        h,
        cssPrefix: 'x-spreadsheet'
    });
    const DropdownColor = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/dropdown_color.js', {
        Dropdown,
        ColorPalette,
        Icon
    });
    const DropdownAlign = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/dropdown_align.js', {
        Dropdown,
        h,
        Icon,
        cssPrefix: 'x-spreadsheet'
    });
    const DropdownFont = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/dropdown_font.js', {
        Dropdown,
        h,
        baseFonts: fontMod.baseFonts,
        cssPrefix: 'x-spreadsheet'
    });
    const DropdownFontSize = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/dropdown_fontsize.js', {
        Dropdown,
        h,
        fontSizes: fontMod.fontSizes,
        cssPrefix: 'x-spreadsheet'
    });
    const DropdownFormat = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/dropdown_format.js', {
        Dropdown,
        h,
        baseFormats: formatMod.baseFormats,
        cssPrefix: 'x-spreadsheet'
    });
    const DropdownFormula = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/dropdown_formula.js', {
        Dropdown,
        h,
        Icon,
        baseFormulas: formulas,
        cssPrefix: 'x-spreadsheet'
    });
    const DropdownLineType = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/dropdown_linetype.js', {
        Dropdown,
        h,
        Icon,
        cssPrefix: 'x-spreadsheet'
    });
    const BorderPalette = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/border_palette.js', {
        h,
        Icon,
        DropdownColor,
        DropdownLineType,
        cssPrefix: 'x-spreadsheet'
    });
    const DropdownBorder = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/dropdown_border.js', {
        Dropdown,
        Icon,
        BorderPalette
    });
    const ContextMenu = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/contextmenu.js', {
        h,
        bindClickoutside: eventMod.bindClickoutside,
        unbindClickoutside: eventMod.unbindClickoutside,
        cssPrefix: 'x-spreadsheet',
        tf
    });
    const Scrollbar = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/scrollbar.js', {
        h,
        cssPrefix: 'x-spreadsheet'
    });

    const Item = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/item.js', {
        cssPrefix: 'x-spreadsheet',
        tooltip: tooltipMod,
        h,
        t
    });
    const IconItem = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/icon_item.js', { Item, Icon });
    const ToggleItem = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/toggle_item.js', { Item, Icon });
    const DropdownItem = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/dropdown_item.js', { Dropdown, Item });
    const Align = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/align.js', { DropdownItem, DropdownAlign });
    const Valign = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/valign.js', { DropdownItem, DropdownAlign });
    const Autofilter = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/autofilter.js', { ToggleItem });
    const Bold = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/bold.js', { ToggleItem });
    const Italic = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/italic.js', { ToggleItem });
    const Strike = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/strike.js', { ToggleItem });
    const Underline = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/underline.js', { ToggleItem });
    const Border = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/border.js', { DropdownItem, DropdownBorder });
    const Clearformat = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/clearformat.js', { IconItem });
    const Paintformat = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/paintformat.js', { ToggleItem });
    const TextColor = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/text_color.js', { DropdownItem, DropdownColor });
    const FillColor = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/fill_color.js', { DropdownItem, DropdownColor });
    const FontSize = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/font_size.js', {
        DropdownItem,
        DropdownFontSize,
        DropdownFontsize: DropdownFontSize
    });
    const Font = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/font.js', { DropdownItem, DropdownFont });
    const Format = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/format.js', { DropdownItem, DropdownFormat });
    const Formula = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/formula.js', { DropdownItem, DropdownFormula });
    const Freeze = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/freeze.js', { ToggleItem });
    const Merge = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/merge.js', { ToggleItem });
    const Redo = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/redo.js', { IconItem });
    const Undo = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/undo.js', { IconItem });
    const PrintBtn = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/print.js', { IconItem });
    const Textwrap = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/textwrap.js', { ToggleItem });
    const More = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/more.js', {
        Dropdown,
        DropdownItem,
        cssPrefix: 'x-spreadsheet',
        h,
        Icon
    });
    const Toolbar = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/index.js', {
        Align, Valign, Autofilter, Bold, Italic, Strike, Underline, Border,
        Clearformat, Paintformat, TextColor, FillColor, FontSize, Font,
        Format, Formula, Freeze, Merge, Redo, Undo, Print: PrintBtn, Textwrap,
        More, Item, h, cssPrefix: 'x-spreadsheet',
        bind: eventMod.bind, unbind: eventMod.unbind, hideTooltip: tooltipMod.hideTooltip
    });

    const Suggest = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/suggest.js', {
        h, bindClickoutside: eventMod.bindClickoutside, unbindClickoutside: eventMod.unbindClickoutside, cssPrefix: 'x-spreadsheet'
    });
    const Calendar = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/calendar.js', { h, Icon, t });
    const Datepicker = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/datepicker.js', {
        Calendar, h, cssPrefix: 'x-spreadsheet'
    });
    const Editor = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/editor.js', {
        h, Suggest, Datepicker, cssPrefix: 'x-spreadsheet'
    });
    const FormInput = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/form_input.js', { h, cssPrefix: 'x-spreadsheet' });
    const FormSelect = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/form_select.js', {
        h, Suggest, cssPrefix: 'x-spreadsheet'
    });
    const FormField = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/form_field.js', {
        h, cssPrefix: 'x-spreadsheet', t
    });
    const Modal = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/modal.js', {
        h, Icon, cssPrefix: 'x-spreadsheet', bind: eventMod.bind, unbind: eventMod.unbind
    });
    const ModalValidation = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/modal_validation.js', {
        Modal, FormInput, FormSelect, FormField, Button, t, h, cssPrefix: 'x-spreadsheet'
    });
    const SortFilter = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/sort_filter.js', {
        h, Button, bindClickoutside: eventMod.bindClickoutside, unbindClickoutside: eventMod.unbindClickoutside, cssPrefix: 'x-spreadsheet', t
    });
    const Resizer = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/resizer.js', {
        h, mouseMoveUp: eventMod.mouseMoveUp, cssPrefix: 'x-spreadsheet'
    });
    const Selector = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/selector.js', {
        h, cssPrefix: 'x-spreadsheet', CellRange
    });
    const drawMod = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/canvas/draw.js');
    const Table = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/table.js', {
        stringAt: alphabetMod.stringAt,
        getFontSizePxByPt: fontMod.getFontSizePxByPt,
        _cell: cellMod,
        formulam,
        formatm: formatMod.formatm,
        Draw: drawMod.Draw,
        DrawBox: drawMod.DrawBox,
        thinLineWidth: drawMod.thinLineWidth,
        npx: drawMod.npx
    });
    const Print = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/print.js', {
        h, cssPrefix: 'x-spreadsheet', Button, Draw: drawMod.Draw, renderCell: Table.renderCell, t
    });
    const Bottombar = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/bottombar.js', {
        h, bindClickoutside: eventMod.bindClickoutside, unbindClickoutside: eventMod.unbindClickoutside,
        cssPrefix: 'x-spreadsheet', Icon, FormInput, Dropdown, tf
    });
    const Sheet = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/sheet.js', {
        h, bind: eventMod.bind, unbind: eventMod.unbind, mouseMoveUp: eventMod.mouseMoveUp,
        bindTouch: eventMod.bindTouch, createEventEmitter: eventMod.createEventEmitter,
        Resizer, Scrollbar, Selector, Editor, Print, ContextMenu, Table, Toolbar,
        ModalValidation, SortFilter, xtoast: messageMod.xtoast, clearToasts: messageMod.clearToasts,
        cssPrefix: 'x-spreadsheet', formulas
    });
    const Spreadsheet = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/index.js', {
        h, DataProxy, Sheet, Bottombar, cssPrefix: 'x-spreadsheet', locale
    });

    return {
        Spreadsheet, Sheet, Toolbar, DataProxy, ContextMenu, ColorPalette, DropdownAlign,
        DropdownFont, DropdownFontSize, DropdownFormula, Scrollbar, messageMod, tooltipMod,
        Editor, Datepicker, FormField, ModalValidation, h
    };
}

test('all 8 previously uncovered UI components and all 21 toolbar modules operate safely', async () => {
    const { mockDocument, mockWindow, windowListeners } = createDomMocks();
    const origCreate = mockDocument.createElement.bind(mockDocument);
    mockDocument.createElement = (tag) => {
        const el = origCreate(tag);
        if (tag === 'canvas') {
            el.getContext = () => ({
                scale: () => {},
                save: () => {},
                restore: () => {},
                beginPath: () => {},
                rect: () => {},
                clip: () => {},
                fill: () => {},
                translate: () => {},
                clearRect: () => {},
                fillRect: () => {},
                fillText: () => {},
                moveTo: () => {},
                lineTo: () => {},
                stroke: () => {},
                setLineDash: () => {},
                measureText: () => ({ width: 20 })
            });
        }
        return el;
    };

    await runWithDomGlobals({ document: mockDocument, window: mockWindow, getComputedStyle: mockWindow.getComputedStyle }, async () => {
        const ui = buildFullUiModules();

        // ColorPalette
        const cp = new ui.ColorPalette();
        let pickedColor = null;
        cp.change = c => { pickedColor = c; };
        const tdCell = cp.el.el.querySelector('td');
        tdCell.children[0].dispatchEvent({ type: 'click', stopPropagation: () => {} });
        assert.ok(pickedColor && pickedColor.startsWith('#'));

        // ContextMenu clamping & mode toggle
        const cm = new ui.ContextMenu(() => ({ width: 200, height: 200 }), false);
        cm.setMode('row-col');
        cm.setPosition(190, 150);
        assert.equal(cm.el.css('left'), '0px');
        cm.hide();

        // DropdownAlign / DropdownFont / DropdownFontSize / DropdownFormula
        const da = new ui.DropdownAlign(['left', 'center', 'right'], 'left');
        let alignChanged = null;
        da.change = v => { alignChanged = v; };
        da.contentEl.el.children[1].dispatchEvent({ type: 'click' });
        assert.equal(alignChanged, 'center');

        const df = new ui.DropdownFont();
        let fontChanged = null;
        df.change = v => { fontChanged = v; };
        df.contentEl.el.children[1].dispatchEvent({ type: 'click' });
        assert.equal(fontChanged.key, 'Helvetica');

        const dfs = new ui.DropdownFontSize();
        let sizeChanged = null;
        dfs.change = v => { sizeChanged = v; };
        dfs.contentEl.el.children[0].dispatchEvent({ type: 'click' });
        assert.equal(sizeChanged.pt, 7.5);

        const dfm = new ui.DropdownFormula();
        let formulaChanged = null;
        dfm.change = v => { formulaChanged = v; };
        dfm.contentEl.el.children[0].dispatchEvent({ type: 'click' });
        assert.equal(formulaChanged.key, 'SUM');

        // Scrollbar silent vs normal move & clamp (suppresses async scroll at expected pos)
        const sb = new ui.Scrollbar(true);
        let movedDist = null;
        sb.moveFn = d => { movedDist = d; };
        sb.set(10, 100);
        assert.equal(sb.el.css('height'), '0px');
        sb.move({ top: 40 }, true);
        sb.el.el.dispatchEvent({ type: 'scroll', target: sb.el.el, stopPropagation: () => {} });
        assert.equal(movedDist, null);
        sb.move({ top: 55 }, false);
        sb.el.el.dispatchEvent({ type: 'scroll', target: sb.el.el, stopPropagation: () => {} });
        assert.equal(movedDist, 55);

        // xtoast XSS-safe textContent + dimmer cleanup on Esc
        ui.messageMod.xtoast('Alert', '<img src=x onerror=1>');
        const toastEl = mockDocument.body.children[0];
        assert.equal(toastEl.children[1].textContent, '<img src=x onerror=1>');
        assert.equal(mockDocument.body.children.length, 2);
        mockWindow.dispatchEvent({ type: 'keydown', keyCode: 27 });
        assert.equal(mockDocument.body.children.length, 0);

        // Real Toolbar instantiating all 21 toolbar items + XSS-safe Dropdown.setTitle + timer flush + disabled guard
        const dp = new ui.DataProxy('T1', { mode: 'edit', showToolbar: true });
        dp.styles = [{ font: { name: '<img src=x>', size: 12 } }];
        dp.setCellText(0, 0, 'hi', 'finished');
        dp.getCell(0, 0).style = 0;
        const tbChanges = [];
        const tb = new ui.Toolbar(dp, () => 400, false);
        tb.change = (k, v) => tbChanges.push({ k, v });
        assert.equal(tb.fontEl.dd.title.el.textContent, '<img src=x>');
        assert.equal(tb.fontEl.dd.title.el.innerHTML, '');
        tb.mergeEl.el.el.click(); // disabled on single cell -> ignored
        assert.equal(tbChanges.length, 0);
        tb.undoEl.el.el.click(); // enabled after setCellText
        assert.equal(tbChanges[0].k, 'undo');
        tb.boldEl.el.el.click();
        assert.equal(tbChanges[1].k, 'font-bold');
        await new Promise(r => setTimeout(r, 10));
        assert.ok(Array.isArray(tb.btns2));
        tb.destroy();
        assert.equal(windowListeners.get('resize')?.size || 0, 0);

        // Datepicker invalid date fallback & FormField visible tip
        const dpck = new ui.Datepicker();
        dpck.setValue('2024-99-99');
        assert.equal(Number.isNaN(dpck.calendar.value.getTime()), false);
        const FormInput = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/form_input.js', {
            h: ui.h, cssPrefix: 'x-spreadsheet'
        });
        const ff = new ui.FormField(new FormInput('80px', ''), { required: true });
        assert.equal(ff.validate(), false);
        assert.equal(ff.tip.css('display'), 'block');
    });
});

test('real Spreadsheet and Sheet lifecycle covers addSheet, loadData([]), edit/read guards, and full listener cleanup', async () => {
    const { mockDocument, mockWindow, windowListeners } = createDomMocks();
    const origCreate = mockDocument.createElement.bind(mockDocument);
    mockDocument.createElement = (tag) => {
        const el = origCreate(tag);
        if (tag === 'canvas') {
            el.getContext = () => ({
                scale: () => {},
                save: () => {},
                restore: () => {},
                beginPath: () => {},
                rect: () => {},
                clip: () => {},
                fill: () => {},
                translate: () => {},
                clearRect: () => {},
                fillRect: () => {},
                fillText: () => {},
                moveTo: () => {},
                lineTo: () => {},
                stroke: () => {},
                setLineDash: () => {},
                measureText: () => ({ width: 20 })
            });
        }
        return el;
    };

    await runWithDomGlobals({ document: mockDocument, window: mockWindow, getComputedStyle: mockWindow.getComputedStyle }, () => {
        const ui = buildFullUiModules();
        const host = mockDocument.createElement('div');
        const xs = new ui.Spreadsheet(host, {
            showToolbar: true,
            showBottomBar: true,
            mode: 'edit',
            view: { width: () => 800, height: () => 600 }
        });
        assert.equal(host.children.length, 1);

        xs.addSheet('S2', true);
        assert.equal(xs.data.name, 'S2');
        xs.cellText(0, 0, 'val', 1);
        assert.equal(xs.cell(0, 0, 1).text, 'val');
        assert.equal(xs.getData().length, 2);

        // No-op editor open/close does not push phantom undo snapshot
        const undoLenBefore = xs.data.history.undoItems.length;
        xs.sheet.editor.setCell(xs.cell(0, 0, 1));
        xs.sheet.editor.clear();
        assert.equal(xs.data.history.undoItems.length, undoLenBefore);

        // Scroll round-trip via resetData does not advance scrollTop/scrollLeft
        xs.data.scroll.ri = 1;
        xs.data.scroll.y = 25;
        xs.data.scroll.ci = 1;
        xs.data.scroll.x = 100;
        let scrollMoves = 0;
        xs.sheet.verticalScrollbar.moveFn = () => { scrollMoves++; };
        xs.sheet.resetData(xs.data);
        sbAsyncCheck: {
          xs.sheet.verticalScrollbar.el.el.dispatchEvent({
            type: 'scroll',
            target: xs.sheet.verticalScrollbar.el.el,
            stopPropagation: () => {}
          });
          assert.equal(scrollMoves, 0);
          break sbAsyncCheck;
        }

        xs.loadData([]);
        assert.equal(xs.data.name, 'sheet1');
        assert.equal(xs.getData().length, 1);
        assert.equal(xs.sheet.data.name, 'sheet1');

        xs.destroy();
        assert.equal(host.children.length, 0);
        assert.equal(windowListeners.get('resize')?.size || 0, 0);
        assert.equal(windowListeners.get('click')?.size || 0, 0);
        assert.equal(windowListeners.get('paste')?.size || 0, 0);
        assert.equal(windowListeners.get('copy')?.size || 0, 0);
        assert.equal(windowListeners.get('keydown')?.size || 0, 0);
    });
});
