import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createDomMocks,
    loadXSpreadsheetStack,
    runWithDomGlobals
} from './helpers/load-module.mjs';

test('all x-spreadsheet UI primitives (Button, Icon, FormInput, ColorPalette, DropdownColor) and toolbar base classes operate cleanly', async () => {
    const { mockDocument, mockWindow } = createDomMocks();
    await runWithDomGlobals({
        document: mockDocument,
        window: mockWindow,
        getComputedStyle: mockWindow.getComputedStyle
    }, async () => {
        const {
            Button, Icon, FormInput, ColorPalette, DropdownColor,
            Item, DropdownItem, toolbarItems, h
        } = loadXSpreadsheetStack();

        // Button
        const btn = new Button('ok', 'primary');
        assert.ok(btn.el.className.includes('x-spreadsheet-button'));
        assert.ok(btn.el.className.includes('primary'));

        // Icon + setName
        const ic = new Icon('bold');
        assert.ok(ic.iconNameEl.el.className.includes('bold'));
        ic.setName('italic');
        assert.ok(ic.iconNameEl.el.className.includes('italic'));
        assert.equal(ic.iconNameEl.el.className.includes('bold'), false);

        // FormInput: focus, clearTimer, hint, vchange on input event
        const fi = new FormInput('120px', 'Enter text');
        const inputChanges = [];
        fi.vchange = evt => inputChanges.push(evt.target.value);
        fi.hint('Updated hint');
        assert.equal(fi.input.attr('placeholder'), 'Updated hint');
        fi.val('hello');
        assert.equal(fi.val(), 'hello');
        fi.input.el.value = 'typed';
        fi.input.el.dispatchEvent({ type: 'input', target: fi.input.el });
        assert.deepEqual(inputChanges, ['typed']);
        fi.focus();
        fi.clearTimer();

        // ColorPalette standard + theme rows & DropdownColor setTitle / change
        const palettePicks = [];
        const cp = new ColorPalette();
        cp.change = c => palettePicks.push(c);
        const cells = cp.el.el.querySelectorAll('.x-spreadsheet-color-palette-cell');
        assert.ok(cells.length >= 60);
        cells[0].dispatchEvent({ type: 'click' });
        cells[cells.length - 1].dispatchEvent({ type: 'click' });
        assert.equal(palettePicks.length, 2);

        const ddColor = new DropdownColor('color', '#000000');
        let pickedColor = null;
        ddColor.change = c => { pickedColor = c; };
        ddColor.setTitle('#ff0000');
        assert.equal(ddColor.title.css('border-color'), '#ff0000');
        ddColor.contentEl.el.querySelector('.x-spreadsheet-color-palette-cell').dispatchEvent({ type: 'click' });
        assert.ok(pickedColor);

        // Item tooltip on mouseenter + camelCase tag + shortcut
        const baseItem = new Item('textwrap', 'Ctrl+W', true);
        mockDocument.body.appendChild(baseItem.el.el);
        baseItem.el.el.dispatchEvent({ type: 'mouseenter', target: baseItem.el.el });
        const tipNode = mockDocument.body.children.find(c => c.className.includes('x-spreadsheet-tooltip'));
        assert.ok(tipNode && tipNode.textContent.includes('Ctrl+W'));
        baseItem.el.el.dispatchEvent({ type: 'mouseleave' });

        // IconItem disabled guard vs enabled click
        const iconClicks = [];
        const undoItem = new toolbarItems.Undo();
        undoItem.change = (...a) => iconClicks.push(a);
        undoItem.setState(true); // disabled
        undoItem.el.el.dispatchEvent({ type: 'click' });
        assert.equal(iconClicks.length, 0);
        undoItem.setState(false); // enabled
        undoItem.el.el.dispatchEvent({ type: 'click' });
        assert.deepEqual(iconClicks[0], ['undo']);

        // ToggleItem active->inactive cycle & disabled guard
        const toggleClicks = [];
        const boldItem = new toolbarItems.Bold();
        boldItem.change = (...a) => toggleClicks.push(a);
        boldItem.el.el.dispatchEvent({ type: 'click' });
        assert.deepEqual(toggleClicks[0], ['font-bold', true]);
        boldItem.el.el.dispatchEvent({ type: 'click' });
        assert.deepEqual(toggleClicks[1], ['font-bold', false]);

        // DropdownItem falsy setState ('') still updates title (only null/undefined skipped)
        let titleSeen = null;
        class TestDropdownItem extends DropdownItem {
            dropdown() {
                return {
                    el: h('div', 'dd'),
                    setTitle: (v) => { titleSeen = v; },
                    change: () => {}
                };
            }
        }
        const di = new TestDropdownItem('test');
        di.setState('');
        assert.equal(titleSeen, '');
        titleSeen = 'keep';
        di.setState(undefined);
        assert.equal(titleSeen, 'keep');

        // More / DropdownMore childDropdowns cascade hide
        const more = new toolbarItems.More();
        let childHidden = 0;
        more.dd.childDropdowns = [{ hide: () => { childHidden++; } }];
        more.dd.show();
        more.dd.hide();
        assert.equal(childHidden, 1);
    });
});

