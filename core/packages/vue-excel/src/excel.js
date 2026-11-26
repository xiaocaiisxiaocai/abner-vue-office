import * as Excel from 'exceljs/dist/exceljs';
import tinycolor from 'tinycolor2';
import cloneDeep from 'lodash/cloneDeep';
import get from 'lodash/get';
import { getDarkColor, getLightColor } from './color';
import dayjs from 'dayjs';
import { read, write } from 'xlsx';

const themeColor = [
    '#FFFFFF',
    '#000000',
    '#BFBFBF',
    '#323232',
    '#4472C4',
    '#ED7D31',
    '#A5A5A5',
    '#FFC000',
    '#5B9BD5',
    '#71AD47'
];

const indexedColor = [
    '#000000',
    '#FFFFFF',
    '#FF0000',
    '#00FF00',
    '#0000FF',
    '#FFFF00',
    '#FF00FF',
    '#00FFFF',
    '#000000',
    '#FFFFFF',
    '#FF0000',
    '#00FF00',
    '#0000FF',
    '#FFFF00',
    '#FF00FF',
    '#00FFFF',
    '#800000',
    '#008000',
    '#000080',
    '#808000',
    '#800080',
    '#008080',
    '#C0C0C0',
    '#808080',
    '#9999FF',
    '#993366',
    '#FFFFCC',
    '#CCFFFF',
    '#660066',
    '#FF8080',
    '#0066CC',
    '#CCCCFF',
    '#000080',
    '#FF00FF',
    '#FFFF00',
    '#00FFFF',
    '#800080',
    '#800000',
    '#008080',
    '#0000FF',
    '#00CCFF',
    '#CCFFFF',
    '#CCFFCC',
    '#FFFF99',
    '#99CCFF',
    '#FF99CC',
    '#CC99FF',
    '#FFCC99',
    '#3366FF',
    '#33CCCC',
    '#99CC00',
    '#FFCC00',
    '#FF9900',
    '#FF6600',
    '#666699',
    '#969696',
    '#003366',
    '#339966',
    '#003300',
    '#333300',
    '#993300',
    '#993366',
    '#333399',
    '#333333',
    '#000000'
];

let defaultColWidth = 80;
let defaultRowHeight = 24;
export function getData(src, options = {}) {
    if (src instanceof ArrayBuffer) {
        return Promise.resolve(src);
    }
    if (ArrayBuffer.isView(src)) {
        return Promise.resolve(src.buffer.slice(src.byteOffset, src.byteOffset + src.byteLength));
    }
    if (typeof Blob !== 'undefined' && src instanceof Blob) {
        return src.arrayBuffer();
    }
    if (typeof Response !== 'undefined' && src instanceof Response) {
        return src.arrayBuffer();
    }
    if (typeof src === 'string') {
        return requestExcel(src, options || {});
    }
    return Promise.reject(new Error('不支持的 src 格式'));
}

function requestExcel(src, options = {}) {
    const opts = options || {};
    return new Promise(function (resolve, reject) {
        const xhr = new XMLHttpRequest();
        const method = (opts.method || 'GET').trim();
        const isBodyless = /^(get|head)$/i.test(method);
        xhr.open(method, src, true);
        xhr.responseType = 'arraybuffer';
        xhr.onload = function () {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(xhr.response);
            } else {
                const err = new Error(`HTTP error! status: ${xhr.status}`);
                err.status = xhr.status;
                reject(err);
            }
        };
        xhr.onerror = function() {
            const err = new Error(`Network error! status: ${xhr.status}`);
            err.status = xhr.status;
            reject(err);
        };
        xhr.onabort = function() {
            reject(new Error('Request aborted'));
        };
        xhr.ontimeout = function() {
            reject(new Error('Request timeout'));
        };
        if (typeof opts.timeout === 'number' && Number.isFinite(opts.timeout) && opts.timeout >= 0) {
            xhr.timeout = opts.timeout;
        }
        xhr.withCredentials = Boolean(opts.withCredentials || opts.credentials === 'include');
        if (opts.headers) {
            Object.keys(opts.headers).forEach(function(key) {
                xhr.setRequestHeader(key, opts.headers[key]);
            });
        }

        xhr.send(isBodyless ? null : opts.body);
    });
}

