import * as Excel from 'exceljs/dist/exceljs';
import tinycolor from 'tinycolor2';
import get from 'lodash/get';
import { getDarkColor, getLightColor } from './color';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { read, write } from 'xlsx';

dayjs.extend(utc);

const themeColor = [
    '#FFFFFF',
    '#000000',
    '#E7E6E6',
    '#44546A',
    '#4472C4',
    '#ED7D31',
    '#A5A5A5',
    '#FFC000',
    '#5B9BD5',
    '#70AD47',
    '#0563C1',
    '#954F72'
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
    '#000000',
    '#FFFFFF'
];

const THEME_TAG_SLOTS = {
    lt1: 0,
    dk1: 1,
    lt2: 2,
    dk2: 3,
    accent1: 4,
    accent2: 5,
    accent3: 6,
    accent4: 7,
    accent5: 8,
    accent6: 9,
    hlink: 10,
    folHlink: 11
};

function extractWorkbookThemeColors(workbook) {
    const palette = themeColor.slice();
    const themeXml = workbook && workbook._themes && typeof workbook._themes.theme1 === 'string'
        ? workbook._themes.theme1
        : '';
    if (!themeXml) {
        return palette;
    }
    const clrSchemeMatch = themeXml.match(/<a:clrScheme\b[^>]*>([\s\S]*?)<\/a:clrScheme>/i);
    if (!clrSchemeMatch) {
        return palette;
    }
    const schemeBody = clrSchemeMatch[1];
    Object.keys(THEME_TAG_SLOTS).forEach(tag => {
        const slot = THEME_TAG_SLOTS[tag];
        const tagMatch = schemeBody.match(new RegExp(`<a:${tag}\\b[^>]*>([\\s\\S]*?)<\\/a:${tag}>`, 'i'));
        if (!tagMatch) {
            return;
        }
        const inner = tagMatch[1];
        const srgb = inner.match(/\bsrgbClr\b[^>]*\bval=["']([0-9a-fA-F]{6})["']/i);
        if (srgb && srgb[1]) {
            palette[slot] = '#' + srgb[1].toUpperCase();
            return;
        }
        const sysClr = inner.match(/\bsysClr\b[^>]*\blastClr=["']([0-9a-fA-F]{6})["']/i);
        if (sysClr && sysClr[1]) {
            palette[slot] = '#' + sysClr[1].toUpperCase();
        }
    });
    return palette;
}

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
        if (opts.signal && opts.signal.aborted) {
            reject(new Error('Request aborted'));
            return;
        }
        const xhr = new XMLHttpRequest();
        const method = (typeof opts.method === 'string' && opts.method.trim()) || 'GET';
        const isBodyless = /^(get|head)$/i.test(method);
        let settled = false;
        let onSignalAbort = null;
        function cleanup() {
            if (settled) {
                return;
            }
            settled = true;
            if (opts.signal && onSignalAbort && typeof opts.signal.removeEventListener === 'function') {
                opts.signal.removeEventListener('abort', onSignalAbort);
            }
        }
        xhr.open(method, src, true);
        xhr.responseType = 'arraybuffer';
        xhr.onload = function () {
            cleanup();
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(xhr.response);
            } else {
                const err = new Error(`HTTP error! status: ${xhr.status}`);
                err.status = xhr.status;
                reject(err);
            }
        };
        xhr.onerror = function() {
            cleanup();
            const err = new Error(`Network error! status: ${xhr.status}`);
            err.status = xhr.status;
            reject(err);
        };
        xhr.onabort = function() {
            cleanup();
            reject(new Error('Request aborted'));
        };
        xhr.ontimeout = function() {
            cleanup();
            reject(new Error('Request timeout'));
        };
        if (typeof opts.timeout === 'number' && Number.isFinite(opts.timeout) && opts.timeout >= 0) {
            xhr.timeout = opts.timeout;
        }
        xhr.withCredentials = Boolean(opts.withCredentials || opts.credentials === 'include');
        if (opts.headers) {
            if (Array.isArray(opts.headers)) {
                opts.headers.forEach(function (pair) {
                    if (Array.isArray(pair) && pair.length >= 2 && pair[0] != null && pair[1] != null) {
                        xhr.setRequestHeader(String(pair[0]), String(pair[1]));
                    }
                });
            } else if (typeof opts.headers.forEach === 'function') {
                opts.headers.forEach(function (val, key) {
                    if (key != null && val != null) {
                        xhr.setRequestHeader(String(key), String(val));
                    }
                });
            } else {
                Object.keys(opts.headers).forEach(function(key) {
                    const val = opts.headers[key];
                    if (val != null) {
                        xhr.setRequestHeader(key, String(val));
                    }
                });
            }
        }
        if (opts.signal && typeof opts.signal.addEventListener === 'function') {
            onSignalAbort = function () {
                cleanup();
                if (typeof xhr.abort === 'function') {
                    xhr.abort();
                }
                reject(new Error('Request aborted'));
            };
            opts.signal.addEventListener('abort', onSignalAbort, { once: true });
        }

        xhr.send(isBodyless ? null : opts.body);
    });
}