test('all 22 concrete toolbar subclasses emit exact (tag, value) on interaction and Toolbar handles hidden-container re-measure & extendToolbar', async () => {
    const { mockDocument, mockWindow } = createDomMocks();
    await runWithDomGlobals({
        document: mockDocument,
        window: mockWindow,
        getComputedStyle: mockWindow.getComputedStyle
    }, async () => {
        const { toolbarItems, Toolbar, DataProxy, h } = loadXSpreadsheetStack();
        const events = [];
        const bindChange = (item) => {
            item.change = (tag, val) => events.push({ tag, val });
            return item;
        };

        // 1. IconItem subclasses: Undo, Redo, Print, Clearformat
        for (const [Key, expectedTag] of [
            ['Undo', 'undo'],
            ['Redo', 'redo'],
            ['Print', 'print'],
            ['Clearformat', 'clearformat']
        ]) {
            const inst = bindChange(new toolbarItems[Key]());
            inst.setState(false);
            inst.el.el.dispatchEvent({ type: 'click' });
            assert.equal(events[events.length - 1].tag, expectedTag);
        }

        // 2. ToggleItem subclasses: Autofilter, Bold, Italic, Strike, Underline, Freeze, Merge, Paintformat, Textwrap
        for (const [Key, expectedTag] of [
            ['Autofilter', 'autofilter'],
            ['Bold', 'font-bold'],
            ['Italic', 'font-italic'],
            ['Strike', 'strike'],
            ['Underline', 'underline'],
            ['Freeze', 'freeze'],
            ['Merge', 'merge'],
            ['Paintformat', 'paintformat'],
            ['Textwrap', 'textwrap']
        ]) {
            const inst = bindChange(new toolbarItems[Key]());
            inst.setState(false, false);
            inst.el.el.dispatchEvent({ type: 'click' });
            assert.equal(events[events.length - 1].tag, expectedTag);
            assert.equal(events[events.length - 1].val, true);
        }

        // 3. DropdownItem subclasses: Align, Valign, Border, FillColor, TextColor, Font, FontSize, Format, Formula
        const align = bindChange(new toolbarItems.Align('left'));
        align.dd.change('center');
        assert.deepEqual(events[events.length - 1], { tag: 'align', val: 'center' });

        const valign = bindChange(new toolbarItems.Valign('middle'));
        valign.dd.change('top');
        assert.deepEqual(events[events.length - 1], { tag: 'valign', val: 'top' });

        const border = bindChange(new toolbarItems.Border());
        border.dd.change({ mode: 'all', style: 'thin', color: '#000' });
        assert.equal(events[events.length - 1].tag, 'border');
        assert.equal(events[events.length - 1].val.mode, 'all');

        const fillColor = bindChange(new toolbarItems.FillColor('#ffffff'));
        fillColor.dd.change('#ff0000');
        assert.deepEqual(events[events.length - 1], { tag: 'bgcolor', val: '#ff0000' });

        const textColor = bindChange(new toolbarItems.TextColor('#000000'));
        textColor.dd.change('#00ff00');
        assert.deepEqual(events[events.length - 1], { tag: 'color', val: '#00ff00' });

        const font = bindChange(new toolbarItems.Font());
        font.dd.change({ key: 'Georgia', title: 'Georgia' });
        assert.deepEqual(events[events.length - 1], { tag: 'font-name', val: 'Georgia' });

        const fontSize = bindChange(new toolbarItems.FontSize());
        fontSize.dd.change({ pt: 14, px: 18.6 });
        assert.deepEqual(events[events.length - 1], { tag: 'font-size', val: 14 });

        const format = bindChange(new toolbarItems.Format());
        format.dd.change({ key: 'number' });
        assert.deepEqual(events[events.length - 1], { tag: 'format', val: 'number' });

        const formula = bindChange(new toolbarItems.Formula());
        formula.dd.change({ key: 'SUM' });
        assert.deepEqual(events[events.length - 1], { tag: 'formula', val: 'SUM' });

        // Toolbar with extendToolbar.left + right (including custom el & icon), read-mode guard, paintformat reset, hidden-container re-measure
        const customClicks = [];
        const dp = new DataProxy('TB', {
            mode: 'edit',
            extendToolbar: {
                left: [{ tip: 'LeftTip', icon: 'data:image/png;base64,AA==', onClick: (d) => customClicks.push(['left', d.name]) }],
                right: [{ tip: 'RightTip', el: h('span', 'custom-btn').el, onClick: (d) => customClicks.push(['right', d.name]) }]
            }
        });
        let toolbarW = 0; // Start hidden (0px) with non-zero CSS margin
        const origGcs = mockWindow.getComputedStyle;
        mockWindow.getComputedStyle = () => ({ marginLeft: '1px', marginRight: '1px', paddingTop: '0px' });
        const tb = new Toolbar(dp, () => toolbarW, false);
        tb.btns.el.children.forEach(c => {
            c.clientWidth = 0;
        });
        tb.el.css('width', '0px');
        // Wait for Toolbar's post-mount 0ms timer while hidden: buttons have width 0 + margin 2px => _btnsMeasured stays false
        await new Promise(resolve => setTimeout(resolve, 15));
        tb._onWindowResize();
        assert.equal(tb._btnsMeasured, false);

        // Become visible at narrow width 300px -> re-measures button widths and collapses overflow into moreEl!
        toolbarW = 300;
        tb.btns.el.children.forEach(c => {
            c.clientWidth = 30;
        });
        tb._onWindowResize();
        assert.equal(tb._btnsMeasured, true);
        assert.notEqual(tb.moreEl.el.css('display'), 'none');
        assert.ok(tb.moreEl.dd.moreBtns.children().length > 0);

        // Extend toolbar left/right button click passes single SheetData (not array)
        tb.items[0][0].el.el.dispatchEvent({ type: 'click' });
        assert.deepEqual(customClicks[0], ['left', 'TB']);
        // Paintformat active -> resetData deactivates it
        tb.paintformatToggle();
        assert.equal(tb.paintformatActive(), true);
        tb.resetData(dp);
        assert.equal(tb.paintformatActive(), false);
        // Read mode blocks extendToolbar clicks and resets paintformat
        dp.settings.mode = 'read';
        tb.paintformatToggle();
        tb.reset();
        assert.equal(tb.paintformatActive(), false);
        tb.items[0][0].el.el.dispatchEvent({ type: 'click' });
        assert.equal(customClicks.length, 1);

        // Trigger helper & isHide: true
        tb.trigger('bold');
        const hiddenTb = new Toolbar(dp, () => 800, true);
        assert.equal(hiddenTb.el.css('display'), 'none');

        tb.destroy();
        hiddenTb.destroy();
        mockWindow.getComputedStyle = origGcs;
    });
});