export function readExcelData(buffer, xls){
    try {
        if(xls){
            const workbook = read(buffer, {type: 'array'});
            buffer = write(workbook, { bookType: 'xlsx', type: 'array' });
        }
        const wb = new Excel.Workbook();
        return wb.xlsx.load(buffer);

    }catch (e){
        console.warn(e);
        return Promise.reject(e);
    }
}


function transferColumns(excelSheet, spreadSheet, options, effectiveMaxColLen = 0){
    const rawColumns = excelSheet.columns || [];
    const minColLen = typeof options.minColLength === 'number' && Number.isFinite(options.minColLength) && options.minColLength >= 0
        ? options.minColLength
        : 0;
    const targetLen = Math.max(effectiveMaxColLen, minColLen);
    const limit = Math.min(rawColumns.length, targetLen);
    for(let i = 0; i < limit; i++){
        const col = rawColumns[i];
        spreadSheet.cols[i.toString()] = {};
        if(!col) {
            spreadSheet.cols[i.toString()].width = Math.max(1, defaultColWidth + (options.widthOffset || 0));
        }else if(col._hidden) {
            spreadSheet.cols[i.toString()].width = 0.1;
        }else if(col.width) {
            spreadSheet.cols[i.toString()].width = Math.max(1, col.width * 6 + (options.widthOffset || 0));
        } else {
            spreadSheet.cols[i.toString()].width = Math.max(1, defaultColWidth + (options.widthOffset || 0));
        }
    }
    if (options.widthOffset) {
        for (let i = limit; i < targetLen; i++) {
            spreadSheet.cols[i.toString()] = {
                width: Math.max(1, defaultColWidth + options.widthOffset)
            };
        }
    }

    spreadSheet.cols.len = Math.max(Object.keys(spreadSheet.cols).length, targetLen);
}

function formatExcelDate(val, fmt) {
    if (val == null) {
        return '';
    }
    const parsed = val instanceof Date
        ? dayjs(val).add(val.getTimezoneOffset(), 'minute')
        : dayjs(val);
    if (!parsed.isValid()) {
        return '';
    }
    return parsed.format(fmt);
}

function splitNumFmtSections(fmt) {
    const sections = [];
    let current = '';
    let inQuotes = false;
    let escaped = false;
    for (let i = 0; i < fmt.length; i++) {
        const ch = fmt[i];
        if (escaped) {
            current += ch;
            escaped = false;
            continue;
        }
        if (ch === '\\') {
            current += ch;
            escaped = true;
            continue;
        }
        if (ch === '"') {
            inQuotes = !inQuotes;
            current += ch;
            continue;
        }
        if (ch === ';' && !inQuotes) {
            sections.push(current);
            current = '';
            continue;
        }
        current += ch;
    }
    sections.push(current);
    return sections;
}

function extractTrailingQuotedSuffix(section) {
    const lastDigitIdx = Math.max(section.lastIndexOf('0'), section.lastIndexOf('#'), section.lastIndexOf('?'));
    if (lastDigitIdx === -1) {
        return '';
    }
    const tail = section.slice(lastDigitIdx + 1);
    const match = tail.match(/"([^"]+)"/);
    return match ? match[1] : '';
}

