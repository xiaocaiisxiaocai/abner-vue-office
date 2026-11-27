import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createCanvasContextMock,
    createDomMocks,
    loadXSpreadsheetStack,
    runWithDomGlobals
} from './helpers/load-module.mjs';

function setupMockDomForSpreadsheet() {
    const mocks = createDomMocks();
    const origCreate = mocks.mockDocument.createElement.bind(mocks.mockDocument);
    mocks.mockDocument.createElement = (tag) => {
        const el = origCreate(tag);
        if (tag === 'canvas') {
            el.getContext = () => createCanvasContextMock();
        }
        return el;
    };
    return mocks;
}

test('Sheet read-only ContextMenu on initial A1, Ctrl+C copy, external input keydown guard, and scrollbar-hide scroll reset', async () => {
    const { mockDocument, mockWindow, windowListeners } = setupMockDomForSpreadsheet();
    await runWithDomGlobals({
        document: mockDocument,
        window: mockWindow,
        getComputedStyle: mockWindow.getComputedStyle
    }, () => {
        const { Spreadsheet } = loadXSpreadsheetStack();
        const host = mockDocument.createElement('div');
        mockDocument.body.appendChild(host);

        const xsRead = new Spreadsheet(host, {
            mode: 'read',
            showToolbar: false,
            showContextmenu: true,
            view: { width: () => 800, height: () => 500 }
        });
        xsRead.loadData([
            { name: 'S1', rows: { len: 50, 0: { cells: { 0: { text: 'Alpha' } } } } },
            { name: 'S2', rows: { len: 50, 0: { cells: { 0: { text: 'Beta' } } } } }
        ]);

        // Initial right-click directly on A1 (without prior left-click) must show ONLY Copy (read mode)
        xsRead.sheet.overlayerEl.el.dispatchEvent({
            type: 'mousedown',
            button: 2,
            buttons: 2,
            clientX: 80,
            clientY: 36,
            offsetX: 80,
            offsetY: 36
        });
        const visibleItemsInit = xsRead.sheet.contextMenu.menuItems.filter(it => it.css('display') !== 'none');
        assert.equal(visibleItemsInit.length, 1);

        // After switching to S2 (resetData), right-click on A1 still shows ONLY Copy
        xsRead.bottombar.clickSwap2(xsRead.bottombar.items[1]);
        xsRead.sheet.overlayerEl.el.dispatchEvent({
            type: 'mousedown',
            button: 2,
            buttons: 2,
            clientX: 80,
            clientY: 36,
            offsetX: 80,
            offsetY: 36
        });
        const visibleItemsAfterSwitch = xsRead.sheet.contextMenu.menuItems.filter(it => it.css('display') !== 'none');
        assert.equal(visibleItemsAfterSwitch.length, 1);

        // Ctrl+C copy works in read-only mode
        xsRead.sheet.focusing = true;
        let copiedText = null;
        let copyPrevented = false;
        mockWindow.dispatchEvent({
            type: 'copy',
            clipboardData: {
                clearData: () => {},
                setData: (_t, val) => { copiedText = val; }
            },
            preventDefault: () => { copyPrevented = true; }
        });
        assert.equal(copiedText, 'Beta');
        assert.equal(copyPrevented, true);

        // External host-page input must NOT be hijacked by window keydown / copy / paste
        const externalInput = mockDocument.createElement('input');
        mockDocument.body.appendChild(externalInput);
        mockDocument.activeElement = externalInput;
        let externalPrevented = false;
        mockWindow.dispatchEvent({
            type: 'keydown',
            keyCode: 40,
            key: 'ArrowDown',
            target: externalInput,
            preventDefault: () => { externalPrevented = true; }
        });
        assert.equal(externalPrevented, false);
        assert.equal(xsRead.data.selector.ri, 0);

        let externalCopyPrevented = false;
        mockWindow.dispatchEvent({
            type: 'copy',
            target: externalInput,
            preventDefault: () => { externalCopyPrevented = true; }
        });
        assert.equal(externalCopyPrevented, false);

        mockDocument.activeElement = null;
        xsRead.destroy();

        // Scrollbar hide after content shrinks resets data.scroll so viewport is never stranded blank
        const xsEdit = new Spreadsheet(host, {
            mode: 'edit',
            showToolbar: true,
            showContextmenu: true,
            view: { width: () => 800, height: () => 400 }
        });
        xsEdit.loadData({ name: 'Big', rows: { len: 40 }, cols: { len: 20 } });
        xsEdit.data.scroll.ri = 20;
        xsEdit.data.scroll.y = 500;
        xsEdit.data.scroll.ci = 10;
        xsEdit.data.scroll.x = 800;
        xsEdit.sheet.loadData({ name: 'Small', rows: { len: 3 }, cols: { len: 2 } });
        assert.equal(xsEdit.data.scroll.ri, 0);
        assert.equal(xsEdit.data.scroll.y, 0);
        assert.equal(xsEdit.data.scroll.ci, 0);
        assert.equal(xsEdit.data.scroll.x, 0);

        xsEdit.destroy();
        assert.equal(windowListeners.get('keydown')?.size || 0, 0);
    });
});

