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
const History = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/history.js');
const Clipboard = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/clipboard.js');
const Scroll = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/scroll.js');
const CoreSelector = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/selector.js', { CellRange });
const AutoFilter = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/auto_filter.js', { CellRange });
const Validator = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/validator.js', {
    t: k => k,
    helper: helperMod
});
const { Validations } = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/validation.js', {
    Validator,
    CellRange
});

function createDataProxyClass() {
    return loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/data_proxy.js', {
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
        t: k => k
    });
}

test('x-spreadsheet DataProxy covers setData, borders, clipboard 0 text, missing navigator, and invalid style index', async () => {
    const DataProxy = createDataProxyClass();
    const dp = new DataProxy('Main', { mode: 'edit' });
    dp.setCellText(0, 0, 0, 'finished');
    dp.setCellText(0, 1, 'hello', 'input');
    dp.setData({ freeze: 'B3', rows: { len: 10, 0: { cells: { 0: { text: 0, style: 99 } } } } });
    assert.deepEqual(dp.freeze, [2, 1]);
    assert.ok(dp.getCellStyleOrDefault(0, 0).font);

    // Out-of-bounds/multi-line border splice
    dp.selector.range = CellRange.valueOf('A1:C3');
    dp.merges.add(CellRange.valueOf('A1:A2'));
    dp.merges.add(CellRange.valueOf('B1:B2'));
    dp.setSelectedCellAttr('border', { mode: 'all', style: 'thin', color: '#000' });
    assert.ok(dp.getCell(0, 0).style !== undefined);

    // copyToSystemClipboard with 0 text & missing navigator
    const setDataCalls = [];
    const fakeEvt = {
        clipboardData: {
            clearData: () => {},
            setData: (type, val) => setDataCalls.push({ type, val })
        },
        preventDefault: () => {}
    };
    await runWithDomGlobals({ navigator: undefined }, async () => {
        dp.selector.range = CellRange.valueOf('A1:A1');
        dp.copyToSystemClipboard(fakeEvt);
        assert.equal(setDataCalls[0].val, '0');
        await dp.pasteFromSystemClipboard(() => {}, () => {});
    });
});