function formatNumberValue(value, cellNumFmt) {
    try {
        if (typeof value !== 'number') {
            return value != null ? String(value) : '';
        }
        if (!Number.isFinite(value)) {
            return String(value);
        }
        if (cellNumFmt && typeof cellNumFmt === 'string') {
            const sections = splitNumFmtSections(cellNumFmt);
            let section = sections[0] || '';
            let useAbsForNegSection = false;
            if (value < 0 && sections[1]) {
                section = sections[1];
                useAbsForNegSection = true;
            } else if (value === 0 && sections[2]) {
                section = sections[2];
            }

            const currencyMatch = section.match(/\[\$([^-\]]+)/);
            let bracketCurrency = '';
            if (currencyMatch && currencyMatch[1]) {
                bracketCurrency = currencyMatch[1];
            }
            const cleanSection = section.replace(/\[[^\]]*\]/g, '');
            const patternOnly = cleanSection.replace(/"[^"]*"/g, '').replace(/[_*\\]./g, '');

            if (value === 0 && !/[0#]/.test(patternOnly)) {
                const zeroQuoted = cleanSection.match(/"([^"]+)"/);
                if (zeroQuoted) {
                    return zeroQuoted[1];
                }
                if (patternOnly.includes('-')) {
                    return '-';
                }
                if (!patternOnly.includes('?')) {
                    return '';
                }
            }

            const isParenNeg = useAbsForNegSection && /\(.*[0#?].*\)/.test(patternOnly);
            const hasExplicitMinus = useAbsForNegSection && /-/.test(patternOnly);
            const isPercent = patternOnly.includes('%');

            if (isPercent) {
                const rawScaled = (useAbsForNegSection ? Math.abs(value) : value) * 100;
                const pctDecMatch = patternOnly.match(/\.([0#?]+)/);
                let pctResult;
                if (pctDecMatch) {
                    const maxDec = pctDecMatch[1].length;
                    const minDec = (pctDecMatch[1].match(/0/g) || []).length;
                    pctResult = rawScaled.toFixed(maxDec);
                    if (maxDec > minDec && pctResult.includes('.')) {
                        const [intPart, fracPart] = pctResult.split('.');
                        let trimmedFrac = fracPart;
                        while (trimmedFrac.length > minDec && trimmedFrac.endsWith('0')) {
                            trimmedFrac = trimmedFrac.slice(0, -1);
                        }
                        pctResult = trimmedFrac.length > 0 ? `${intPart}.${trimmedFrac}` : intPart;
                    }
                } else {
                    pctResult = String(parseFloat(rawScaled.toFixed(12)));
                }
                if (/^-[0]+(\.[0]+)?$/.test(pctResult)) {
                    pctResult = pctResult.slice(1);
                }
                if (isParenNeg) {
                    return `(${pctResult}%)`;
                }
                if (value < 0 && hasExplicitMinus && !pctResult.startsWith('-') && !/^0(\.0+)?$/.test(pctResult)) {
                    return `-${pctResult}%`;
                }
                return `${pctResult}%`;
            }

            if (/[0#?]/.test(patternOnly)) {
                const numVal = useAbsForNegSection ? Math.abs(value) : value;

                let prefix = '';
                const firstDigitIdx = cleanSection.search(/[0#?]/);
                const leadingPart = firstDigitIdx > 0 ? cleanSection.slice(0, firstDigitIdx) : '';
                if (bracketCurrency) {
                    prefix = bracketCurrency;
                } else {
                    const quotedPrefix = leadingPart.match(/"([^"]+)"/);
                    if (quotedPrefix && quotedPrefix[1]) {
                        prefix = quotedPrefix[1];
                    } else if (leadingPart.includes('$')) {
                        prefix = '$';
                    } else if (leadingPart.includes('¥')) {
                        prefix = '¥';
                    } else if (leadingPart.includes('￥')) {
                        prefix = '￥';
                    } else if (leadingPart.includes('€')) {
                        prefix = '€';
                    } else if (leadingPart.includes('£')) {
                        prefix = '£';
                    }
                }

                const decMatch = patternOnly.match(/\.([0#?]+)/);
                const maxDec = decMatch ? decMatch[1].length : 0;
                const minDec = decMatch ? (decMatch[1].match(/0/g) || []).length : 0;

                let result = numVal.toFixed(maxDec);
                if (maxDec > minDec && result.includes('.')) {
                    const [intPart, fracPart] = result.split('.');
                    let trimmedFrac = fracPart;
                    while (trimmedFrac.length > minDec && trimmedFrac.endsWith('0')) {
                        trimmedFrac = trimmedFrac.slice(0, -1);
                    }
                    result = trimmedFrac.length > 0 ? `${intPart}.${trimmedFrac}` : intPart;
                }
                if (/^-[0]+(\.[0]+)?$/.test(result)) {
                    result = result.slice(1);
                }

                const intPattern = patternOnly.split('.')[0];
                const intZeroCount = (intPattern.match(/0/g) || []).length;
                if (!patternOnly.includes(',') && intZeroCount > 1) {
                    const parts = result.split('.');
                    const neg = parts[0].startsWith('-');
                    const absDigits = neg ? parts[0].slice(1) : parts[0];
                    if (absDigits.length < intZeroCount) {
                        parts[0] = (neg ? '-' : '') + absDigits.padStart(intZeroCount, '0');
                        result = parts.join('.');
                    }
                }

                if (/[#0],[#0]/.test(patternOnly)) {
                    const parts = result.split('.');
                    const digits = parts[0].split('').reverse();
                    const formatted = [];
                    for (let i = 0; i < digits.length; i++) {
                        formatted.push(digits[i]);
                        if ((i + 1) % 3 === 0 && i < digits.length - 1 && digits[i + 1] !== '-') {
                            formatted.push(',');
                        }
                    }
                    parts[0] = formatted.reverse().join('');
                    result = parts.join('.');
                }

                const suffix = extractTrailingQuotedSuffix(cleanSection);
                if (isParenNeg) {
                    return `(${prefix}${result}${suffix})`;
                }
                if (result.startsWith('-')) {
                    return `-${prefix}${result.slice(1)}${suffix}`;
                }
                if (value < 0 && hasExplicitMinus && !/^0(\.0+)?$/.test(result)) {
                    return `-${prefix}${result}${suffix}`;
                }
                return `${prefix}${result}${suffix}`;
            }
        }
        return String(value);
    } catch (e) {
        return value != null ? String(value) : '';
    }
}

function formatExcelDateByNumFmt(val, numFmt) {
    switch (numFmt) {
        case 'yyyy-mm-dd;@':
            return formatExcelDate(val, 'YYYY-MM-DD');
        case 'mm-dd-yy':
            return formatExcelDate(val, 'YYYY/MM/DD');
        case '[$-F800]dddd, mmmm dd, yyyy':
            return formatExcelDate(val, 'YYYY年M月D日 ddd');
        case 'm"月"d"日";@':
            return formatExcelDate(val, 'M月D日');
        case 'yyyy/m/d h:mm;@':
        case 'm/d/yy "h":mm':
            return formatExcelDate(val, 'YYYY/M/DD HH:mm');
        case 'h:mm;@':
            return formatExcelDate(val, 'HH:mm');
        default: {
            const cleanFmt = typeof numFmt === 'string' ? numFmt.replace(/\[[^\]]*\]/g, '') : '';
            if (cleanFmt && /h{1,2}:m{1,2}:s{1,2}/i.test(cleanFmt)) {
                return formatExcelDate(val, /y|d/i.test(cleanFmt) ? 'YYYY-MM-DD HH:mm:ss' : 'HH:mm:ss');
            }
            if (cleanFmt && /h{1,2}:m{1,2}/i.test(cleanFmt)) {
                return formatExcelDate(val, /y|d/i.test(cleanFmt) ? 'YYYY-MM-DD HH:mm' : 'HH:mm');
            }
            return formatExcelDate(val, 'YYYY-MM-DD');
        }
    }
}

function getCellText(cell){
    const { numFmt, value, type } = cell;
    const cellNumFmt = (cell.style && cell.style.numFmt) || numFmt;
    switch (type){
        case 2: //数字
            return formatNumberValue(value, cellNumFmt);

        case 3: //字符串
            return value != null ? String(value) : '';
        case 4: //日期
            return formatExcelDateByNumFmt(value, cellNumFmt);

        case 5: //超链接
            if (!value) {
                return '';
            }
            if (value.text && typeof value.text === 'object' && Array.isArray(value.text.richText)) {
                return value.text.richText.map(item => item.text || '').join('');
            }
            return value.text || value.hyperlink || '';
        case 6: //公式
            if (!value) {
                return '';
            }
            if (get(value, 'result.error')) {
                return get(value, 'result.error');
            }
            if (value.result instanceof Date) {
                return formatExcelDateByNumFmt(value.result, cellNumFmt);
            }
            if (typeof value.result === 'number') {
                return formatNumberValue(value.result, cellNumFmt);
            }
            if (typeof value.result === 'boolean') {
                return String(value.result).toUpperCase();
            }
            if (value.result && typeof value.result === 'object' && Array.isArray(value.result.richText)) {
                return value.result.richText.map(item => item.text || '').join('');
            }
            if (value.result === undefined || value.result === null) {
                return '';
            }
            return String(value.result);
        case 8: //富文本
            if (typeof cell.text === 'string' && cell.text.length > 0) {
                return cell.text;
            }
            if (value && Array.isArray(value.richText)) {
                return value.richText.map(item => item.text || '').join('');
            }
            return cell.text || '';
        case 9: //Boolean
        {
            const boolVal = value !== undefined && value !== null ? value : cell.text;
            return boolVal !== undefined && boolVal !== null ? String(boolVal).toUpperCase() : '';
        }
        case 10: //Error
            return (value && value.error) || (cell.text && cell.text.error) || '';
        default:
            if (value == null) {
                return '';
            }
            if (typeof value === 'object') {
                return value.error || value.text || '';
            }
            return String(value);
    }
}
function transferArgbColor(originColor){
    if(!originColor || typeof originColor !== 'string'){
        return '#000000';
    }
    originColor = originColor.trim();
    if(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.test(originColor)){
        return originColor.startsWith('#') ? originColor : '#' + originColor;
    }
    originColor = originColor.toLowerCase(); //去掉前后空格
    let color = {};
    try {
        let argb = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(originColor);
        if (!argb) {
            return null;
        }
        color.r = parseInt(argb[2], 16);
        color.g = parseInt(argb[3], 16);
        color.b = parseInt(argb[4], 16);
        color.a = parseInt(argb[1], 16) / 255;
        return tinycolor(`rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`).toHexString();
    } catch (e) {
        console.warn(e);
        return null;
    }
}
function transferThemeColor(themeIndex, tint){
    if(typeof themeIndex !== 'number' || themeIndex < 0 || themeIndex >= themeColor.length){
        return '#C7C9CC';
    }
    if(typeof tint === 'undefined'){
        return themeColor[themeIndex];
    }else if(tint > 0){
        return getLightColor(themeColor[themeIndex], tint);
    }else{
        return getDarkColor(themeColor[themeIndex],Math.abs(tint));
    }
}
function getStyle(cell){
    const style = cloneDeep(cell.style || {});
    let backGroundColor = null;
    if(style.fill && style.fill.fgColor && !(style.fill.type === 'pattern' && style.fill.pattern === 'none')) {
        // 8位字符颜色先转rgb再转16进制颜色
        if(style.fill.fgColor.argb){
            backGroundColor = transferArgbColor(style.fill.fgColor.argb);
        }else if(Object.prototype.hasOwnProperty.call(style.fill.fgColor, 'theme')){
            backGroundColor = transferThemeColor(style.fill.fgColor.theme, style.fill.fgColor.tint);
        }else if(typeof style.fill.fgColor.indexed === 'number'){
            backGroundColor = indexedColor[style.fill.fgColor.indexed] || '#C7C9CC';
        }else{
            backGroundColor = '#C7C9CC';
        }

    }

    if(backGroundColor) {
        style.bgcolor = backGroundColor;
    }
    //*************************************************************************** */

    //*********************字体存在背景色******************************
    // 字体颜色
    let fontColor = null;
    if(style.font && style.font.color ) {
        if(style.font.color.argb){
            fontColor = transferArgbColor(style.font.color.argb);
        }else if(Object.prototype.hasOwnProperty.call(style.font.color, 'theme')){
            fontColor = transferThemeColor(style.font.color.theme, style.font.color.tint);
        }else if(typeof style.font.color.indexed === 'number'){
            fontColor = indexedColor[style.font.color.indexed] || '#000000';
        }else {
            fontColor = '#000000';
        }

    }
    if(fontColor) {
        style.color = fontColor;
    }

    // exceljs 对齐的格式转成 x-date-spreedsheet 能识别的对齐格式
    if(style.alignment ) {
        if(style.alignment.horizontal){
            style.align = style.alignment.horizontal;
        }
        if(style.alignment.vertical){
            style.valign = style.alignment.vertical;
        }
    }
    if(style.alignment && style.alignment.wrapText) {
        style.textwrap = true;
    }

    if(style.border){
        let styleBorder = {};
        Object.keys(style.border).forEach(position =>{
            let originBorder = style.border[position];
            if (!originBorder) {
                return;
            }
            let bordColor = '#000000';

            if(typeof originBorder.color === 'string'){
                bordColor = originBorder.color;
            }else if(originBorder.color){
                if(originBorder.color.argb){
                    bordColor = transferArgbColor(originBorder.color.argb) || '#000000';
                }else if(Object.prototype.hasOwnProperty.call(originBorder.color, 'theme')){
                    bordColor = transferThemeColor(originBorder.color.theme, originBorder.color.tint);
                }else if(typeof originBorder.color.indexed === 'number'){
                    bordColor = indexedColor[originBorder.color.indexed] || '#000000';
                }
            }
            styleBorder[position] = [originBorder.style || 'thin', bordColor];
        });
        style.border2 = {...style.border};
        style.border = styleBorder;
    }

    if(style.font && typeof style.font.size === 'number' && style.font.size > 0){
        style.font.size = Math.max(1, Math.round(style.font.size / 1.333333));
    }
    return style;
}

export function transferExcelToSpreadSheet(workbook, options = {}){
    const opts = options || {};
    let workbookData = [];
    let sheets = [];
    workbook.eachSheet((sheet) => {
        sheets.push(sheet);
        // 构造x-data-spreadsheet 的 sheet 数据源结构
        let sheetData = { name: sheet.name,styles : [], rows: {},cols:{}, merges:[],media:[] };
        // 收集合并单元格信息
        const mergeMap = new Map();
        const styleMap = new Map();
        let effectiveMaxColLen = 0; //真正有数据的列长度，有时excel会展示一堆没数据的列
        let effectiveMaxRowLen = 0;
        for(let mergeRange in sheet._merges) {
            if (!Object.prototype.hasOwnProperty.call(sheet._merges, mergeRange)) {
                continue;
            }
            sheetData.merges.push(sheet._merges[mergeRange].shortRange);
            let mergeAddress = {};
            // 合并单元格起始地址
            mergeAddress.startAddress = sheet._merges[mergeRange].tl;
            // 合并单元格终止地址
            mergeAddress.endAddress = sheet._merges[mergeRange].br;
            // Y轴方向跨度
            mergeAddress.YRange = sheet._merges[mergeRange].model.bottom - sheet._merges[mergeRange].model.top;
            // X轴方向跨度
            mergeAddress.XRange = sheet._merges[mergeRange].model.right - sheet._merges[mergeRange].model.left;
            effectiveMaxColLen = Math.max(effectiveMaxColLen, sheet._merges[mergeRange].model.right || 0);
            effectiveMaxRowLen = Math.max(effectiveMaxRowLen, sheet._merges[mergeRange].model.bottom || 0);
            mergeMap.set(mergeAddress.startAddress, mergeAddress);
        }

        // 遍历行
        (sheet._rows || []).forEach((row, spreadSheetRowIndex) =>{
            if (!row) {
                return;
            }
            sheetData.rows[spreadSheetRowIndex] = { cells: {} };
            if(row._hidden){
                sheetData.rows[spreadSheetRowIndex].height = 0.1;
                return;
            }else if(row.height){
                sheetData.rows[spreadSheetRowIndex].height = Math.max(1, row.height + (opts.heightOffset || 0));
            }else{
                sheetData.rows[spreadSheetRowIndex].height = Math.max(1, defaultRowHeight + (opts.heightOffset || 0));
            }
            //includeEmpty = false 不包含空白单元格
            (row._cells || []).forEach((cell, spreadSheetColIndex) =>{
                if (!cell) {
                    return;
                }
                sheetData.rows[spreadSheetRowIndex].cells[spreadSheetColIndex] = {};
                effectiveMaxColLen = Math.max(effectiveMaxColLen, spreadSheetColIndex + 1);

                if (cell.isMerged && cell.master && cell.master.address !== cell._address) {
                    return;
                }
                const mergeAddress = mergeMap.get(cell._address);
                if(mergeAddress){
                    sheetData.rows[spreadSheetRowIndex].cells[spreadSheetColIndex].merge = [mergeAddress.YRange, mergeAddress.XRange];
                }
                sheetData.rows[spreadSheetRowIndex].cells[spreadSheetColIndex].text = getCellText(cell);
                const cellStyle = getStyle(cell);
                const styleKey = JSON.stringify(cellStyle);
                let styleIndex = styleMap.get(styleKey);
                if (styleIndex === undefined) {
                    styleIndex = sheetData.styles.length;
                    sheetData.styles.push(cellStyle);
                    styleMap.set(styleKey, styleIndex);
                }
                sheetData.rows[spreadSheetRowIndex].cells[spreadSheetColIndex].style = styleIndex;
            });
        });
        if(sheet._media){
            sheetData.media = sheet._media;
            (sheet._media || []).forEach(media => {
                const brCol = media && media.range && media.range.br && media.range.br.nativeCol;
                const tlCol = media && media.range && media.range.tl && media.range.tl.nativeCol;
                const brRow = media && media.range && media.range.br && media.range.br.nativeRow;
                const tlRow = media && media.range && media.range.tl && media.range.tl.nativeRow;
                if (typeof brCol === 'number') {
                    effectiveMaxColLen = Math.max(effectiveMaxColLen, brCol + 1);
                } else if (typeof tlCol === 'number') {
                    effectiveMaxColLen = Math.max(effectiveMaxColLen, tlCol + 1);
                }
                if (typeof brRow === 'number') {
                    effectiveMaxRowLen = Math.max(effectiveMaxRowLen, brRow + 1);
                } else if (typeof tlRow === 'number') {
                    effectiveMaxRowLen = Math.max(effectiveMaxRowLen, tlRow + 1);
                }
            });
        }

        let tempRowsKeys = Object.keys(sheetData.rows);
        const maxRowLen = tempRowsKeys.length ? +tempRowsKeys[tempRowsKeys.length - 1] + 1 : 0;
        const minRowLen = typeof opts.minRowLength === 'number' && Number.isFinite(opts.minRowLength) && opts.minRowLength >= 0
            ? opts.minRowLength
            : 100;

        sheetData.rows.len = Math.max(maxRowLen, effectiveMaxRowLen, minRowLen);

        transferColumns(sheet, sheetData, opts, effectiveMaxColLen);
        workbookData.push(sheetData);
    });
    workbook._worksheets = sheets;
    return {
        workbookData,
        workbookSource: workbook,
        medias: workbook.media || []
    };
}