test('Sheet covers mouse/scroll/drag/buttons=0/double-click/keyboard/toolbar/contextMenu/modalValidation/toast cleanup and Spreadsheet API', async () => {
    const { mockDocument, mockWindow, windowListeners } = setupMockDomForSpreadsheet();
    await runWithDomGlobals({
        document: mockDocument,
        window: mockWindow,
        getComputedStyle: mockWindow.getComputedStyle
    }, () => {
        const { Spreadsheet, spreadsheet } = loadXSpreadsheetStack();

        // Missing target element throws; CSS selector string works
        assert.throws(() => new Spreadsheet('#does-not-exist'), /Spreadsheet target element is required/);
        const host = mockDocument.createElement('div');
        host.setAttribute('id', 'xs-host');
        mockDocument.body.appendChild(host);

        const xs = spreadsheet('#xs-host', {
            mode: 'edit',
            showToolbar: true,
            showContextmenu: true,
            showBottomBar: true,
            view: { width: () => 900, height: () => 500 }
        });

        let changeEvents = 0;
        xs.change(() => { changeEvents++; });
        xs.loadData({
            name: 'Main',
            rows: {
                len: 30,
                0: { cells: { 0: { text: 'H1' }, 1: { text: 'H2' } } },
                1: { cells: { 0: { text: '10' }, 1: { text: '20' } } },
                2: { cells: { 0: { text: '30' }, 1: { text: '40' } } }
            },
            cols: { len: 15 }
        });
        assert.equal(xs.validate(), true);
        assert.equal(xs.cell(1, 0).text, '10');
        assert.equal(xs.cellStyle(1, 0), null);

        // Overlayer mousewheel prevents default when sheet scrolls, and respects Firefox evt.detail
        let wheelPrevented = false;
        xs.sheet.overlayerEl.el.dispatchEvent({
            type: 'wheel',
            deltaY: 100,
            deltaX: 0,
            preventDefault: () => { wheelPrevented = true; }
        });
        assert.equal(wheelPrevented, true);

        // Overlayer mousemove on row/col header shows resizer and unhide indicator
        xs.data.rows.setHide(0, true);
        xs.data.cols.setHide(0, true);
        xs.sheet.overlayerEl.el.dispatchEvent({ type: 'mousemove', buttons: 0, clientX: 20, clientY: 36, offsetX: 20, offsetY: 36 });
        xs.sheet.overlayerEl.el.dispatchEvent({ type: 'mousemove', buttons: 0, clientX: 90, clientY: 10, offsetX: 90, offsetY: 10 });
        xs.sheet.overlayerEl.el.dispatchEvent({ type: 'mouseout', clientX: -1, clientY: -1, offsetX: -1, offsetY: -1 });
        xs.data.rows.unhide(0);
        xs.data.cols.unhide(0);

        // Drag selection + release outside window (e.buttons === 0 cancels mouseMoveUp cleanly)
        xs.sheet.overlayerEl.el.dispatchEvent({ type: 'mousedown', button: 0, buttons: 1, clientX: 80, clientY: 36, offsetX: 80, offsetY: 36 });
        assert.equal(typeof xs.sheet._cancelMoveUp, 'function');
        mockWindow.dispatchEvent({ type: 'mousemove', buttons: 0, clientX: 200, clientY: 100 });
        assert.equal(xs.sheet._cancelMoveUp, null);

        // Double middle-click does NOT open editor
        xs.sheet.overlayerEl.el.dispatchEvent({ type: 'mousedown', button: 1, detail: 2, clientX: 80, clientY: 36, offsetX: 80, offsetY: 36 });
        assert.equal(xs.sheet.editor._editing, false);

        // Double left-click opens editor, and Sheet.loadData clears active editor & popups
        xs.sheet.overlayerEl.el.dispatchEvent({ type: 'mousedown', button: 0, detail: 2, clientX: 80, clientY: 36, offsetX: 80, offsetY: 36 });
        assert.equal(xs.sheet.editor._editing, true);
        xs.sheet.loadData({
            name: 'Main',
            rows: {
                len: 30,
                0: { cells: { 0: { text: 'H1' }, 1: { text: 'H2' } } },
                1: { cells: { 0: { text: '10' }, 1: { text: '20' } } }
            },
            cols: { len: 15 }
        });
        assert.equal(xs.sheet.editor._editing, false);

        // Scrollbar move & resizer finished callbacks
        xs.sheet.verticalScrollbar.moveFn(50);
        xs.sheet.horizontalScrollbar.moveFn(100);
        xs.sheet.rowResizer.finishedFn({ ri: 0 }, 40);
        xs.sheet.colResizer.finishedFn({ ci: 0 }, 120);
        assert.equal(xs.data.rows.getHeight(0), 40);
        assert.equal(xs.data.cols.getWidth(0), 120);

        // Toolbar changes (freeze, autofilter, paintformat, clearformat, undo, redo, print, formula)
        xs.sheet.toolbar.change('autofilter');
        assert.equal(xs.data.autoFilter.active(), true);
        xs.sheet.toolbar.change('autofilter');
        assert.equal(xs.data.autoFilter.active(), false);
        xs.sheet.toolbar.change('freeze', true);
        xs.sheet.toolbar.change('freeze', false);
        xs.sheet.toolbar.change('paintformat', true);
        xs.sheet.toolbar.change('paintformat', false);
        xs.sheet.toolbar.change('clearformat');
        xs.sheet.toolbar.change('undo');
        xs.sheet.toolbar.change('redo');
        xs.sheet.toolbar.change('print');
        assert.equal(xs.sheet.print.el.css('display'), 'flex');
        // Keyboard while print preview is open is ignored
        xs.sheet.focusing = true;
        mockWindow.dispatchEvent({ type: 'keydown', keyCode: 40, key: 'ArrowDown', preventDefault: () => {} });
        xs.sheet.print.el.hide();

        // Modal validation save & remove via Sheet handler + validate() returning false
        xs.sheet.modalValidation.change('save', 'cell', 'A1', { type: 'number', required: false, operator: 'gt', value: '999' });
        assert.equal(xs.validate(), false);
        xs.sheet.modalValidation.change('remove');
        assert.equal(xs.validate(), true);

        // ContextMenu itemClick actions (copy, cut, paste, paste-value, paste-format, insert/delete row/col, printable/editable, hide)
        for (const action of ['copy', 'paste', 'paste-value', 'paste-format', 'insert-row', 'delete-row', 'insert-column', 'delete-column', 'cell-non-printable', 'cell-printable', 'cell-non-editable', 'cell-editable', 'delete-cell-text']) {
            xs.sheet.contextMenu.itemClick(action);
        }

        // Keyboard shortcuts: Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y, Ctrl+X, Ctrl+U, Ctrl+B, Ctrl+I, Ctrl+Space, Ctrl+Arrows, Shift+Space, Tab, Shift+Tab, Enter, Shift+Enter, Backspace, Delete, F2, Esc
        xs.sheet.focusing = true;
        for (const evt of [
            { ctrlKey: true, keyCode: 90 },
            { ctrlKey: true, shiftKey: true, keyCode: 90 },
            { ctrlKey: true, keyCode: 89 },
            { ctrlKey: true, keyCode: 88 },
            { ctrlKey: true, keyCode: 85 },
            { ctrlKey: true, keyCode: 66 },
            { ctrlKey: true, keyCode: 73 },
            { ctrlKey: true, keyCode: 32 },
            { ctrlKey: true, keyCode: 39 },
            { ctrlKey: true, keyCode: 37 },
            { ctrlKey: true, keyCode: 40 },
            { ctrlKey: true, keyCode: 38 },
            { shiftKey: true, keyCode: 32 },
            { keyCode: 39 },
            { keyCode: 37 },
            { keyCode: 40 },
            { keyCode: 38 },
            { keyCode: 9 },
            { keyCode: 9, shiftKey: true },
            { keyCode: 13 },
            { keyCode: 13, shiftKey: true },
            { keyCode: 8 },
            { key: 'Delete', keyCode: 46 },
            { keyCode: 113 },
            { keyCode: 27 }
        ]) {
            mockWindow.dispatchEvent({ type: 'keydown', preventDefault: () => {}, ...evt });
        }

        // Trigger paste onto merged cell -> showSheetToast; dismissing toast clears _toastRemovers (no memory leak!)
        xs.data.selector.range = xs.data.selector.range.clone();
        xs.data.selector.range.sri = 5;
        xs.data.selector.range.sci = 0;
        xs.data.selector.range.eri = 6;
        xs.data.selector.range.eci = 1;
        xs.data.merge();
        xs.data.selector.range.sri = 0;
        xs.data.selector.range.sci = 0;
        xs.data.selector.range.eri = 0;
        xs.data.selector.range.eci = 0;
        xs.data.copy();
        xs.data.selector.range.sri = 5;
        xs.data.selector.range.sci = 0;
        xs.data.selector.range.eri = 5;
        xs.data.selector.range.eci = 0;
        xs.sheet.contextMenu.itemClick('paste');
        assert.equal(xs.sheet._toastRemovers.size, 1);
        // Click toast dimmer -> triggers onClose -> removes entry from _toastRemovers immediately
        const dimmerEl = mockDocument.body.children.find(c => c.className.includes('x-spreadsheet-dimmer'));
        assert.ok(dimmerEl);
        dimmerEl.dispatchEvent({ type: 'click' });
        assert.equal(xs.sheet._toastRemovers.size, 0);

        // Trigger another toast and confirm destroy() cleans it up too
        xs.sheet.contextMenu.itemClick('paste');
        assert.equal(xs.sheet._toastRemovers.size, 1);

        // Sheet bottombar add / rename / delete + Spreadsheet.locale
        xs.addSheet('Extra', true);
        assert.equal(xs.datas.length, 2);
        xs.bottombar.renameItem(1, 'Renamed', true);
        assert.equal(xs.datas[1].name, 'Renamed');
        xs.bottombar.deleteEl = xs.bottombar.items[1];
        xs.deleteSheet();
        assert.equal(xs.datas.length, 1);
        assert.ok(changeEvents > 0);
        Spreadsheet.locale('en', {});

        xs.destroy();
        assert.equal(xs.sheet, null);
        assert.equal(mockDocument.body.children.filter(c => c.className.includes('x-spreadsheet-toast')).length, 0);
        assert.equal(windowListeners.get('keydown')?.size || 0, 0);
    });
});