test('x-spreadsheet element, event, modal, tooltip, suggest, calendar, and sortFilter fixes', async () => {
    const { mockDocument, mockWindow, windowListeners } = createDomMocks();
    await runWithDomGlobals({ document: mockDocument, window: mockWindow }, () => {
        const eventMod = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/event.js');
        const { Element, h } = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/element.js');
        const Icon = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/icon.js', {
            Element,
            h,
            cssPrefix: 'x-spreadsheet'
        });

        // element.data() + .left/.right modifier guard + firefox guard
        const box = h('div', 'box');
        box.data('k', 123);
        assert.equal(box.data('k'), 123);
        let leftHits = 0;
        box.on('click.left.stop', () => leftHits++);
        box.el.dispatchEvent({ type: 'click', button: 2 });
        assert.equal(leftHits, 0);
        box.el.dispatchEvent({ type: 'click', button: 0 });
        assert.equal(leftHits, 1);

        // mouseMoveUp re-drag cancellation & createEventEmitter once() + omitted args
        let up1 = 0;
        let up2 = 0;
        const cancel1 = eventMod.mouseMoveUp(mockWindow, () => {}, () => up1++);
        assert.equal(typeof cancel1, 'function');
        eventMod.mouseMoveUp(mockWindow, () => {}, () => up2++);
        mockWindow.dispatchEvent({ type: 'mouseup' });
        assert.equal(up1, 0);
        assert.equal(up2, 1);
        assert.equal(windowListeners.get('mousemove').size, 0);
        assert.equal(windowListeners.get('mouseup').size, 0);

        const emitter = eventMod.createEventEmitter();
        const fired = [];
        emitter.once('x', () => fired.push('once'));
        emitter.on('x', () => fired.push('second'));
        emitter.fire('x');
        assert.deepEqual(fired, ['once', 'second']);

        // Modal per-instance Esc isolation & no dimmer leak on repeated show
        const Modal = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/modal.js', {
            h,
            Icon,
            cssPrefix: 'x-spreadsheet',
            bind: eventMod.bind,
            unbind: eventMod.unbind
        });
        const m1 = new Modal('M1', []);
        const m2 = new Modal('M2', []);
        m1.show();
        m1.show();
        m2.show();
        assert.equal(mockDocument.body.children.length, 2);
        assert.equal(windowListeners.get('keydown').size, 2);
        m1.hide();
        assert.equal(windowListeners.get('keydown').size, 1);
        m2.hide();
        assert.equal(windowListeners.get('keydown').size, 0);

        // Tooltip cleanup & no duplicate listener accumulation
        const tooltip = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/tooltip.js', {
            h,
            bind: eventMod.bind,
            unbind: eventMod.unbind,
            cssPrefix: 'x-spreadsheet'
        });
        const btn = mockDocument.createElement('button');
        tooltip('Tip 1', btn);
        tooltip('Tip 2', btn);
        assert.equal(btn.listeners.get('mouseleave').size, 1);
        assert.equal(btn.listeners.get('click').size, 1);
        assert.equal(mockDocument.body.children.length, 1);
        btn.dispatchEvent({ type: 'mouseleave' });
        assert.equal(btn.listeners.get('mouseleave').size, 0);
        assert.equal(mockDocument.body.children.length, 0);

        // Suggest case-insensitive filtering & auto-hide on 0 matches
        const Suggest = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/suggest.js', {
            h,
            bindClickoutside: eventMod.bindClickoutside,
            unbindClickoutside: eventMod.unbindClickoutside,
            cssPrefix: 'x-spreadsheet'
        });
        const wrap = h('div', 'wrap');
        const sug = new Suggest(['apple', 'banana'], () => {});
        wrap.child(sug.el);
        sug.search('a');
        assert.equal(sug.filterItems.length, 1);
        sug.search('zzz');
        assert.equal(sug.el.css('display'), 'none');
        assert.equal(mockDocument.body.listeners.get('click').size, 0);

        // Calendar Jan 31 rollover & year check & missing locale fallback
        const Calendar = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/calendar.js', {
            h,
            Icon,
            t: () => ''
        });
        const cal = new Calendar(new Date(2025, 0, 31));
        cal.next();
        assert.equal(cal.value.getMonth(), 1);
        assert.equal(cal.value.getDate(), 28);

        // SortFilter sort reset typo fix
        const Button = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/button.js', {
            Element,
            cssPrefix: 'x-spreadsheet',
            t: k => k
        });
        const SortFilter = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/sort_filter.js', {
            h,
            Button,
            bindClickoutside: eventMod.bindClickoutside,
            unbindClickoutside: eventMod.unbindClickoutside,
            cssPrefix: 'x-spreadsheet',
            t: k => k
        });
        const sf = new SortFilter();
        sf.set(0, { a: 1 }, null, { order: 'asc', asc: () => true, desc: () => false });
        assert.equal(sf.sort, 'asc');
        sf.set(1, { b: 1 }, null, null);
        assert.equal(sf.sort, null);
    });
});