export function readExcelData(buffer, xls){
    try {
        if(xls){
            const workbook = read(buffer, { type: 'array', cellNF: true, cellStyles: true });
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
        }else if(col._hidden || col.width === 0) {
            spreadSheet.cols[i.toString()].hide = true;
        }else if(typeof col.width === 'number') {
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
        ? dayjs.utc(val)
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

function findDigitPlaceholderBounds(section) {
    let first = -1;
    let last = -1;
    let inQuotes = false;
    let inBrackets = false;
    let escaped = false;
    for (let i = 0; i < section.length; i++) {
        const ch = section[i];
        if (escaped) {
            escaped = false;
            continue;
        }
        if (ch === '\\') {
            escaped = true;
            continue;
        }
        if (ch === '"') {
            inQuotes = !inQuotes;
            continue;
        }
        if (!inQuotes) {
            if (ch === '[') {
                inBrackets = true;
                continue;
            }
            if (ch === ']' && inBrackets) {
                inBrackets = false;
                continue;
            }
            if (!inBrackets && (ch === '0' || ch === '#' || ch === '?')) {
                if (first === -1) {
                    first = i;
                }
                last = i;
            }
        }
    }
    return { first, last };
}

function extractEdgeLiterals(segment, { allowPercent = true, allowCurrencyFallback = false } = {}) {
    let out = '';
    let hasExplicitLiteral = false;
    let pendingSpace = '';
    for (let i = 0; i < segment.length; i++) {
        const ch = segment[i];
        if (ch === '\\' && i + 1 < segment.length) {
            out += pendingSpace + segment[i + 1];
            pendingSpace = '';
            hasExplicitLiteral = true;
            i += 1;
            continue;
        }
        if (ch === '"') {
            const closeIdx = segment.indexOf('"', i + 1);
            const quoted = closeIdx === -1 ? segment.slice(i + 1) : segment.slice(i + 1, closeIdx);
            out += pendingSpace + quoted;
            pendingSpace = '';
            hasExplicitLiteral = true;
            i = closeIdx === -1 ? segment.length : closeIdx;
            continue;
        }
        if (ch === '[') {
            const closeIdx = segment.indexOf(']', i + 1);
            const bracket = closeIdx === -1 ? segment.slice(i + 1) : segment.slice(i + 1, closeIdx);
            const curMatch = bracket.match(/^\$([^-]*)/);
            if (curMatch && curMatch[1]) {
                out += pendingSpace + curMatch[1];
                pendingSpace = '';
                hasExplicitLiteral = true;
            }
            i = closeIdx === -1 ? segment.length : closeIdx;
            continue;
        }
        if (ch === '_' || ch === '*') {
            i += 1;
            continue;
        }
        if (ch === ' ') {
            if (out) {
                pendingSpace += ' ';
            } else {
                pendingSpace = ' ';
            }
            continue;
        }
        if (allowPercent && ch === '%') {
            out += pendingSpace + '%';
            pendingSpace = '';
            hasExplicitLiteral = true;
            continue;
        }
        if (allowCurrencyFallback && (ch === '$' || ch === '¥' || ch === '￥' || ch === '€' || ch === '£')) {
            out += ch;
            pendingSpace = '';
            hasExplicitLiteral = true;
        }
    }
    return { text: out, hasExplicitLiteral };
}

function countTrailingScalingCommas(section, lastDigitIdx) {
    if (lastDigitIdx < 0) {
        return 0;
    }
    let count = 0;
    for (let i = lastDigitIdx + 1; i < section.length; i++) {
        if (section[i] === ',') {
            count += 1;
        } else {
            break;
        }
    }
    return count;
}

function formatFixedDecimals(numVal, maxDec, minDec) {
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
    return result;
}

function applyIntegerPaddingAndGrouping(result, patternWithoutSci) {
    const intPattern = patternWithoutSci.split('.')[0];
    const intZeroCount = (intPattern.match(/0/g) || []).length;
    if (!patternWithoutSci.includes(',') && intZeroCount > 1 && !result.includes('e') && !result.includes('E')) {
        const parts = result.split('.');
        const neg = parts[0].startsWith('-');
        const absDigits = neg ? parts[0].slice(1) : parts[0];
        if (absDigits.length < intZeroCount) {
            parts[0] = (neg ? '-' : '') + absDigits.padStart(intZeroCount, '0');
            result = parts.join('.');
        }
    }
    if (/[#0?],[#0?]/.test(patternWithoutSci) && !result.includes('e') && !result.includes('E')) {
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
    return result;
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
            const hasExplicitNegSection = value < 0 && sections.length > 1;
            const hasExplicitZeroSection = value === 0 && sections.length > 2;
            if (hasExplicitNegSection) {
                section = sections[1];
                useAbsForNegSection = true;
            } else if (hasExplicitZeroSection) {
                section = sections[2];
            }

            const cleanSection = section.replace(/\[\$([^-\]]+)[^\]]*\]/g, '[$1]').replace(/\[(?![^\]]*\$)[^\]]*\]/g, '');
            const patternOnly = cleanSection.replace(/\[[^\]]*\]/g, '').replace(/"[^"]*"/g, '').replace(/[_*\\]./g, '');

            if ((hasExplicitNegSection || hasExplicitZeroSection || value === 0) && !/[0#]/.test(patternOnly)) {
                const trimPattern = patternOnly.trim();
                if (!/^(General|@)$/i.test(trimPattern)) {
                    const quotedLiteral = cleanSection.match(/"([^"]+)"/);
                    if (quotedLiteral) {
                        return quotedLiteral[1];
                    }
                    if (patternOnly.includes('-')) {
                        return '-';
                    }
                    if (!patternOnly.includes('?')) {
                        return '';
                    }
                }
            }

            const { first: firstDigitIdx, last: lastDigitIdx } = findDigitPlaceholderBounds(section);
            if (firstDigitIdx !== -1 && /[0#?]/.test(patternOnly)) {
                let numVal = useAbsForNegSection ? Math.abs(value) : value;
                const scalingCommas = countTrailingScalingCommas(section, lastDigitIdx);
                if (scalingCommas > 0) {
                    numVal = numVal / Math.pow(1000, scalingCommas);
                }

                const leadingSeg = section.slice(0, firstDigitIdx);
                const trailingSeg = section.slice(lastDigitIdx + 1 + scalingCommas);
                const prefixInfo = extractEdgeLiterals(leadingSeg, { allowPercent: false, allowCurrencyFallback: true });
                const suffixInfo = extractEdgeLiterals(trailingSeg, { allowPercent: true, allowCurrencyFallback: false });
                const prefix = prefixInfo.text;
                let suffix = suffixInfo.text;

                const isParenNeg = useAbsForNegSection && /\(.*[0#?].*\)/.test(patternOnly);
                const hasExplicitMinus = useAbsForNegSection && /-/.test(patternOnly);
                const isPercent = patternOnly.includes('%');
                const sciMatch = patternOnly.match(/([0#?]+(?:\.([0#?]+))?)[eE]([+-])([0#?]+)/);

                let result;
                if (sciMatch) {
                    const mantissaDec = sciMatch[2] || '';
                    const maxDec = mantissaDec.length;
                    const minDec = (mantissaDec.match(/0/g) || []).length;
                    const expSignCfg = sciMatch[3];
                    const expMinDigits = (sciMatch[4].match(/0/g) || []).length || 1;
                    if (numVal === 0) {
                        const mant = formatFixedDecimals(0, maxDec, minDec);
                        const expSign = expSignCfg === '+' ? '+' : '';
                        result = `${mant}E${expSign}${'0'.repeat(expMinDigits)}`;
                    } else {
                        const neg = numVal < 0;
                        const absVal = Math.abs(numVal);
                        let exp = Math.floor(Math.log10(absVal));
                        let mant = absVal / Math.pow(10, exp);
                        if (Number(mant.toFixed(maxDec)) >= 10) {
                            mant /= 10;
                            exp += 1;
                        }
                        const mantStr = formatFixedDecimals(mant, maxDec, minDec);
                        const expSign = exp < 0 ? '-' : (expSignCfg === '+' ? '+' : '');
                        const expDigits = String(Math.abs(exp)).padStart(expMinDigits, '0');
                        result = `${neg ? '-' : ''}${mantStr}E${expSign}${expDigits}`;
                    }
                } else {
                    if (isPercent) {
                        numVal = numVal * 100;
                        if (!suffix.includes('%')) {
                            suffix = `%${suffix}`;
                        }
                    }
                    const coreNumPattern = patternOnly.replace(/,+$/, '');
                    const decMatch = coreNumPattern.match(/\.([0#?]+)/);
                    const maxDec = decMatch ? decMatch[1].length : 0;
                    const minDec = decMatch ? (decMatch[1].match(/0/g) || []).length : 0;
                    result = formatFixedDecimals(numVal, maxDec, minDec);
                    result = applyIntegerPaddingAndGrouping(result, coreNumPattern);
                }

                if (isParenNeg) {
                    return `(${prefix}${result}${suffix})`;
                }
                if (result.startsWith('-')) {
                    return `-${prefix}${result.slice(1)}${suffix}`;
                }
                if (value < 0 && hasExplicitMinus && !/^0+(\.0+)?(E[+-]0+)?$/.test(result)) {
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

const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30, 0, 0, 0);
const CN_WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function formatElapsedDuration(val, rawFmt) {
    const ms = val instanceof Date
        ? val.getTime() - EXCEL_EPOCH_MS
        : Number(val) * 86400000;
    if (!Number.isFinite(ms)) {
        return '';
    }
    const sign = ms < 0 ? '-' : '';
    const totalSec = Math.round(Math.abs(ms) / 1000);
    if (/\[h+\]/i.test(rawFmt)) {
        const hours = Math.floor(totalSec / 3600);
        const mins = Math.floor((totalSec % 3600) / 60);
        const secs = totalSec % 60;
        const padH = rawFmt.match(/\[(h+)\]/i)[1].length > 1 ? String(hours).padStart(2, '0') : String(hours);
        if (/s/i.test(rawFmt.replace(/"[^"]*"/g, ''))) {
            return `${sign}${padH}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }
        return `${sign}${padH}:${String(mins).padStart(2, '0')}`;
    }
    if (/\[m+\]/i.test(rawFmt)) {
        const mins = Math.floor(totalSec / 60);
        const secs = totalSec % 60;
        const padM = rawFmt.match(/\[(m+)\]/i)[1].length > 1 ? String(mins).padStart(2, '0') : String(mins);
        if (/s/i.test(rawFmt.replace(/"[^"]*"/g, ''))) {
            return `${sign}${padM}:${String(secs).padStart(2, '0')}`;
        }
        return `${sign}${padM}`;
    }
    const secWidth = rawFmt.match(/\[(s+)\]/i)[1].length;
    const padS = secWidth > 1 ? String(totalSec).padStart(secWidth, '0') : String(totalSec);
    return `${sign}${padS}`;
}

function formatExcelDateByNumFmt(val, numFmt) {
    if (typeof numFmt === 'string' && /\[(?:h+|m+|s+)\]/i.test(numFmt)) {
        return formatElapsedDuration(val, numFmt);
    }
    switch (numFmt) {
        case 'yyyy-mm-dd;@':
            return formatExcelDate(val, 'YYYY-MM-DD');
        case 'mm-dd-yy':
            return formatExcelDate(val, 'YYYY/MM/DD');
        case '[$-F800]dddd, mmmm dd, yyyy': {
            if (val == null) return '';
            const parsed = val instanceof Date ? dayjs.utc(val) : dayjs(val);
            if (!parsed.isValid()) return '';
            return `${parsed.format('YYYY年M月D日')} ${CN_WEEKDAYS[parsed.day()]}`;
        }
        case 'm"月"d"日";@':
            return formatExcelDate(val, 'M月D日');
        case 'yyyy/m/d h:mm;@':
        case 'm/d/yy "h":mm':
            return formatExcelDate(val, 'YYYY/M/DD HH:mm');
        case 'h:mm;@':
            return formatExcelDate(val, 'HH:mm');
        default: {
            const cleanNoBracket = typeof numFmt === 'string' ? numFmt.replace(/\[[^\]]*\]/g, '') : '';
            const tokensOnly = cleanNoBracket.replace(/"[^"]*"/g, '').replace(/\\./g, '');
            const hasAmPm = /\b(?:am\/pm|a\/p)\b/i.test(tokensOnly);
            if (tokensOnly && /h{1,2}:m{1,2}:s{1,2}/i.test(tokensOnly)) {
                const timeFmt = hasAmPm ? 'h:mm:ss A' : 'HH:mm:ss';
                return formatExcelDate(val, /y|d/i.test(tokensOnly) ? `YYYY-MM-DD ${timeFmt}` : timeFmt);
            }
            if (tokensOnly && /h{1,2}:m{1,2}/i.test(tokensOnly)) {
                const timeFmt = hasAmPm ? 'h:mm A' : 'HH:mm';
                return formatExcelDate(val, /y|d/i.test(tokensOnly) ? `YYYY-MM-DD ${timeFmt}` : timeFmt);
            }
            if (tokensOnly && /y+/i.test(tokensOnly) && /m+/i.test(tokensOnly) && !/d/i.test(tokensOnly)) {
                if (cleanNoBracket.includes('年')) {
                    return formatExcelDate(val, 'YYYY年M月');
                }
                return formatExcelDate(val, cleanNoBracket.includes('/') ? 'YYYY/MM' : 'YYYY-MM');
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
            if (value.text !== undefined && value.text !== null && value.text !== '') {
                if (value.text instanceof Date) {
                    return formatExcelDateByNumFmt(value.text, cellNumFmt);
                }
                if (typeof value.text === 'object') {
                    if (Array.isArray(value.text.richText)) {
                        return value.text.richText.map(item => item.text || '').join('');
                    }
                    if (value.text.error) {
                        return value.text.error;
                    }
                }
                return String(value.text);
            }
            return value.hyperlink || '';
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
            return (value && value.error) || (cell.text && cell.text.error) || (typeof cell.text === 'string' ? cell.text : '');
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
        const alpha = parseInt(argb[1], 16) / 255;
        if (alpha === 0) {
            return null;
        }
        color.r = parseInt(argb[2], 16);
        color.g = parseInt(argb[3], 16);
        color.b = parseInt(argb[4], 16);
        color.a = alpha;
        return tinycolor(`rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`).toHexString();
    } catch (e) {
        console.warn(e);
        return null;
    }
}
function transferThemeColor(themeIndex, tint, palette = themeColor){
    if(typeof themeIndex !== 'number' || themeIndex < 0 || themeIndex >= palette.length){
        return '#C7C9CC';
    }
    if(typeof tint === 'undefined'){
        return palette[themeIndex];
    }else if(tint > 0){
        return getLightColor(palette[themeIndex], tint);
    }else{
        return getDarkColor(palette[themeIndex],Math.abs(tint));
    }
}

function resolveColorObject(colorObj, fallback, palette = themeColor) {
    if (!colorObj || typeof colorObj !== 'object') {
        return fallback;
    }
    if (colorObj.argb) {
        const parsed = transferArgbColor(colorObj.argb);
        return parsed || null;
    }
    if (Object.prototype.hasOwnProperty.call(colorObj, 'theme')) {
        return transferThemeColor(colorObj.theme, colorObj.tint, palette);
    }
    if (typeof colorObj.indexed === 'number') {
        return indexedColor[colorObj.indexed] || fallback || '#C7C9CC';
    }
    return fallback !== undefined ? fallback : '#C7C9CC';
}

function normalizeHorizontalAlign(h) {
    if (!h || typeof h !== 'string') {
        return undefined;
    }
    if (h === 'center' || h === 'centerContinuous') {
        return 'center';
    }
    if (h === 'right') {
        return 'right';
    }
    return 'left';
}

function normalizeVerticalAlign(v) {
    if (!v || typeof v !== 'string') {
        return undefined;
    }
    if (v === 'top') {
        return 'top';
    }
    if (v === 'bottom') {
        return 'bottom';
    }
    return 'middle';
}

function getStyle(cell, palette = themeColor){
    const rawStyle = (cell && cell.style) || {};
    const outStyle = {};
    let backGroundColor = null;
    if (rawStyle.fill) {
        if (rawStyle.fill.type === 'gradient' && Array.isArray(rawStyle.fill.stops) && rawStyle.fill.stops[0] && rawStyle.fill.stops[0].color) {
            backGroundColor = resolveColorObject(rawStyle.fill.stops[0].color, '#C7C9CC', palette);
        } else if (!(rawStyle.fill.type === 'pattern' && rawStyle.fill.pattern === 'none')) {
            if (rawStyle.fill.fgColor) {
                backGroundColor = resolveColorObject(rawStyle.fill.fgColor, '#C7C9CC', palette);
            } else if (rawStyle.fill.bgColor && rawStyle.fill.pattern) {
                backGroundColor = resolveColorObject(rawStyle.fill.bgColor, '#C7C9CC', palette);
            }
        }
    }

    if (backGroundColor) {
        outStyle.bgcolor = backGroundColor;
    }

    if (rawStyle.font) {
        const fontOut = {};
        if (rawStyle.font.name) {
            fontOut.name = rawStyle.font.name;
        }
        if (typeof rawStyle.font.size === 'number' && rawStyle.font.size > 0) {
            fontOut.size = Math.max(1, Math.round(rawStyle.font.size / 1.333333));
        }
        if (rawStyle.font.bold) {
            fontOut.bold = true;
        }
        if (rawStyle.font.italic) {
            fontOut.italic = true;
        }
        if (Object.keys(fontOut).length > 0) {
            outStyle.font = fontOut;
        }
        if (rawStyle.font.strike) {
            outStyle.strike = true;
        }
        if (rawStyle.font.underline && rawStyle.font.underline !== 'none') {
            outStyle.underline = true;
        }
        if (rawStyle.font.color) {
            const fontColor = resolveColorObject(rawStyle.font.color, '#000000', palette);
            if (fontColor) {
                outStyle.color = fontColor;
            }
        }
    }

    if (rawStyle.alignment) {
        const align = normalizeHorizontalAlign(rawStyle.alignment.horizontal);
        if (align) {
            outStyle.align = align;
        }
        const valign = normalizeVerticalAlign(rawStyle.alignment.vertical);
        if (valign) {
            outStyle.valign = valign;
        }
        if (rawStyle.alignment.wrapText) {
            outStyle.textwrap = true;
        }
    }

    if (rawStyle.border) {
        const styleBorder = {};
        Object.keys(rawStyle.border).forEach(position => {
            if (position === 'diagonal') {
                return;
            }
            const originBorder = rawStyle.border[position];
            if (!originBorder || typeof originBorder !== 'object' || (!originBorder.style && !originBorder.color)) {
                return;
            }
            let bordColor = '#000000';
            if (typeof originBorder.color === 'string') {
                bordColor = originBorder.color;
            } else if (originBorder.color) {
                bordColor = resolveColorObject(originBorder.color, '#000000', palette) || '#000000';
            }
            styleBorder[position] = [originBorder.style || 'thin', bordColor];
        });
        outStyle.border = styleBorder;
    }

    return outStyle;
}

function getSheetCellAt(sheet, ri, ci) {
    const row = sheet && sheet._rows && sheet._rows[ri];
    return (row && row._cells && row._cells[ci]) || null;
}

function buildMergeOuterBorder(sheet, mergeInfo, masterCell) {
    const baseBorder = (masterCell && masterCell.style && masterCell.style.border) || {};
    const { topRi, leftCi, bottomRi, rightCi } = mergeInfo;
    const trCell = getSheetCellAt(sheet, topRi, rightCi);
    const blCell = getSheetCellAt(sheet, bottomRi, leftCi);
    const brCell = getSheetCellAt(sheet, bottomRi, rightCi);
    const mergedBorder = { ...baseBorder };
    const trRight = trCell && trCell.style && trCell.style.border && trCell.style.border.right;
    const brRight = brCell && brCell.style && brCell.style.border && brCell.style.border.right;
    if (trRight || brRight) {
        mergedBorder.right = trRight || brRight;
    }
    const blBottom = blCell && blCell.style && blCell.style.border && blCell.style.border.bottom;
    const brBottom = brCell && brCell.style && brCell.style.border && brCell.style.border.bottom;
    if (blBottom || brBottom) {
        mergedBorder.bottom = blBottom || brBottom;
    }
    return Object.keys(mergedBorder).length > 0 ? mergedBorder : null;
}

function serializePlainMedia(mediaList) {
    if (!Array.isArray(mediaList)) {
        return [];
    }
    return mediaList.filter(Boolean).map(m => {
        const range = m.range || {};
        const tl = range.tl ? {
            nativeCol: range.tl.nativeCol,
            nativeColOff: range.tl.nativeColOff,
            nativeRow: range.tl.nativeRow,
            nativeRowOff: range.tl.nativeRowOff
        } : undefined;
        const br = range.br ? {
            nativeCol: range.br.nativeCol,
            nativeColOff: range.br.nativeColOff,
            nativeRow: range.br.nativeRow,
            nativeRowOff: range.br.nativeRowOff
        } : undefined;
        const ext = range.ext ? { width: range.ext.width, height: range.ext.height } : undefined;
        return {
            type: m.type,
            imageId: m.imageId,
            range: { tl, br, ext }
        };
    });
}

function isRowHidden(row) {
    return Boolean(row && (row._hidden || row.height === 0));
}

export function transferExcelToSpreadSheet(workbook, options = {}){
    const opts = options || {};
    const themePalette = extractWorkbookThemeColors(workbook);
    let workbookData = [];
    let sheets = [];
    workbook.eachSheet((sheet) => {
        sheets.push(sheet);
        // 构造x-data-spreadsheet 的 sheet 数据源结构
        let sheetData = { name: sheet.name, styles: [], rows: {}, cols: {}, merges: [], media: [] };
        const mergeMasterMap = new Map();
        const styleMap = new Map();
        let effectiveMaxColLen = 0; //真正有数据的列长度，有时excel会展示一堆没数据的列
        let effectiveMaxRowLen = 0;
        for(let mergeRange in sheet._merges) {
            if (!Object.prototype.hasOwnProperty.call(sheet._merges, mergeRange)) {
                continue;
            }
            const mergeItem = sheet._merges[mergeRange];
            if (!mergeItem || !mergeItem.model) {
                continue;
            }
            const topRi = Math.max(0, (mergeItem.model.top || 1) - 1);
            const leftCi = Math.max(0, (mergeItem.model.left || 1) - 1);
            const bottomRi = Math.max(topRi, (mergeItem.model.bottom || 1) - 1);
            const rightCi = Math.max(leftCi, (mergeItem.model.right || 1) - 1);

            let firstVisibleRi = topRi;
            while (firstVisibleRi <= bottomRi && isRowHidden(sheet._rows && sheet._rows[firstVisibleRi])) {
                firstVisibleRi += 1;
            }
            if (firstVisibleRi <= bottomRi) {
                if (firstVisibleRi === topRi && mergeItem.shortRange) {
                    sheetData.merges.push(mergeItem.shortRange);
                } else {
                    const ySpan = bottomRi - firstVisibleRi;
                    const xSpan = rightCi - leftCi;
                    if (ySpan > 0 || xSpan > 0) {
                        sheetData.merges.push(`${mergeItem.tl}:${mergeItem.br}`);
                    }
                }
                const origMaster = getSheetCellAt(sheet, topRi, leftCi);
                mergeMasterMap.set(`${firstVisibleRi}:${leftCi}`, {
                    topRi,
                    leftCi,
                    bottomRi,
                    rightCi,
                    YRange: bottomRi - firstVisibleRi,
                    XRange: rightCi - leftCi,
                    origMaster,
                    remapped: firstVisibleRi !== topRi
                });
            }
            effectiveMaxColLen = Math.max(effectiveMaxColLen, mergeItem.model.right || 0);
            effectiveMaxRowLen = Math.max(effectiveMaxRowLen, mergeItem.model.bottom || 0);
        }

        const applyCellStyle = (targetCellObj, cell, mergeInfo) => {
            let cellForStyle = cell;
            if (mergeInfo) {
                const outerBorder = buildMergeOuterBorder(sheet, mergeInfo, cell);
                if (outerBorder) {
                    cellForStyle = {
                        ...cell,
                        style: {
                            ...(cell.style || {}),
                            border: outerBorder
                        }
                    };
                }
            }
            const cellStyle = getStyle(cellForStyle, themePalette);
            const styleKey = JSON.stringify(cellStyle);
            let styleIndex = styleMap.get(styleKey);
            if (styleIndex === undefined) {
                styleIndex = sheetData.styles.length;
                sheetData.styles.push(cellStyle);
                styleMap.set(styleKey, styleIndex);
            }
            targetCellObj.style = styleIndex;
        };

        // 遍历行
        (sheet._rows || []).forEach((row, spreadSheetRowIndex) =>{
            if (!row) {
                return;
            }
            sheetData.rows[spreadSheetRowIndex] = { cells: {} };
            if(isRowHidden(row)){
                sheetData.rows[spreadSheetRowIndex].height = defaultRowHeight;
                sheetData.rows[spreadSheetRowIndex].hide = true;
                return;
            }else if(typeof row.height === 'number'){
                sheetData.rows[spreadSheetRowIndex].height = Math.max(1, row.height + (opts.heightOffset || 0));
            }else{
                sheetData.rows[spreadSheetRowIndex].height = Math.max(1, defaultRowHeight + (opts.heightOffset || 0));
            }
            //includeEmpty = false 不包含空白单元格
            (row._cells || []).forEach((cell, spreadSheetColIndex) =>{
                if (!cell) {
                    return;
                }
                const mergeInfo = mergeMasterMap.get(`${spreadSheetRowIndex}:${spreadSheetColIndex}`);
                sheetData.rows[spreadSheetRowIndex].cells[spreadSheetColIndex] = {};
                effectiveMaxColLen = Math.max(effectiveMaxColLen, spreadSheetColIndex + 1);

                if (cell.isMerged && cell.master && cell.master.address !== cell._address && !mergeInfo) {
                    return;
                }
                const sourceCell = (mergeInfo && mergeInfo.remapped && mergeInfo.origMaster) ? mergeInfo.origMaster : cell;
                const cellOut = sheetData.rows[spreadSheetRowIndex].cells[spreadSheetColIndex];
                if(mergeInfo && (mergeInfo.YRange > 0 || mergeInfo.XRange > 0)){
                    cellOut.merge = [mergeInfo.YRange, mergeInfo.XRange];
                }
                cellOut.text = getCellText(sourceCell);
                applyCellStyle(cellOut, sourceCell, mergeInfo);
            });
        });

        // Apply remapped merge masters if visible row didn't have a cell object yet
        mergeMasterMap.forEach((mergeInfo, key) => {
            if (!mergeInfo.remapped || !mergeInfo.origMaster) {
                return;
            }
            const [riStr, ciStr] = key.split(':');
            const ri = Number(riStr);
            const ci = Number(ciStr);
            if (!sheetData.rows[ri]) {
                sheetData.rows[ri] = {
                    height: Math.max(1, defaultRowHeight + (opts.heightOffset || 0)),
                    cells: {}
                };
            }
            if (!sheetData.rows[ri].cells[ci] || sheetData.rows[ri].cells[ci].text === undefined) {
                const cellOut = sheetData.rows[ri].cells[ci] || (sheetData.rows[ri].cells[ci] = {});
                if (mergeInfo.YRange > 0 || mergeInfo.XRange > 0) {
                    cellOut.merge = [mergeInfo.YRange, mergeInfo.XRange];
                }
                cellOut.text = getCellText(mergeInfo.origMaster);
                applyCellStyle(cellOut, mergeInfo.origMaster, mergeInfo);
            }
        });

        if (Array.isArray(sheet.views)) {
            const frozenView = sheet.views.find(v => v && v.state === 'frozen');
            if (frozenView && ((frozenView.ySplit || 0) > 0 || (frozenView.xSplit || 0) > 0)) {
                sheetData.freeze = [frozenView.ySplit || 0, frozenView.xSplit || 0];
            }
        }

        if(sheet._media){
            sheetData.media = serializePlainMedia(sheet._media);
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

        if (opts.heightOffset) {
            const offsetHeight = Math.max(1, defaultRowHeight + opts.heightOffset);
            for (let ri = 0; ri < sheetData.rows.len; ri++) {
                if (!sheetData.rows[ri]) {
                    sheetData.rows[ri] = { height: offsetHeight, cells: {} };
                }
            }
        }

        transferColumns(sheet, sheetData, opts, effectiveMaxColLen);
        workbookData.push(sheetData);
    });
    const workbookSource = {
        ...workbook,
        _worksheets: sheets,
        media: workbook.media || []
    };
    return {
        workbookData,
        workbookSource,
        medias: workbook.media || []
    };
}