import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createCanvasContextMock,
    createDomMocks,
    loadXSpreadsheetStack,
    runWithDomGlobals
} from './helpers/load-module.mjs';

test('Editor, Suggest, Datepicker, Calendar, and Bottombar cover all regression fixes and edge branches', async () => {
    const { mockDocument, mockWindow } = createDomMocks();
    await runWithDomGlobals({
        document: mockDocument,
        window: mockWindow,
        getComputedStyle: mockWindow.getComputedStyle
    }, () => {
        const {
            Editor, Suggest, Datepicker, Calendar, Bottombar, Validator, formulas, h
        } = loadXSpreadsheetStack();

        // Editor: plain text containing '=' must NOT trigger formula suggest; leading '=' DOES
        const ed = new Editor(formulas, () => ({ width: 600, height: 400 }), 24);
        const edEvents = [];
        ed.change = (state, val) => edEvents.push({ state, val });
        ed.setOffset({ left: 80, top: 300, width: 100, height: 24, l: 80, t: 300 }, 'bottom');
        // Datepicker flips upward when suggestPosition === 'bottom'
        assert.equal(ed.datepicker.el.css('bottom'), '24px');
        assert.equal(ed.datepicker.el.css('top'), 'auto');
        // Narrow cell clamps textarea dimensions >= 0
        ed.setOffset({ left: 0, top: 0, width: 2, height: 1, l: 0, t: 0 }, 'top');
        assert.equal(ed.textEl.css('width'), '0px');
        assert.equal(ed.textEl.css('height'), '0px');

        ed.setCell({ text: 'orig' }, null);
        ed.textEl.el.value = 'status=s';
        ed.textEl.el.dispatchEvent({ type: 'input', target: ed.textEl.el });
        assert.equal(ed.suggest.filterItems.length, 0);
        ed.textEl.el.value = '=su';
        ed.textEl.el.dispatchEvent({ type: 'input', target: ed.textEl.el });
        assert.ok(ed.suggest.filterItems.length >= 1);

        // Alt+Enter inserts newline; Esc cancels; IME keydown is ignored
        ed.textEl.el.value = 'ab';
        ed.textEl.el.setSelectionRange(1, 1);
        ed.textEl.el.dispatchEvent({ type: 'keydown', keyCode: 13, altKey: true, target: ed.textEl.el });
        assert.equal(ed.inputText, 'a\nb');
        ed.textEl.el.dispatchEvent({ type: 'keydown', keyCode: 229, isComposing: true, target: ed.textEl.el });
        ed.textEl.el.dispatchEvent({ type: 'keydown', keyCode: 27, target: ed.textEl.el });
        assert.equal(ed._editing, false);
        assert.equal(ed.validator, null);
        assert.equal(edEvents[edEvents.length - 1].state, 'cancel');

        // Datepicker revert-to-initial-date emits cancel (restoring data, not corrupting it!)
        edEvents.length = 0;
        const dateValidator = new Validator('date', false, '', undefined);
        ed.setCell({ text: '2024-01-01' }, dateValidator);
        ed.textEl.el.value = '2024-01-02';
        ed.textEl.el.dispatchEvent({ type: 'input', target: ed.textEl.el });
        // Pick original date 2024-01-01 from datepicker
        ed.datepicker.calendar.selectChange(new Date(2024, 0, 1));
        assert.ok(edEvents.some(e => e.state === 'input' && e.val === '2024-01-01'));
        assert.equal(edEvents[edEvents.length - 1].state, 'cancel');
        assert.equal(edEvents[edEvents.length - 1].val, '2024-01-01');
        assert.equal(ed.validator, null);

        // Suggest IME guard, non-array items safe, Up wrap, direct shrink from itemIndex=1 -> 1 item
        const sugPicks = [];
        const sug = new Suggest([{ key: 'SUM', title: () => 'SUM', label: 'add' }, { key: 'SUBTOTAL', title: () => 'SUBTOTAL' }], it => sugPicks.push(it.key));
        const inp = h('input', '');
        sug.bindInputEvents(inp);
        sug.search('SU');
        assert.equal(sug.filterItems.length, 2);
        inp.el.dispatchEvent({ type: 'keydown', keyCode: 40 }); // 0
        inp.el.dispatchEvent({ type: 'keydown', keyCode: 40 }); // 1
        assert.equal(sug.itemIndex, 1);
        // IME Enter does NOT pick or prevent default
        let imePrevented = false;
        inp.el.dispatchEvent({ type: 'keydown', keyCode: 13, isComposing: true, preventDefault: () => { imePrevented = true; } });
        assert.equal(imePrevented, false);
        assert.equal(sugPicks.length, 0);
        // Shrink directly to 1-item list while itemIndex was 1
        sug.search('SUM');
        assert.equal(sug.filterItems.length, 1);
        assert.equal(sug.itemIndex, -1);
        inp.el.dispatchEvent({ type: 'keydown', keyCode: 38 }); // Up wraps to last (0)
        assert.equal(sug.itemIndex, 0);
        inp.el.dispatchEvent({ type: 'keydown', keyCode: 9 }); // Tab selects
        assert.deepEqual(sugPicks, ['SUM']);
        sug.setItems(null);
        assert.doesNotThrow(() => sug.search('A'));

        // Datepicker slash dates & impossible calendar date rejection
        const dp = new Datepicker();
        dp.setValue(' 2024/05/12 ');
        assert.equal(dp.calendar.value.getFullYear(), 2024);
        assert.equal(dp.calendar.value.getMonth(), 4);
        assert.equal(dp.calendar.value.getDate(), 12);
        dp.setValue('2024-02-31'); // must NOT roll over to March 2, 2024!
        assert.notEqual(
            `${dp.calendar.value.getFullYear()}-${dp.calendar.value.getMonth() + 1}-${dp.calendar.value.getDate()}`,
            '2024-3-2'
        );

        // Calendar uses cssPrefix & disabled day click is ignored
        const cal = new Calendar(new Date(2024, 0, 15));
        assert.ok(cal.el.el.className.includes('x-spreadsheet-calendar'));
        let calPicked = 0;
        cal.selectChange = () => { calPicked++; };
        const disabledDay = cal.bodyEl.el.querySelector('.disabled');
        assert.ok(disabledDay);
        disabledDay.dispatchEvent({ type: 'click' });
        assert.equal(calPicked, 0);
        cal.prev();
        assert.equal(cal.value.getMonth(), 11);

        // Bottombar controls outside scrolling ul, scrollLeft offset on right-click, _cancelRename restores label, IME guard, constructor options default
        let added = 0;
        const bar = new Bottombar(() => { added++; }, () => {}, () => {}, () => {}, { mode: 'edit' });
        assert.ok(bar.controlsEl.el.className.includes('x-spreadsheet-bottombar-controls'));
        assert.equal(bar.menuEl.el.children.length, 0);
        bar.addItem('Sheet1', true);
        bar.addItem('Sheet2', false);
        assert.equal(bar.menuEl.el.children.length, 2);
        // Right-click with horizontal scroll subtracts scrollLeft
        bar.items[1].el.offsetLeft = 300;
        bar.items[1].el.offsetHeight = 40;
        bar.menuEl.el.scrollLeft = 120;
        bar.items[1].el.dispatchEvent({ type: 'contextmenu' });
        assert.equal(bar.contextMenu.el.css('left'), '180px');
        // dblclick rename + IME Enter ignored + _cancelRename restores label (no stuck <input>)
        bar.items[0].el.dispatchEvent({ type: 'dblclick' });
        const renameInput = bar.items[0].el.querySelector('input');
        assert.ok(renameInput);
        renameInput.value = 'Draft';
        renameInput.dispatchEvent({ type: 'keydown', keyCode: 13, isComposing: true, target: renameInput });
        assert.ok(bar.items[0].el.querySelector('input')); // still editing during IME
        bar._cancelRename();
        assert.equal(bar.items[0].el.querySelector('input'), null);
        assert.equal(bar.items[0].el.textContent, 'Sheet1');
        // Constructor read-mode option respected even when addItem omits 3rd arg
        const readBar = new Bottombar(() => { added++; }, () => {}, () => {}, () => {}, { mode: 'read' });
        readBar.addItem('ReadOnly', true);
        readBar.items[0].el.dispatchEvent({ type: 'dblclick' });
        assert.equal(readBar.items[0].el.querySelector('input'), null);
        assert.equal(added, 0);
        bar.destroy();
        readBar.destroy();
    });
});