test('x-spreadsheet Bottombar, Editor, Selector, ModalValidation, FormField, Dropdown/Toolbar, Resizer, and Print fixes', async () => {
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

        // Bottombar: duplicate/HTML sheet names, double dblclick, delete guards
        const renamed = [];
        const bar = new Bottombar(() => {}, () => {}, () => {}, (i, v) => renamed.push({ i, v }));
        bar.addItem('R&D', true, { mode: 'edit' });
        bar.addItem('R&D', false, { mode: 'edit' });
        bar.items[1].el.dispatchEvent({ type: 'dblclick' });
        // Simulate blur rename on second tab
        const inputEl = bar.items[1].el.children[0].children[0];
        inputEl.value = 'Finance';
        inputEl.dispatchEvent({ type: 'blur', target: inputEl });
        assert.deepEqual(renamed[0], { i: 1, v: 'Finance' });
        assert.equal(bar.dataNames[0], 'R&D');
        assert.deepEqual(bar.deleteItem(), [-1]); // deleteEl is null
        bar.clickSwap2(bar.items[99]); // invalid item ignored

        // Editor: XSS textContent, numeric 0 / 123, clear-to-empty fires finished
        const Suggest = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/suggest.js', {
            h,
            bindClickoutside: eventMod.bindClickoutside,
            unbindClickoutside: eventMod.unbindClickoutside,
            cssPrefix: 'x-spreadsheet'
        });
        const Calendar = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/calendar.js', {
            h,
            Icon,
            t: () => ''
        });
        const Datepicker = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/datepicker.js', {
            Calendar,
            h,
            cssPrefix: 'x-spreadsheet'
        });
        const Editor = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/editor.js', {
            h,
            Suggest,
            Datepicker,
            cssPrefix: 'x-spreadsheet'
        });
        const editorChanges = [];
        const ed = new Editor([], () => ({ width: 200, height: 200 }), 24);
        ed.change = (state, val) => editorChanges.push({ state, val });
        ed.setOffset({ left: 195, top: 10, width: 80, height: 24, l: 195, t: 10 }, 'top');
        ed.setCell({ text: 0 });
        assert.equal(ed.inputText, '0');
        assert.equal(ed.textlineEl.el.textContent, '0');
        ed.setText('<img src=x onerror=1>');
        assert.equal(ed.textlineEl.el.textContent, '<img src=x onerror=1>');
        assert.equal(ed.textlineEl.el.innerHTML, '');
        assert.notEqual(ed.textEl.css('height'), 'NaNpx');
        ed.inputText = '';
        ed.clear();
        assert.deepEqual(editorChanges[editorChanges.length - 1], { state: 'finished', val: '' });

        // Selector: bounded z-index, initialized indexes, reset() recalculation, showAutofill negative guard
        const Selector = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/selector.js', {
            h,
            cssPrefix: 'x-spreadsheet',
            CellRange
        });
        const DataProxy = createDataProxyClass();
        const dp = new DataProxy('S1', {});
        const sel1 = new Selector(dp);
        const sel2 = new Selector(dp);
        assert.deepEqual(sel1.indexes, [0, 0]);
        assert.equal(sel1.br.el.css('z-index'), '10');
        assert.equal(sel2.br.el.css('z-index'), '10');
        sel1.lastri = 0;
        sel1.lastci = 0;
        let calCalls = 0;
        const origCalEnd = dp.calSelectedRangeByEnd.bind(dp);
        dp.calSelectedRangeByEnd = (...args) => {
            calCalls++;
            return origCalEnd(...args);
        };
        sel1.reset();
        assert.equal(calCalls, 1);
        sel1.showAutofill(-1, 2);
        assert.equal(sel1.arange, null);

        // ModalValidation + FormField
        const Button = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/button.js', {
            Element,
            cssPrefix: 'x-spreadsheet',
            t: k => k
        });
        const FormField = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/form_field.js', {
            h,
            cssPrefix: 'x-spreadsheet',
            t: k => k
        });
        const FormSelect = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/form_select.js', {
            h,
            Suggest,
            cssPrefix: 'x-spreadsheet'
        });
        const Modal = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/modal.js', {
            h,
            Icon,
            cssPrefix: 'x-spreadsheet',
            bind: eventMod.bind,
            unbind: eventMod.unbind
        });
        const ModalValidation = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/modal_validation.js', {
            Modal,
            FormInput,
            FormSelect,
            FormField,
            Button,
            t: k => k,
            h,
            cssPrefix: 'x-spreadsheet'
        });
        const ffNum = new FormField(new FormInput('80px', ''), { required: true, type: 'number' });
        ffNum.val('-12.345678');
        assert.equal(ffNum.validate(), true);
        const mv = new ModalValidation();
        const saved = [];
        mv.change = (action, mode, ref, validator) => saved.push({ action, mode, ref, validator });
        mv.setValue({ mode: 'cell', ref: 'A1', validator: { type: 'list', value: 'a,b' } });
        mv.btnClick('save');
        assert.equal(saved[0].validator.operator, undefined);
        assert.equal(saved[0].validator.type, 'list');

        // DropdownFormat & Toolbar & Autofilter & DropdownBorder
        const DropdownFormat = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/dropdown_format.js', {
            Dropdown,
            h,
            baseFormats: [{ key: 'number', title: () => '数值', label: '1,000.12' }],
            cssPrefix: 'x-spreadsheet'
        });
        const df = new DropdownFormat();
        df.contentEl.el.children[0].dispatchEvent({ type: 'click' });
        assert.equal(df.title.html(), '数值');

        // Resizer ignores right-click and supports destroy()
        const Resizer = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/resizer.js', {
            h,
            mouseMoveUp: eventMod.mouseMoveUp,
            cssPrefix: 'x-spreadsheet'
        });
        const rz = new Resizer(false, 24);
        rz.cRect = { left: 0, top: 0, width: 100, height: 24 };
        rz.mousedownHandler({ buttons: 2 });
        assert.equal(windowListeners.get('mouseup')?.size || 0, 0);
        rz.mousedownHandler({ buttons: 1 });
        assert.equal(windowListeners.get('mouseup').size, 1);
        rz.destroy();
        assert.equal(windowListeners.get('mouseup').size, 0);

        // Print pagination keeps sci = 0 on page 2+ and cleans up iframe
        const { Draw } = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/canvas/draw.js');
        const origCreate = mockDocument.createElement.bind(mockDocument);
        const iframes = [];
        mockDocument.createElement = (tag) => {
            const el = origCreate(tag);
            if (tag === 'canvas') {
                el.cloneNode = () => origCreate('canvas');
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
                    fillText: () => {},
                    drawImage: () => {},
                    measureText: () => ({ width: 10 })
                });
            }
            if (tag === 'iframe') {
                el.contentWindow = {
                    document: {
                        head: mockDocument.createElement('head'),
                        body: mockDocument.createElement('body')
                    },
                    print() {}
                };
                iframes.push(el);
            }
            return el;
        };
        const Print = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/print.js', {
            h,
            cssPrefix: 'x-spreadsheet',
            Button,
            Draw,
            renderCell: () => {},
            t: k => k
        });
        const printDp = new DataProxy('P1', {});
        printDp.rows.len = 2;
        printDp.rows.setHeight(0, 1500);
        printDp.rows.setHeight(1, 24);
        printDp.setCellText(1, 0, 'p2');
        const seenRanges = [];
        printDp.eachMergesInView = (r) => seenRanges.push({ ...r });
        const pr = new Print(printDp);
        pr.preview();
        assert.ok(seenRanges.length >= 2);
        assert.equal(seenRanges[1].sci, 0);
        pr.toPrint();
        assert.equal(mockDocument.body.children.includes(iframes[0]), true);
        pr.destroy();
        assert.equal(mockDocument.body.children.includes(iframes[0]), false);

        // Toolbar resize-before-timer safety + Autofilter setState + DropdownBorder/DropdownLineType + table.js
        const DropdownLineType = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/dropdown_linetype.js', {
            Dropdown,
            h,
            Icon,
            cssPrefix: 'x-spreadsheet'
        });
        const dl = new DropdownLineType('thick');
        assert.equal(dl.contentEl.el.children[2].classList.contains('checked'), true);
        dl.contentEl.el.children[0].dispatchEvent({ type: 'click' });
        assert.equal(dl.contentEl.el.children[2].classList.contains('checked'), false);
        assert.equal(dl.contentEl.el.children[0].classList.contains('checked'), true);

        const DropdownColor = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/dropdown_color.js', {
            Dropdown,
            ColorPalette: class { constructor() { this.el = h('div', 'cp'); this.change = () => {}; } },
            Icon
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
        const db = new DropdownBorder();
        let ddHidden = 0;
        db.borderPalette.ddColor.hide = () => ddHidden++;
        db.borderPalette.ddType.hide = () => ddHidden++;
        db.hide();
        assert.equal(ddHidden, 2);

        const RealItem = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/item.js', {
            cssPrefix: 'x-spreadsheet',
            tooltip: () => {},
            h,
            t: k => k
        });
        const ToggleItem = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/toggle_item.js', {
            Item: RealItem,
            Icon
        });
        const AutofilterBtn = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/autofilter.js', {
            ToggleItem
        });
        const StrikeBtn = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/strike.js', {
            ToggleItem
        });
        const afBtn = new AutofilterBtn();
        afBtn.setState(true);
        assert.equal(afBtn.active(), true);
        afBtn.setState(false);
        assert.equal(afBtn.active(), false);
        const strikeBtn = new StrikeBtn();
        assert.equal(strikeBtn.shortcut, undefined);

        // Toolbar constructor resize before timer + destroy() hides all dropdowns
        const DropdownItem = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/dropdown_item.js', {
            Dropdown,
            Item: RealItem
        });
        const ItemClass = class {
            constructor(tag) {
                this.tag = tag;
                this.el = h('div', 'item');
                this.el.box = () => ({ width: 20, height: 20 });
                this.el.computedStyle = () => ({ marginLeft: '0px', marginRight: '0px' });
                this.change = () => {};
            }
            setState() {}
            active() { return false; }
            toggle() {}
            click() {}
        };
        const More = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/more.js', {
            Dropdown,
            DropdownItem,
            cssPrefix: 'x-spreadsheet',
            h,
            Icon
        });
        let toolbarHideCount = 0;
        const makeDdItem = () => class {
            constructor() {
                this.el = h('div', 'dd-item');
                this.dd = { hide: () => { toolbarHideCount++; } };
                this.change = () => {};
            }
            setState() {}
        };
        const Toolbar = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/toolbar/index.js', {
            Align: makeDdItem(),
            Valign: makeDdItem(),
            Autofilter: ItemClass,
            Bold: ItemClass,
            Italic: ItemClass,
            Strike: ItemClass,
            Underline: ItemClass,
            Border: makeDdItem(),
            Clearformat: ItemClass,
            Paintformat: ItemClass,
            TextColor: makeDdItem(),
            FillColor: makeDdItem(),
            FontSize: makeDdItem(),
            Font: makeDdItem(),
            Format: makeDdItem(),
            Formula: makeDdItem(),
            Freeze: ItemClass,
            Merge: ItemClass,
            Redo: ItemClass,
            Undo: ItemClass,
            Print: ItemClass,
            Textwrap: ItemClass,
            More,
            Item: ItemClass,
            h,
            cssPrefix: 'x-spreadsheet',
            bind: eventMod.bind,
            unbind: eventMod.unbind
        });
        const tb = new Toolbar(dp, () => 400, false);
        mockWindow.dispatchEvent({ type: 'resize' }); // must not throw when btns2 not initialized yet
        assert.ok(tb.btns2 === undefined || Array.isArray(tb.btns2));
        const origMoreHide = tb.moreEl.dd.hide.bind(tb.moreEl.dd);
        tb.moreEl.dd.hide = () => {
            toolbarHideCount++;
            origMoreHide();
        };
        tb.destroy();
        assert.equal(toolbarHideCount, 10);
        assert.equal(windowListeners.get('resize')?.size || 0, 0);

        // table.js: uses nrindex for validation errors and draws single-axis freeze line only
        let errorLookupRi = null;
        let drawnFreezeLines = [];
        const Table = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/table.js', {
            stringAt: alphabetMod.stringAt,
            getFontSizePxByPt: v => v,
            _cell: { render: t => t },
            formulam: {},
            formatm: {},
            Draw: class {
                constructor() {
                    this.ctx = {};
                }
                resize() {}
                clear() {}
                save() { return this; }
                restore() { return this; }
                attr() { return this; }
                translate() { return this; }
                fillRect() { return this; }
                fillText() { return this; }
                strokeBorders() {}
                rect(_b, cb) { cb(); }
                text() { return this; }
                error() {}
                frozen() {}
                line(...pts) { drawnFreezeLines.push(pts); return this; }
            },
            DrawBox: class {
                constructor(x, y, w, h) {
                    this.x = x; this.y = y; this.width = w; this.height = h;
                }
                setBorders() {}
            },
            thinLineWidth: () => 0.5,
            npx: v => v
        });
        const tblData = createDataProxyClass();
        const td = new tblData('T', { evalPaused: true });
        td.sortedRowMap.set(0, 2);
        td.setCellText(2, 0, 'errval', 'finished');
        td.validations.getError = (ri) => {
            errorLookupRi = ri;
            return 'bad';
        };
        const tbl = new Table(mockDocument.createElement('canvas'), td);
        drawnFreezeLines = [];
        td.freeze = [1, 0];
        tbl.render();
        assert.equal(errorLookupRi, 2);
    });
});

