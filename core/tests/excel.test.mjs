import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { getDarkColor, getLightColor } from '../packages/vue-excel/src/color.js';
import { readOnlyInput } from '../packages/vue-excel/src/hack.js';
import {
    CORE_DIR,
    createDomMocks,
    loadExcelModule,
    loadStrippedModule,
    runWithDomGlobals
} from './helpers/load-module.mjs';

const excelMod = loadExcelModule();
const { stringAt, expr2xy, xy2expr } = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/alphabet.js');

test('color.js handles null, 3-char hex, 6-char hex, and bounds clamping', () => {
    assert.equal(getDarkColor(null, 0.5), '#000000');
    assert.equal(getLightColor(undefined, 0.5), '#7f7f7f');
    assert.equal(getDarkColor('xyz', 0.2), '#000000');
    assert.equal(getDarkColor('#fff', 0.5), '#7f7f7f');
    assert.equal(getLightColor('#000', 2), '#ffffff');
    assert.equal(getDarkColor('#123456', 2), '#000000');
});

test('excel.js getData handles buffers, typedarray slices, Blob, Response, and XHR errors', async () => {
    const slab = new Uint8Array([0, 11, 22, 33, 99]);
    const sub = slab.subarray(1, 4);
    const out = await excelMod.getData(sub);
    assert.deepEqual(Array.from(new Uint8Array(out)), [11, 22, 33]);

    const blob = new Blob([new Uint8Array([5, 6])]);
    assert.deepEqual(Array.from(new Uint8Array(await excelMod.getData(blob))), [5, 6]);

    const resp = new Response(new Uint8Array([7, 8]));
    assert.deepEqual(Array.from(new Uint8Array(await excelMod.getData(resp))), [7, 8]);

    await assert.rejects(excelMod.getData(12345), /不支持的 src 格式/);

    class MockXHR {
        constructor() {
            this.headers = {};
            this.status = 0;
            this.response = null;
            this.withCredentials = false;
        }

        open(method, url) {
            this.method = method;
            this.url = url;
        }

        setRequestHeader(k, v) {
            this.headers[k] = v;
        }

        send() {
            MockXHR.lastInstance = this;
            if (this.url.endsWith('/ok')) {
                this.status = 200;
                this.response = new ArrayBuffer(4);
                this.onload();
            } else if (this.url.endsWith('/404')) {
                this.status = 404;
                this.onload();
            } else if (this.url.endsWith('/err')) {
                this.status = 0;
                this.onerror();
            } else if (this.url.endsWith('/abort')) {
                this.onabort();
            } else if (this.url.endsWith('/timeout')) {
                this.ontimeout();
            }
        }
    }

    await runWithDomGlobals({ XMLHttpRequest: MockXHR }, async () => {
        const okBuf = await excelMod.getData('https://example.com/ok', {
            credentials: 'include',
            headers: { Authorization: 'Bearer tok' }
        });
        assert.equal(okBuf.byteLength, 4);
        assert.equal(MockXHR.lastInstance.withCredentials, true);
        assert.equal(MockXHR.lastInstance.headers.Authorization, 'Bearer tok');

        const nullOptsBuf = await excelMod.getData('https://example.com/ok', null);
        assert.equal(nullOptsBuf.byteLength, 4);

        await assert.rejects(excelMod.getData('https://example.com/404'), err => err instanceof Error && err.status === 404);
        await assert.rejects(excelMod.getData('https://example.com/err'), err => err instanceof Error && err.status === 0);
        await assert.rejects(excelMod.getData('https://example.com/abort'), /Request aborted/);
        await assert.rejects(excelMod.getData('https://example.com/timeout'), /Request timeout/);
    });
});