test('Selector, Print, Resizer, SortFilter, ModalValidation, FormField, Table, Scrollbar, ContextMenu, Tooltip, and Message fixes', async () => {
    const { mockDocument, mockWindow } = createDomMocks();
    const canvasCalls = [];
    const origCreate = mockDocument.createElement.bind(mockDocument);
    mockDocument.createElement = (tag) => {
        const el = origCreate(tag);
        if (tag === 'canvas') {
            el.getContext = () => ({
                ...createCanvasContextMock(),
                fillText: (txt, x, y) => canvasCalls.push({ txt, x, y })
            });
        }
        return el;
    };

    await runWithDomGlobals({
        document: mockDocument,
        window: mockWindow,
        getComputedStyle: mockWindow.getComputedStyle
    }, () => {
        const {
            DataProxy, Selector, Print, Resizer, SortFilter, ModalValidation,
            FormField, FormInput, FormSelect, Table, Scrollbar, ContextMenu,
            tooltipMod, messageMod, CellRange
        } = loadXSpreadsheetStack();

        // Selector resets lastri/lastci in set(), skips clipboard offset when clear, clamps narrow cells >= 0
        const dp = new DataProxy('W', { mode: 'edit', row: { len: 10, height: 24 }, col: { len: 10, width: 80, indexWidth: 60, minWidth: 60 } });
        const sel = new Selector(dp);
        sel.set(0, 0);
        sel.setEnd(2, 2, true);
        assert.equal(sel.lastri, 2);
        sel.set(1, 1);
        assert.equal(sel.lastri, -1);
        sel.setEnd(2, 2, true); // Works immediately without leaving (2,2)!
        assert.equal(sel.range.eri, 2);
        assert.equal(sel.range.eci, 2);
        // Clipboard was clear -> no 'NaNpx' written to clipboardEl
        assert.notEqual(sel.br.clipboardEl.css('width'), 'NaNpx');
        // Autofill all 4 directions + inside-range clear
        sel.showAutofill(1, 0); // left
        assert.ok(sel.arange);
        sel.showAutofill(0, 1); // top
        assert.ok(sel.arange);
        sel.showAutofill(1, 4); // right
        assert.ok(sel.arange);
        sel.showAutofill(4, 1); // bottom
        assert.ok(sel.arange);
        sel.showAutofill(1, 1); // inside -> clear
        assert.equal(sel.arange, null);

        // Resizer click without drag does NOT emit finishedFn
        const res = new Resizer(false, 24);
        let resizeCalls = 0;
        res.finishedFn = () => { resizeCalls++; };
        res.show({ left: 0, top: 24, width: 60, height: 10 }, { width: 500 });
        res.mousedownHandler({ buttons: 1, clientY: 34 });
        mockWindow.dispatchEvent({ type: 'mouseup' });
        assert.equal(resizeCalls, 0);
        // Actual drag DOES emit finishedFn
        res.show({ left: 0, top: 24, width: 60, height: 24 }, { width: 500 });
        res.mousedownHandler({ buttons: 1, clientY: 48 });
        mockWindow.dispatchEvent({ type: 'mousemove', buttons: 1, clientY: 80 });
        mockWindow.dispatchEvent({ type: 'mouseup' });
        assert.equal(resizeCalls, 1);
        res.destroy();

        // SortFilter measures real rendered box after show() & toggles sort off on second click
        const sf = new SortFilter();
        sf.el.css('width', '260px').css('height', '340px');
        sf.set(0, { '': 1, apple: 2 }, null, null);
        sf.itemClick('asc');
        assert.equal(sf.sort, 'asc');
        sf.itemClick('asc'); // toggles back to null!
        assert.equal(sf.sort, null);
        sf.setOffset({ left: 900, top: 550 }, { width: 1000, height: 600 });
        assert.equal(sf.el.css('left'), '740px');
        assert.equal(sf.el.css('top'), '260px');
        let okCalled = false;
        sf.ok = () => { okCalled = true; };
        sf.btnClick('ok');
        assert.equal(okCalled, true);

        // ModalValidation accepts lowercase ref & normalizes to uppercase; FormField rejects impossible date
        const mv = new ModalValidation();
        let savedRef = null;
        mv.change = (_action, _mode, ref) => { savedRef = ref; };
        mv.setValue({ mode: 'cell', ref: 'a1:b5', validator: { type: 'list', value: 'x,y' } });
        mv.btnClick('save');
        assert.equal(savedRef, 'A1:B5');
        mv.criteriaSelected('date');
        mv.criteriaOperatorSelected('eq');
        mv.btnClick('cancel');

        const dateField = new FormField(new FormInput('100px', ''), { required: true, type: 'date' }, 'Date', 60);
        dateField.val('2024-02-31');
        assert.equal(dateField.validate(), false);
        dateField.val('2024-02-29');
        assert.equal(dateField.validate(), true);

        const fsel = new FormSelect('a', ['a', 'b'], '100px', it => it.toUpperCase());
        let selVal = null;
        fsel.vchange = v => { selVal = v; };
        fsel.show();
        fsel.suggest.itemClick({ key: 'b', title: 'B' });
        assert.equal(selVal, 'b');

        // Print preview uses display: flex, handles AutoFilter + cross-page merge, and toPrint CSS has margin: 0 + last-child auto
        const dpPrint = new DataProxy('PR', { mode: 'edit', row: { len: 6, height: 300 }, col: { len: 2, width: 100, indexWidth: 60, minWidth: 60 } });
        dpPrint.setCellText(0, 0, 'MergeSpan', 'finished');
        dpPrint.selector.range = CellRange.valueOf('A1:A5');
        dpPrint.merge();
        dpPrint.exceptRowSet = new Set([1]);
        const pr = new Print(dpPrint);
        pr.preview();
        assert.equal(pr.el.css('display'), 'flex');
        assert.ok(pr.canvases.length >= 2);
        const iframes = [];
        const origCreate2 = mockDocument.createElement;
        mockDocument.createElement = (tag) => {
            const el = origCreate2(tag);
            if (tag === 'iframe') {
                el.contentWindow = {
                    document: {
                        createElement: origCreate2,
                        head: origCreate2('head'),
                        body: origCreate2('body')
                    },
                    focus() {},
                    print() {}
                };
                iframes.push(el);
            }
            return el;
        };
        pr.toPrint();
        assert.equal(iframes.length, 1);
        const cssHtml = iframes[0].contentWindow.document.head.children[0].innerHTML;
        assert.match(cssHtml, /margin:\s*0/);
        assert.match(cssHtml, /canvas:last-child/);
        iframes[0].contentWindow.onafterprint();
        assert.equal(pr._printIframe, null);
        pr.destroy();

        // Table renders frozen [fri, fci] 4-pane grid, non-editable cell, autofilter dropdown, style.border=null safely
        const dpTbl = new DataProxy('TBL', {
            mode: 'edit',
            evalPaused: false,
            row: { len: 6, height: 24 },
            col: { len: 6, width: 80, indexWidth: 60, minWidth: 60 }
        });
        dpTbl.setFreeze(2, 2);
        dpTbl.setCellText(0, 0, 'Locked', 'finished');
        dpTbl.getCell(0, 0).editable = false;
        dpTbl.styles.push({ border: null, format: 'number' });
        dpTbl.getCell(0, 0).style = 0;
        dpTbl.setCellText(0, 1, '=1+2', 'finished');
        dpTbl.autoFilter.ref = 'A1:B3';
        const tblCanvas = mockDocument.createElement('canvas');
        const tbl = new Table(tblCanvas, dpTbl);
        assert.doesNotThrow(() => tbl.render());
        assert.ok(canvasCalls.some(c => c.txt === '3'));

        // ContextMenu clamps negative y; Tooltip clamps left >= 0; Scrollbar horizontal; Message onClose fires once
        const cm = new ContextMenu(() => ({ width: 500, height: 400 }), false);
        cm.setPosition(10, -20);
        assert.equal(cm.el.css('top'), '0px');
        cm.hide();

        const leftBtn = origCreate('button');
        leftBtn.getBoundingClientRect = () => ({ left: 0, top: 10, width: 10, height: 20 });
        tooltipMod('Long tooltip text', leftBtn);
        const tipEl = mockDocument.body.children.find(c => c.className.includes('x-spreadsheet-tooltip'));
        assert.ok(parseFloat(tipEl.style.left) >= 0);
        tooltipMod.hideTooltip(mockDocument.body);

        const hsb = new Scrollbar(false);
        hsb.set(400, 1000);
        hsb.move({ left: 100 }, true);
        hsb.set(400, 100);
        assert.equal(hsb.el.css('display'), 'none');
        hsb.destroy();

        let closeCount = 0;
        const rmToast = messageMod.xtoast('Info', 'Hello', () => { closeCount++; });
        rmToast();
        rmToast(); // idempotent
        assert.equal(closeCount, 1);
    });
});