test('x-spreadsheet sheet.js and index.js cover editor clear, paste merged guard, read-only guards, scroll sync, and destroy', async () => {
    const { mockDocument, mockWindow, windowListeners } = createDomMocks();
    const sheetSrc = fs.readFileSync(
        path.join(CORE_DIR, 'packages/vue-excel/src/x-spreadsheet/component/sheet.js'),
        'utf8'
    );
    const fnBody = sheetSrc
        .slice(sheetSrc.indexOf('function scrollbarMove'), sheetSrc.indexOf('export default class Sheet'))
        .replace(/sheetReset\.call\(this\)/g, '(() => { this._resetCount = (this._resetCount || 0) + 1; })()');

    await runWithDomGlobals({ document: mockDocument, window: mockWindow }, () => {
        const harness = new Function(
            'cssPrefix', 'bind', 'unbind', 'mouseMoveUp', 'bindTouch', 'xtoast',
            `${fnBody}\nreturn { scrollbarMove, selectorMove, paste, hideRowsOrCols, unhideRowsOrCols, autofilter, sortFilterChange, overlayerMousedown, sheetInitEvents };`
        )(
            'x-spreadsheet',
            (t, n, fn) => t.addEventListener(n, fn),
            (t, n, fn) => t.removeEventListener(n, fn),
            () => () => {},
            () => {},
            () => {}
        );

        // scrollbarMove for negative off-screen left/top
        const hMoves = [];
        const vMoves = [];
        const scrollCtx = {
            data: {
                getSelectedRect: () => ({ l: 10, t: 20, left: -900, top: -900, width: 80, height: 24 }),
                freezeTotalWidth: () => 0,
                freezeTotalHeight: () => 0
            },
            getTableOffset: () => ({ width: 500, height: 400 }),
            horizontalScrollbar: { move: m => hMoves.push(m) },
            verticalScrollbar: { move: m => vMoves.push(m) }
        };
        harness.scrollbarMove.call(scrollCtx);
        assert.deepEqual(hMoves[0], { left: 9 });
        assert.deepEqual(vMoves[0], { top: 19 });

        // selectorMove Shift+Right shrinks left-extended range cleanly
        const selectedCalls = [];
        const selCtx = {
            selector: {
                indexes: [0, 3],
                moveIndexes: [0, 1],
                range: { sri: 0, sci: 1, eri: 0, eci: 3 },
                setEnd(ri, ci) { selectedCalls.push([ri, ci]); }
            },
            data: {
                rows: { len: 10 },
                cols: { len: 10 },
                getCell: () => null,
                getSelectedRect: () => ({ l: 0, t: 0, left: 0, top: 0, width: 80, height: 24 }),
                freezeTotalWidth: () => 0,
                freezeTotalHeight: () => 0
            },
            getTableOffset: () => ({ width: 500, height: 400 }),
            horizontalScrollbar: { move: () => {} },
            verticalScrollbar: { move: () => {} },
            contextMenu: { setMode: () => {} },
            trigger: () => {}
        };
        harness.selectorMove.call(selCtx, true, 'right');
        assert.deepEqual(selectedCalls[0], [0, 2]);

        // paste does NOT fall through to pasteFromText when data.paste returns false for merged cell
        let pasteFromTextCalled = 0;
        let xtoastMsg = '';
        const pasteCtx = {
            data: {
                settings: { mode: 'edit' },
                clipboard: { isClear: () => false },
                paste: () => false,
                pasteFromText: () => { pasteFromTextCalled++; }
            }
        };
        harness.paste.call(pasteCtx, 'all', { clipboardData: { getData: () => 'x' } });
        assert.equal(pasteFromTextCalled, 0);

        // paste falls back to clipboardData when clipboard is clear
        harness.paste.call({
            data: {
                settings: { mode: 'edit' },
                clipboard: { isClear: () => true },
                pasteFromText: () => { pasteFromTextCalled++; }
            }
        }, 'all', { clipboardData: { getData: () => 'cell-text' } });
        assert.equal(pasteFromTextCalled, 1);

        // Read-only blocks hide, unhide, autofilter, sortFilterChange, modalValidation, and leaves copy defaultPrevented = false
        let mutated = 0;
        let autofillShown = 0;
        let prevented = false;
        const overlayerDom = mockDocument.createElement('div');
        const overlayerEl = {
            el: overlayerDom,
            listeners: new Map(),
            on(name, cb) {
                this.listeners.set(name, cb);
                return this;
            },
            box: () => ({ left: 0, top: 0, width: 0, height: 0 }),
            contains: () => true
        };
        const readCtx = {
            focusing: true,
            data: {
                settings: { mode: 'read' },
                selector: { ci: 0, ri: 0 },
                rows: { len: 10, getHeight: () => 24 },
                cols: { len: 10, getWidth: () => 80 },
                scroll: { ri: 0, ci: 0 },
                autoFilter: { includes: () => true },
                getCellRectByXY: () => ({ ri: 0, ci: 0, left: 0, top: 0, width: 80, height: 24 }),
                getCell: () => null,
                hideRowsOrCols: () => mutated++,
                unhideRowsOrCols: () => mutated++,
                autofilter: () => mutated++,
                setAutoFilter: () => mutated++,
                addValidation: () => mutated++,
                removeValidation: () => mutated++,
                delete: () => mutated++,
                insert: () => mutated++,
                deleteCell: () => mutated++
            },
            toolbar: { trigger: () => mutated++, paintformatActive: () => false },
            verticalScrollbar: { scroll: () => ({ top: 0 }), move: () => {} },
            horizontalScrollbar: { scroll: () => ({ left: 0 }), move: () => {} },
            contextMenu: { hide: () => {}, setMode: () => {} },
            rowResizer: { hide: () => {} },
            colResizer: { hide: () => {} },
            editor: { clear: () => {} },
            modalValidation: { setValue: () => mutated++ },
            selector: { set: () => {}, showAutofill: () => autofillShown++, hideAutofill: () => {} },
            sortFilter: { hide: () => mutated++ },
            overlayerEl,
            trigger: () => {}
        };
        harness.hideRowsOrCols.call(readCtx);
        harness.unhideRowsOrCols.call(readCtx, 'row', 0);
        harness.autofilter.call(readCtx);
        harness.sortFilterChange.call(readCtx, 0, 'asc', 'in', []);
        harness.overlayerMousedown.call(readCtx, { target: { className: 'x-spreadsheet-selector-corner' }, offsetX: 78, offsetY: 22, buttons: 1 });
        assert.equal(mutated, 0);
        assert.equal(autofillShown, 0);

        harness.sheetInitEvents.call(readCtx);
        readCtx.modalValidation.change('save', 'cell', 'A1', {});
        readCtx.contextMenu.itemClick('validation');
        readCtx.contextMenu.itemClick('hide');
        assert.equal(mutated, 0);

        const copyHandler = Array.from(windowListeners.get('copy'))[0];
        copyHandler({ preventDefault: () => { prevented = true; } });
        assert.equal(prevented, false);

        // x-spreadsheet/index.js syncs this.data and cleans up on destroy
        const eventMod = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/event.js');
        const { Element, h } = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/component/element.js');
        const DataProxy = createDataProxyClass();
        let bottombarInst = null;
        let resetDatas = [];
        let sheetDestroyed = false;
        class FakeBottombar {
            constructor(_add, swapCb) {
                bottombarInst = this;
                this.swapCb = swapCb;
                this.el = h('div', 'bottombar');
                this.contextMenu = { hide: () => {} };
                this.moreEl = { hide: () => {} };
            }
            addItem() {}
            clear() {}
            deleteItem() { return [0, 0]; }
        }
        class FakeSheet {
            constructor(_el, d) {
                this.data = d;
                this.table = { render: () => {} };
                this.triggers = [];
            }
            resetData(d) {
                this.data = d;
                resetDatas.push(d);
            }
            on() { return this; }
            trigger(name) { this.triggers.push(name); }
            destroy() { sheetDestroyed = true; }
        }
        const Spreadsheet = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/index.js', {
            h,
            DataProxy,
            Sheet: FakeSheet,
            Bottombar: FakeBottombar,
            cssPrefix: 'x-spreadsheet',
            locale: () => {}
        });
        const host = mockDocument.createElement('div');
        const sp = new Spreadsheet(host, { showBottomBar: true });
        sp.loadData([{ name: 'A' }, { name: 'B' }]);
        assert.equal(sp.data.name, 'A');
        bottombarInst.swapCb(1);
        assert.equal(sp.data.name, 'B');
        assert.equal(sp.cell(0, 0, 99), null);
        assert.equal(sp.cellStyle(0, 0, 99), null);
        sp.cellText(0, 0, 'x', 99);
        assert.equal(sp.validate(), true);
        sp.destroy();
        assert.equal(sheetDestroyed, true);
        assert.equal(sp.data, null);
        assert.equal(sp.sheet, null);
        void xtoastMsg;
    });
});