test('excel.js correctly formats multi-section numFmt, currency, dates, formulas, errors, and >20 columns', () => {
    const sourceCols = [];
    const hiddenRowCells = [{ type: 3, value: 'hidden', style: {}, _address: 'A2' }];
    const mockWorkbook = {
        media: [],
        eachSheet(cb) {
            cb(this._worksheets[0]);
        },
        _worksheets: [{
            name: 'Sheet1',
            _merges: {},
            _columns: sourceCols,
            columns: sourceCols,
            _rows: [
                {
                    _cells: [
                        { type: 2, value: 1234.56, style: { numFmt: '#,##0.00;-#,##0.00;"-"' }, _address: 'A1' },
                        { type: 2, value: -1234.56, style: { numFmt: '#,##0.00;-#,##0.00;"-"' }, _address: 'B1' },
                        { type: 2, value: 0, style: { numFmt: '#,##0.00;-#,##0.00;"-"' }, _address: 'C1' },
                        { type: 2, value: 1234.56, style: { numFmt: '_(* #,##0.00_);_(* (#,##0.00);_(* "-"??_);_(@_)' }, _address: 'D1' },
                        { type: 2, value: -1234.56, style: { numFmt: '_(* #,##0.00_);_(* (#,##0.00);_(* "-"??_);_(@_)' }, _address: 'E1' },
                        { type: 2, value: 100, style: { numFmt: '"¥"#,##0.00;-"¥"#,##0.00' }, _address: 'F1' },
                        { type: 2, value: -100, style: { numFmt: '"¥"#,##0.00;-"¥"#,##0.00' }, _address: 'G1' },
                        { type: 2, value: 100, style: { numFmt: '[$¥-804]#,##0.00' }, _address: 'H1' },
                        { type: 2, value: 88.5, style: { numFmt: '#,##0.00"元";-#,##0.00"元"' }, _address: 'I1' },
                        { type: 2, value: 0.14, style: { numFmt: '0%' }, _address: 'J1' },
                        { type: 10, value: { error: '#DIV/0!' }, style: {}, _address: 'K1' },
                        { type: 4, value: new Date(Date.UTC(2025, 0, 1, 9, 30, 45)), numFmt: '[Red]h:mm:ss', style: {}, _address: 'L1' },
                        { type: 6, value: { formula: 'J1', result: 0.256 }, numFmt: '0.0%', style: { numFmt: '0.0%' }, _address: 'M1' },
                        { type: 6, value: { formula: '0', result: 0 }, style: {}, _address: 'N1' },
                        { type: 6, value: { formula: 'TRUE', result: true }, style: {}, _address: 'O1' },
                        { type: 6, value: { formula: 'NOW()', result: new Date(Date.UTC(2025, 0, 1, 8, 5, 9)) }, numFmt: 'HH:mm:ss', style: { numFmt: 'HH:mm:ss' }, _address: 'P1' },
                        ...Array.from({ length: 19 }, (_, idx) => ({
                            type: 3,
                            value: `c${idx}`,
                            style: { border: { top: { style: 'thin', color: { argb: 'INVALID' } } }, fill: { fgColor: { indexed: 0 } } },
                            _address: `Q${idx + 1}`
                        }))
                    ]
                },
                {
                    _hidden: true,
                    _cells: hiddenRowCells
                },
                null
            ]
        }]
    };

    const result = excelMod.transferExcelToSpreadSheet(mockWorkbook, { minColLength: 20, minRowLength: 100 });
    const sheet = result.workbookData[0];
    const row0 = sheet.rows[0].cells;

    assert.equal(row0[0].text, '1,234.56');
    assert.equal(row0[1].text, '-1,234.56');
    assert.equal(row0[2].text, '-');
    assert.equal(row0[3].text, '1,234.56');
    assert.equal(row0[4].text, '(1,234.56)');
    assert.equal(row0[5].text, '¥100.00');
    assert.equal(row0[6].text, '-¥100.00');
    assert.equal(row0[7].text, '¥100.00');
    assert.equal(row0[8].text, '88.50元');
    assert.equal(row0[9].text, '14%');
    assert.equal(row0[10].text, '#DIV/0!');
    assert.equal(row0[11].text, '09:30:45');
    assert.equal(row0[12].text, '25.6%');
    assert.equal(row0[13].text, '0');
    assert.equal(row0[14].text, 'TRUE');
    assert.equal(row0[15].text, '08:05:09');
    assert.equal(sheet.cols.len, 35);
    assert.equal(hiddenRowCells.length, 1);
    assert.equal(sheet.rows[1].height, 0.1);
    assert.equal(sheet.styles[row0[16].style].bgcolor, '#000000');
    assert.deepEqual(sheet.styles[row0[16].style].border.top, ['thin', '#000000']);
});

test('excel.js reads real fixture test.xlsx without error', async () => {
    const raw = fs.readFileSync(path.join(CORE_DIR, 'public/static/test-files/test.xlsx'));
    const ab = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
    const wb = await excelMod.readExcelData(ab, false);
    const { workbookData } = excelMod.transferExcelToSpreadSheet(wb, { minColLength: 20, minRowLength: 100 });
    assert.ok(workbookData.length >= 1);
    assert.ok(Object.keys(workbookData[0].rows).length > 1);
});

test('x-spreadsheet alphabet, cell formula fallback/unclosed quote, and DataProxy zero-text', async () => {
    assert.equal(stringAt(0), 'A');
    assert.equal(stringAt(25), 'Z');
    assert.equal(stringAt(26), 'AA');
    assert.equal(stringAt(701), 'ZZ');
    assert.equal(stringAt(702), 'AAA');
    assert.equal(stringAt(728), 'ABA');
    assert.deepEqual(expr2xy('AB12'), [27, 11]);
    assert.equal(xy2expr(728, 0), 'ABA1');

    const cellMod = loadStrippedModule('packages/vue-excel/src/x-spreadsheet/core/cell.js', {
        expr2xy,
        xy2expr,
        numberCalc: (op, a, b) => {
            if (op === '+') return String(Number(a) + Number(b));
            if (op === '-') return String(Number(a) - Number(b));
            if (op === '*') return String(Number(a) * Number(b));
            return String(Number(a) / Number(b));
        }
    });
    const formulaMap = { SUM: { render: ary => ary.reduce((a, b) => Number(a) + Number(b), 0) } };
    assert.equal(cellMod.render('=VLOOKUP(A1,B1:C2,2,0)', formulaMap, () => ''), '=VLOOKUP(A1,B1:C2,2,0)');
    assert.equal(cellMod.render('="unclosed', formulaMap, () => ''), 'unclosed');
    assert.equal(cellMod.render('=1+2', formulaMap, () => ''), '3');
    assert.equal(cellMod.render(0, formulaMap, () => ''), 0);

    const { mockDocument } = createDomMocks();
    const externalInput = mockDocument.createElement('input');
    const rootEl = mockDocument.createElement('div');
    const innerInput = mockDocument.createElement('input');
    rootEl.appendChild(innerInput);
    mockDocument.activeElement = externalInput;
    await runWithDomGlobals({ document: mockDocument }, () => {
        readOnlyInput(rootEl);
    });
    assert.equal(innerInput.readOnly, true);
    assert.notEqual(externalInput.blurred, true);
});
