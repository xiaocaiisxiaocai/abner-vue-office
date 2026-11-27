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
    let themeXml = '';
    if (workbook && workbook._themes && typeof workbook._themes === 'object') {
        if (typeof workbook._themes.theme1 === 'string') {
            themeXml = workbook._themes.theme1;
        } else {
            const keys = Object.keys(workbook._themes);
            for (let i = 0; i < keys.length; i++) {
                if (typeof workbook._themes[keys[i]] === 'string') {
                    themeXml = workbook._themes[keys[i]];
                    break;
                }
            }
        }
    }
    if (!themeXml) {
        return palette;
    }
    const clrSchemeMatch = themeXml.match(/<(?:[a-zA-Z0-9_-]+:)?clrScheme\b[^>]*>([\s\S]*?)<\/(?:[a-zA-Z0-9_-]+:)?clrScheme>/i);
    if (!clrSchemeMatch) {
        return palette;
    }
    const schemeBody = clrSchemeMatch[1];
    Object.keys(THEME_TAG_SLOTS).forEach(tag => {
        const slot = THEME_TAG_SLOTS[tag];
        const tagMatch = schemeBody.match(new RegExp(`<(?:[a-zA-Z0-9_-]+:)?${tag}\\b[^>]*>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9_-]+:)?${tag}>`, 'i'));
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
        if (typeof XMLHttpRequest === 'undefined') {
            reject(new Error('XMLHttpRequest is not available in this environment'));
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
            xhr.onload = null;
            xhr.onerror = null;
            xhr.onabort = null;
            xhr.ontimeout = null;
            if (opts.signal && onSignalAbort && typeof opts.signal.removeEventListener === 'function') {
                opts.signal.removeEventListener('abort', onSignalAbort);
            }
        }
        try {
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
        } catch (err) {
            cleanup();
            reject(err);
        }
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
        ? Math.floor(options.minColLength)
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

const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30, 0, 0, 0);
const EXCEL_1904_EPOCH_MS = Date.UTC(1904, 0, 1, 0, 0, 0);
const CN_WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const NAMED_SECTION_COLORS = {
    black: '#000000',
    white: '#FFFFFF',
    red: '#FF0000',
    green: '#008000',
    blue: '#0000FF',
    yellow: '#FFFF00',
    magenta: '#FF00FF',
    cyan: '#00FFFF'
};

function parseExcelDayjs(val, date1904 = false) {
    if (val == null) {
        return null;
    }
    if (val instanceof Date) {
        return dayjs.utc(val);
    }
    if (typeof val === 'number' && Number.isFinite(val)) {
        const epochMs = date1904 ? EXCEL_1904_EPOCH_MS : EXCEL_EPOCH_MS;
        return dayjs.utc(epochMs + Math.round(val * 86400000));
    }
    return dayjs.utc(val);
}

function formatExcelDate(val, fmt, date1904 = false) {
    const parsed = parseExcelDayjs(val, date1904);
    if (!parsed || !parsed.isValid()) {
        return '';
    }
    return parsed.format(fmt);
}

function stripQuotedAndEscaped(str) {
    let out = '';
    let inQuotes = false;
    for (let i = 0; i < str.length; i++) {
        const ch = str[i];
        if (!inQuotes && ch === '\\') {
            i += 1;
            continue;
        }
        if (ch === '"') {
            inQuotes = !inQuotes;
            continue;
        }
        if (!inQuotes) {
            out += ch;
        }
    }
    return out;
}

function stripBracketsQuotedAndEscaped(str) {
    let out = '';
    let inQuotes = false;
    let inBrackets = false;
    for (let i = 0; i < str.length; i++) {
        const ch = str[i];
        if (!inQuotes && !inBrackets && (ch === '\\' || ch === '_' || ch === '*')) {
            i += 1;
            continue;
        }
        if (!inBrackets && ch === '"') {
            inQuotes = !inQuotes;
            continue;
        }
        if (!inQuotes && ch === '[') {
            inBrackets = true;
            continue;
        }
        if (!inQuotes && inBrackets && ch === ']') {
            inBrackets = false;
            continue;
        }
        if (!inQuotes && !inBrackets) {
            out += ch;
        }
    }
    return out;
}

function extractSectionConditionAndColor(section) {
    let condition = null;
    let color = null;
    let inQuotes = false;
    for (let i = 0; i < section.length; i++) {
        const ch = section[i];
        if (!inQuotes && ch === '\\') {
            i += 1;
            continue;
        }
        if (ch === '"') {
            inQuotes = !inQuotes;
            continue;
        }
        if (!inQuotes && ch === '[') {
            const closeIdx = section.indexOf(']', i + 1);
            if (closeIdx === -1) {
                break;
            }
            const content = section.slice(i + 1, closeIdx).trim();
            const lower = content.toLowerCase();
            if (NAMED_SECTION_COLORS[lower]) {
                color = NAMED_SECTION_COLORS[lower];
            } else {
                const condMatch = content.match(/^(<=|>=|<>|<|>|=)\s*([+-]?\d+(?:\.\d+)?)$/);
                if (condMatch) {
                    condition = { op: condMatch[1], threshold: Number(condMatch[2]) };
                }
            }
            i = closeIdx;
        }
    }
    return { condition, color };
}

function evaluateSectionCondition(value, cond) {
    if (!cond) {
        return false;
    }
    switch (cond.op) {
        case '<': return value < cond.threshold;
        case '<=': return value <= cond.threshold;
        case '>': return value > cond.threshold;
        case '>=': return value >= cond.threshold;
        case '=': return value === cond.threshold;
        case '<>': return value !== cond.threshold;
        default: return false;
    }
}

function selectNumFmtSection(value, sections) {
    const metas = sections.map(s => extractSectionConditionAndColor(s));
    const hasCondition = metas.some(m => m.condition !== null);
    if (hasCondition) {
        for (let i = 0; i < sections.length; i++) {
            const cond = metas[i].condition;
            if (cond) {
                if (evaluateSectionCondition(value, cond)) {
                    const useAbs = cond.op === '<' && cond.threshold <= 0 && value < 0;
                    return {
                        section: sections[i],
                        color: metas[i].color,
                        useAbsForNegSection: useAbs,
                        isConditional: true,
                        isExplicitNeg: false,
                        isExplicitZero: false
                    };
                }
            } else if (i < 3) {
                return {
                    section: sections[i],
                    color: metas[i].color,
                    useAbsForNegSection: false,
                    isConditional: true,
                    isExplicitNeg: false,
                    isExplicitZero: false
                };
            }
        }
        return {
            section: sections[0] || '',
            color: metas[0] ? metas[0].color : null,
            useAbsForNegSection: false,
            isConditional: true,
            isExplicitNeg: false,
            isExplicitZero: false
        };
    }

    if (value < 0 && sections.length > 1) {
        return {
            section: sections[1],
            color: metas[1].color,
            useAbsForNegSection: true,
            isConditional: false,
            isExplicitNeg: true,
            isExplicitZero: false
        };
    }
    if (value === 0 && sections.length > 2) {
        return {
            section: sections[2],
            color: metas[2].color,
            useAbsForNegSection: false,
            isConditional: false,
            isExplicitNeg: false,
            isExplicitZero: true
        };
    }
    return {
        section: sections[0] || '',
        color: metas[0] ? metas[0].color : null,
        useAbsForNegSection: false,
        isConditional: false,
        isExplicitNeg: false,
        isExplicitZero: false
    };
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
            if (ch === '_' || ch === '*') {
                i += 1;
                continue;
            }
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
                    first = (i > 0 && section[i - 1] === '.') ? i - 1 : i;
                }
                last = i;
            }
        }
    }
    if (last !== -1) {
        const afterLast = section.slice(last + 1);
        const fixedDenomMatch = afterLast.match(/^\s*\/\s*[1-9]\d*/);
        if (fixedDenomMatch) {
            last += fixedDenomMatch[0].length;
        } else if (first !== -1) {
            const coreSoFar = stripBracketsQuotedAndEscaped(section.slice(first, last + 1));
            const tailDigits = afterLast.match(/^\d+/);
            if (tailDigits && /\/\s*\d+$/.test(coreSoFar)) {
                last += tailDigits[0].length;
            }
        }
    }
    return { first, last };
}

function extractEdgeLiterals(segment, {
    allowPercent = true,
    allowCurrencyFallback = true,
    preserveParens = false,
    preservePlus = false,
    preserveMinus = false,
    preserveTrailingSpace = false
} = {}) {
    let out = '';
    let hasExplicitLiteral = false;
    let hasUnquotedMinus = false;
    let hasUnquotedPercent = false;
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
        if (ch === '-') {
            hasUnquotedMinus = true;
            if (preserveMinus) {
                out += pendingSpace + '-';
                pendingSpace = '';
                hasExplicitLiteral = true;
            }
            continue;
        }
        if (preservePlus && ch === '+') {
            out += pendingSpace + '+';
            pendingSpace = '';
            hasExplicitLiteral = true;
            continue;
        }
        if (preserveParens && (ch === '(' || ch === ')')) {
            out += pendingSpace + ch;
            pendingSpace = '';
            hasExplicitLiteral = true;
            continue;
        }
        if (allowPercent && ch === '%') {
            hasUnquotedPercent = true;
            out += pendingSpace + '%';
            pendingSpace = '';
            hasExplicitLiteral = true;
            continue;
        }
        if (allowCurrencyFallback && (ch === '$' || ch === '¥' || ch === '￥' || ch === '€' || ch === '£')) {
            out += pendingSpace + ch;
            pendingSpace = '';
            hasExplicitLiteral = true;
        }
    }
    if (preserveTrailingSpace && out && pendingSpace) {
        out += pendingSpace;
    }
    return { text: out, hasExplicitLiteral, hasUnquotedMinus, hasUnquotedPercent };
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

function roundHalfAwayFromZero(numVal, decimals) {
    if (!Number.isFinite(numVal) || numVal === 0) {
        return 0;
    }
    const sign = numVal < 0 ? -1 : 1;
    const abs = Math.abs(numVal);
    const clean = Number(abs.toPrecision(15));
    const shifted = Number(`${clean}e${decimals}`);
    if (!Number.isFinite(shifted)) {
        return numVal;
    }
    const rounded = Math.floor(shifted + 0.5);
    return sign * Number(`${rounded}e${-decimals}`);
}

function formatFixedDecimals(numVal, maxDec, minDec) {
    const rounded = roundHalfAwayFromZero(numVal, maxDec);
    let result = rounded.toFixed(maxDec);
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

function applyIntegerPaddingAndGrouping(result, coreNumPattern) {
    const intPattern = coreNumPattern.split('.')[0];
    const intZeroCount = (intPattern.match(/0/g) || []).length;
    if (intZeroCount > 1 && !result.includes('e') && !result.includes('E')) {
        const parts = result.split('.');
        const neg = parts[0].startsWith('-');
        const absDigits = neg ? parts[0].slice(1) : parts[0];
        if (absDigits.length < intZeroCount) {
            parts[0] = (neg ? '-' : '') + absDigits.padStart(intZeroCount, '0');
            result = parts.join('.');
        }
    }
    if (/[#0?],[#0?]/.test(intPattern) && !result.includes('e') && !result.includes('E')) {
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

function formatFractionValue(numVal, fracMatch) {
    const hasIntPart = Boolean(fracMatch[1]);
    const denomSpec = fracMatch[3];
    const neg = numVal < 0;
    const absVal = Math.abs(numVal);
    let whole = hasIntPart ? Math.floor(absVal) : 0;
    const frac = hasIntPart ? (absVal - whole) : absVal;

    let bestNum = 0;
    let bestDen = 1;
    if (/^[1-9]\d*$/.test(denomSpec)) {
        bestDen = Number(denomSpec);
        bestNum = Math.round(frac * bestDen);
    } else {
        const maxDen = Math.min(Math.pow(10, Math.min(denomSpec.length, 4)) - 1, 9999);
        let bestErr = Math.abs(frac);
        for (let d = 1; d <= maxDen; d++) {
            const n = Math.round(frac * d);
            const err = Math.abs(frac - n / d);
            if (err + 1e-12 < bestErr) {
                bestErr = err;
                bestNum = n;
                bestDen = d;
                if (err < 1e-10) {
                    break;
                }
            }
        }
    }

    if (hasIntPart && bestNum >= bestDen) {
        whole += Math.floor(bestNum / bestDen);
        bestNum = bestNum % bestDen;
    }

    const sign = neg && (whole !== 0 || bestNum !== 0) ? '-' : '';
    if (hasIntPart) {
        if (bestNum === 0) {
            return `${sign}${whole}`;
        }
        return whole > 0 ? `${sign}${whole} ${bestNum}/${bestDen}` : `${sign}${bestNum}/${bestDen}`;
    }
    return `${sign}${bestNum}/${bestDen}`;
}

function formatMaskedInteger(numVal, coreSection) {
    const neg = numVal < 0;
    const digits = String(Math.round(Math.abs(numVal)));
    const placeholders = [];
    const tokens = [];
    let inQuotes = false;
    for (let i = 0; i < coreSection.length; i++) {
        const ch = coreSection[i];
        if (!inQuotes && ch === '\\' && i + 1 < coreSection.length) {
            tokens.push({ type: 'lit', val: coreSection[i + 1] });
            i += 1;
            continue;
        }
        if (ch === '"') {
            inQuotes = !inQuotes;
            continue;
        }
        if (inQuotes) {
            tokens.push({ type: 'lit', val: ch });
            continue;
        }
        if (ch === '0' || ch === '#' || ch === '?') {
            placeholders.push(tokens.length);
            tokens.push({ type: 'digit', kind: ch });
        } else {
            tokens.push({ type: 'lit', val: ch });
        }
    }
    if (placeholders.length === 0) {
        return null;
    }
    const padded = digits.padStart(placeholders.length, '0');
    const overflow = padded.length > placeholders.length ? padded.slice(0, padded.length - placeholders.length) : '';
    const tail = padded.slice(padded.length - placeholders.length);
    let digitIdx = 0;
    let out = overflow;
    for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        if (t.type === 'digit') {
            out += tail[digitIdx++];
        } else {
            out += t.val;
        }
    }
    return (neg && out !== '0'.repeat(out.length) ? '-' : '') + out;
}

function formatNumberWithMeta(value, cellNumFmt) {
    try {
        if (typeof value !== 'number') {
            return { text: value != null ? String(value) : '', color: null };
        }
        if (!Number.isFinite(value)) {
            return { text: String(value), color: null };
        }
        if (cellNumFmt && typeof cellNumFmt === 'string') {
            const sections = splitNumFmtSections(cellNumFmt);
            const selected = selectNumFmtSection(value, sections);
            const { section, color, useAbsForNegSection, isExplicitNeg, isExplicitZero } = selected;
            const patternOnly = stripBracketsQuotedAndEscaped(section);

            if ((isExplicitNeg || isExplicitZero || value === 0 || selected.isConditional) && !/[0#]/.test(patternOnly)) {
                const trimPattern = patternOnly.trim();
                if (!/^(General|@)$/i.test(trimPattern)) {
                    const edgeText = extractEdgeLiterals(section, {
                        allowPercent: true,
                        allowCurrencyFallback: true,
                        preserveParens: true,
                        preservePlus: true,
                        preserveMinus: true
                    }).text;
                    if (edgeText) {
                        return { text: edgeText, color };
                    }
                    if (!patternOnly.includes('?')) {
                        return { text: '', color };
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
                const coreRawSection = section.slice(firstDigitIdx, lastDigitIdx + 1);
                const trailingSeg = section.slice(lastDigitIdx + 1 + scalingCommas);
                const corePattern = stripBracketsQuotedAndEscaped(coreRawSection);

                const isParenNeg = useAbsForNegSection && /\(/.test(stripBracketsQuotedAndEscaped(leadingSeg)) && /\)/.test(stripBracketsQuotedAndEscaped(trailingSeg));
                const prefixInfo = extractEdgeLiterals(leadingSeg, {
                    allowPercent: true,
                    allowCurrencyFallback: true,
                    preserveParens: isParenNeg,
                    preservePlus: true,
                    preserveMinus: false,
                    preserveTrailingSpace: true
                });
                const suffixInfo = extractEdgeLiterals(trailingSeg, {
                    allowPercent: true,
                    allowCurrencyFallback: true,
                    preserveParens: isParenNeg,
                    preservePlus: false,
                    preserveMinus: false
                });
                const prefix = prefixInfo.text;
                let suffix = suffixInfo.text;

                const hasLeadingMinus = useAbsForNegSection && prefixInfo.hasUnquotedMinus;
                const hasTrailingMinus = useAbsForNegSection && !prefixInfo.hasUnquotedMinus && suffixInfo.hasUnquotedMinus;
                const isPercent = prefixInfo.hasUnquotedPercent || suffixInfo.hasUnquotedPercent || corePattern.includes('%');
                const sciMatch = corePattern.match(/^([0#?]+(?:\.([0#?]+))?)[eE]([+-])([0#?]+)$/);
                const fracMatch = !sciMatch && corePattern.match(/^(?:([0#?]+)\s+)?([0#?]+)\s*\/\s*([0#?]+|\d+)$/);

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
                        const expParts = absVal.toExponential(maxDec).split(/[eE]/);
                        const mantNum = Number(expParts[0]);
                        const exp = parseInt(expParts[1], 10);
                        const mantStr = formatFixedDecimals(mantNum, maxDec, minDec);
                        const expSign = exp < 0 ? '-' : (expSignCfg === '+' ? '+' : '');
                        const expDigits = String(Math.abs(exp)).padStart(expMinDigits, '0');
                        result = `${neg ? '-' : ''}${mantStr}E${expSign}${expDigits}`;
                    }
                } else if (fracMatch) {
                    result = formatFractionValue(numVal, fracMatch);
                } else if (
                    !isPercent &&
                    !corePattern.includes('.') &&
                    !corePattern.includes(',') &&
                    /[^0#?]/.test(corePattern)
                ) {
                    const masked = formatMaskedInteger(numVal, coreRawSection);
                    result = masked !== null ? masked : String(numVal);
                } else {
                    if (isPercent) {
                        numVal = numVal * 100;
                        if (!prefixInfo.hasUnquotedPercent && !suffix.includes('%')) {
                            suffix = `%${suffix}`;
                        }
                    }
                    const decMatch = corePattern.match(/\.([0#?]+)/);
                    const maxDec = decMatch ? decMatch[1].length : 0;
                    const minDec = decMatch ? (decMatch[1].match(/0/g) || []).length : 0;
                    result = formatFixedDecimals(numVal, maxDec, minDec);
                    result = applyIntegerPaddingAndGrouping(result, corePattern);
                }

                const isZeroResult = /^0+(\.0+)?(E[+-]0+)?$/.test(result);
                if (result.startsWith('-')) {
                    return { text: `-${prefix}${result.slice(1)}${suffix}`, color };
                }
                if (value < 0 && hasLeadingMinus && !isZeroResult) {
                    return { text: `-${prefix}${result}${suffix}`, color };
                }
                if (value < 0 && hasTrailingMinus && !isZeroResult) {
                    return { text: `${prefix}${result}${suffix}-`, color };
                }
                return { text: `${prefix}${result}${suffix}`, color };
            }
        }
        return { text: String(value), color: null };
    } catch (e) {
        return { text: value != null ? String(value) : '', color: null };
    }
}

export function formatNumberValue(value, cellNumFmt) {
    return formatNumberWithMeta(value, cellNumFmt).text;
}

function hasElapsedDurationToken(numFmt) {
    if (typeof numFmt !== 'string' || !numFmt) {
        return false;
    }
    const section0 = splitNumFmtSections(numFmt)[0] || '';
    const unquoted = stripQuotedAndEscaped(section0);
    return /\[(?:h+|m+|s+)\]/i.test(unquoted);
}

function formatElapsedDuration(val, rawFmt, date1904 = false) {
    if (val == null || val === '') {
        return '';
    }
    const epochMs = date1904 ? EXCEL_1904_EPOCH_MS : EXCEL_EPOCH_MS;
    const ms = val instanceof Date
        ? val.getTime() - epochMs
        : Number(val) * 86400000;
    if (!Number.isFinite(ms)) {
        return '';
    }
    const sign = ms < 0 ? '-' : '';
    const totalSec = Math.round(Math.abs(ms) / 1000);
    const section0 = splitNumFmtSections(String(rawFmt || ''))[0] || '';
    const unquoted = stripQuotedAndEscaped(section0);
    const restTokens = stripBracketsQuotedAndEscaped(section0);

    const hMatch = unquoted.match(/\[(h+)\]/i);
    if (hMatch) {
        const hours = Math.floor(totalSec / 3600);
        const mins = Math.floor((totalSec % 3600) / 60);
        const secs = totalSec % 60;
        const padH = hMatch[1].length > 1 ? String(hours).padStart(hMatch[1].length, '0') : String(hours);
        const hasM = /m/i.test(restTokens);
        const hasS = /s/i.test(restTokens);
        if (hasS) {
            return `${sign}${padH}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }
        if (hasM) {
            return `${sign}${padH}:${String(mins).padStart(2, '0')}`;
        }
        return `${sign}${padH}`;
    }
    const mMatch = unquoted.match(/\[(m+)\]/i);
    if (mMatch) {
        const mins = Math.floor(totalSec / 60);
        const secs = totalSec % 60;
        const padM = mMatch[1].length > 1 ? String(mins).padStart(mMatch[1].length, '0') : String(mins);
        if (/s/i.test(restTokens)) {
            return `${sign}${padM}:${String(secs).padStart(2, '0')}`;
        }
        return `${sign}${padM}`;
    }
    const sMatch = unquoted.match(/\[(s+)\]/i);
    const secWidth = sMatch ? sMatch[1].length : 1;
    const padS = secWidth > 1 ? String(totalSec).padStart(secWidth, '0') : String(totalSec);
    return `${sign}${padS}`;
}

function formatExcelDateByNumFmt(val, numFmt, date1904 = false) {
    if (hasElapsedDurationToken(numFmt)) {
        return formatElapsedDuration(val, numFmt, date1904);
    }
    const rawStr = typeof numFmt === 'string' ? numFmt : '';
    const section0 = rawStr ? splitNumFmtSections(rawStr)[0] : '';
    switch (rawStr) {
        case 'yyyy-mm-dd;@':
            return formatExcelDate(val, 'YYYY-MM-DD', date1904);
        case 'mm-dd-yy':
            return formatExcelDate(val, 'YYYY/MM/DD', date1904);
        case '[$-F800]dddd, mmmm dd, yyyy': {
            const parsed = parseExcelDayjs(val, date1904);
            if (!parsed || !parsed.isValid()) return '';
            return `${parsed.format('YYYY年M月D日')} ${CN_WEEKDAYS[parsed.day()]}`;
        }
        case 'm"月"d"日";@':
            return formatExcelDate(val, 'M月D日', date1904);
        case 'yyyy/m/d h:mm;@':
            return formatExcelDate(val, 'YYYY/M/D HH:mm', date1904);
        case 'm/d/yy "h":mm':
            return formatExcelDate(val, 'YYYY/M/D HH:mm', date1904);
        case 'h:mm;@':
            return formatExcelDate(val, 'HH:mm', date1904);
        default: {
            const cleanNoBracket = section0.replace(/\[[^\]]*\]/g, '');
            const tokensOnly = stripBracketsQuotedAndEscaped(section0);
            const hasAmPm = /(?:am\/pm|a\/p)/i.test(tokensOnly);
            if (tokensOnly && /h{1,2}:m{1,2}:s{1,2}/i.test(tokensOnly)) {
                const timeFmt = hasAmPm ? 'h:mm:ss A' : 'HH:mm:ss';
                return formatExcelDate(val, /y|d/i.test(tokensOnly) ? `YYYY-MM-DD ${timeFmt}` : timeFmt, date1904);
            }
            if (tokensOnly && /h{1,2}:m{1,2}/i.test(tokensOnly)) {
                const timeFmt = hasAmPm ? 'h:mm A' : 'HH:mm';
                return formatExcelDate(val, /y|d/i.test(tokensOnly) ? `YYYY-MM-DD ${timeFmt}` : timeFmt, date1904);
            }
            if (tokensOnly && !/h/i.test(tokensOnly) && /m{1,2}:s{1,2}/i.test(tokensOnly)) {
                return formatExcelDate(val, 'mm:ss', date1904);
            }
            if (tokensOnly && /y+/i.test(tokensOnly) && /m+/i.test(tokensOnly) && /d+/i.test(tokensOnly)) {
                if (cleanNoBracket.includes('年') && cleanNoBracket.includes('月') && cleanNoBracket.includes('日')) {
                    const mFmt = /mm/i.test(tokensOnly) ? 'MM' : 'M';
                    const dFmt = /dd/i.test(tokensOnly) ? 'DD' : 'D';
                    return formatExcelDate(val, `YYYY年${mFmt}月${dFmt}日`, date1904);
                }
                if (cleanNoBracket.includes('/')) {
                    const mFmt = /mm/i.test(tokensOnly) ? 'MM' : 'M';
                    const dFmt = /dd/i.test(tokensOnly) ? 'DD' : 'D';
                    return formatExcelDate(val, `YYYY/${mFmt}/${dFmt}`, date1904);
                }
            }
            if (tokensOnly && !/y/i.test(tokensOnly) && /m+/i.test(tokensOnly) && /d+/i.test(tokensOnly)) {
                if (cleanNoBracket.includes('月') && cleanNoBracket.includes('日')) {
                    const mFmt = /mm/i.test(tokensOnly) ? 'MM' : 'M';
                    const dFmt = /dd/i.test(tokensOnly) ? 'DD' : 'D';
                    return formatExcelDate(val, `${mFmt}月${dFmt}日`, date1904);
                }
            }
            if (tokensOnly && /y+/i.test(tokensOnly) && /m+/i.test(tokensOnly) && !/d/i.test(tokensOnly)) {
                if (cleanNoBracket.includes('年')) {
                    return formatExcelDate(val, 'YYYY年M月', date1904);
                }
                return formatExcelDate(val, cleanNoBracket.includes('/') ? 'YYYY/MM' : 'YYYY-MM', date1904);
            }
            return formatExcelDate(val, 'YYYY-MM-DD', date1904);
        }
    }
}

function formatTextByNumFmt(str, cellNumFmt) {
    if (!cellNumFmt || typeof cellNumFmt !== 'string') {
        return str;
    }
    const sections = splitNumFmtSections(cellNumFmt);
    let textSection = null;
    if (sections.length >= 4) {
        textSection = sections[3];
    } else if (sections.length === 1 && stripBracketsQuotedAndEscaped(sections[0]).includes('@')) {
        textSection = sections[0];
    }
    if (!textSection || !stripBracketsQuotedAndEscaped(textSection).includes('@')) {
        return str;
    }
    let out = '';
    let inQuotes = false;
    for (let i = 0; i < textSection.length; i++) {
        const ch = textSection[i];
        if (!inQuotes && ch === '\\' && i + 1 < textSection.length) {
            out += textSection[i + 1];
            i += 1;
            continue;
        }
        if (ch === '"') {
            inQuotes = !inQuotes;
            continue;
        }
        if (inQuotes) {
            out += ch;
            continue;
        }
        if (ch === '[') {
            const closeIdx = textSection.indexOf(']', i + 1);
            i = closeIdx === -1 ? textSection.length : closeIdx;
            continue;
        }
        if (ch === '_' || ch === '*') {
            i += 1;
            continue;
        }
        if (ch === '@') {
            out += str;
            continue;
        }
        out += ch;
    }
    return out;
}

function extractRichText(richTextArr) {
    return richTextArr.map(item => (item && item.text != null ? String(item.text) : '')).join('');
}

function getCellTextWithMeta(cell, date1904 = false) {
    const { numFmt, value, type } = cell;
    const cellNumFmt = (cell.style && cell.style.numFmt) || numFmt;
    switch (type){
        case 2: //数字
            if (hasElapsedDurationToken(cellNumFmt)) {
                return { text: formatElapsedDuration(value, cellNumFmt, date1904), color: null };
            }
            return formatNumberWithMeta(value, cellNumFmt);

        case 3: //字符串
            return { text: value != null ? formatTextByNumFmt(String(value), cellNumFmt) : '', color: null };
        case 4: //日期
            return { text: formatExcelDateByNumFmt(value, cellNumFmt, date1904), color: null };

        case 5: //超链接
            if (!value) {
                return { text: '', color: null };
            }
            if (value.text !== undefined && value.text !== null && value.text !== '') {
                if (value.text instanceof Date) {
                    return { text: formatExcelDateByNumFmt(value.text, cellNumFmt, date1904), color: null };
                }
                if (typeof value.text === 'number') {
                    return formatNumberWithMeta(value.text, cellNumFmt);
                }
                if (typeof value.text === 'boolean') {
                    return { text: String(value.text).toUpperCase(), color: null };
                }
                if (typeof value.text === 'object') {
                    if (Array.isArray(value.text.richText)) {
                        return { text: extractRichText(value.text.richText), color: null };
                    }
                    if (value.text.error) {
                        return { text: value.text.error, color: null };
                    }
                    if (value.text.result !== undefined) {
                        return getCellTextWithMeta({ type: 6, value: value.text, style: cell.style, numFmt }, date1904);
                    }
                    return { text: value.hyperlink || '', color: null };
                }
                return { text: formatTextByNumFmt(String(value.text), cellNumFmt), color: null };
            }
            return { text: value.hyperlink || '', color: null };
        case 6: //公式
            if (!value) {
                return { text: '', color: null };
            }
            if (get(value, 'result.error')) {
                return { text: get(value, 'result.error'), color: null };
            }
            if (value.result instanceof Date) {
                return { text: formatExcelDateByNumFmt(value.result, cellNumFmt, date1904), color: null };
            }
            if (typeof value.result === 'number') {
                if (hasElapsedDurationToken(cellNumFmt)) {
                    return { text: formatElapsedDuration(value.result, cellNumFmt, date1904), color: null };
                }
                return formatNumberWithMeta(value.result, cellNumFmt);
            }
            if (typeof value.result === 'boolean') {
                return { text: String(value.result).toUpperCase(), color: null };
            }
            if (value.result && typeof value.result === 'object' && Array.isArray(value.result.richText)) {
                return { text: extractRichText(value.result.richText), color: null };
            }
            if (value.result === undefined || value.result === null) {
                return { text: '', color: null };
            }
            return { text: formatTextByNumFmt(String(value.result), cellNumFmt), color: null };
        case 8: //富文本
            if (typeof cell.text === 'string' && cell.text.length > 0) {
                return { text: cell.text, color: null };
            }
            if (value && Array.isArray(value.richText)) {
                return { text: extractRichText(value.richText), color: null };
            }
            return { text: cell.text || '', color: null };
        case 9: //Boolean
        {
            const boolVal = value !== undefined && value !== null ? value : cell.text;
            return { text: boolVal !== undefined && boolVal !== null ? String(boolVal).toUpperCase() : '', color: null };
        }
        case 10: //Error
            return { text: (value && value.error) || (cell.text && cell.text.error) || (typeof cell.text === 'string' ? cell.text : ''), color: null };
        default:
            if (value == null) {
                return { text: '', color: null };
            }
            if (value instanceof Date) {
                return { text: formatExcelDateByNumFmt(value, cellNumFmt, date1904), color: null };
            }
            if (typeof value === 'object') {
                if (Array.isArray(value.richText)) {
                    return { text: extractRichText(value.richText), color: null };
                }
                return { text: value.error || value.text || '', color: null };
            }
            return { text: String(value), color: null };
    }
}

export function getCellText(cell, date1904 = false){
    return getCellTextWithMeta(cell, date1904).text;
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
        if (alpha < 1) {
            const roundedAlpha = Math.round(alpha * 1000) / 1000;
            return `rgba(${color.r}, ${color.g}, ${color.b}, ${roundedAlpha})`;
        }
        return tinycolor(`rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`).toHexString();
    } catch (e) {
        console.warn(e);
        return null;
    }
}
function transferThemeColor(themeIndex, tint, palette = themeColor){
    if(typeof themeIndex !== 'number' || !Number.isInteger(themeIndex) || themeIndex < 0 || themeIndex >= palette.length){
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
    if (typeof colorObj.theme === 'number') {
        return transferThemeColor(colorObj.theme, colorObj.tint, palette);
    }
    if (typeof colorObj.indexed === 'number') {
        return indexedColor[colorObj.indexed] || fallback || '#C7C9CC';
    }
    if (colorObj.auto || Object.keys(colorObj).length === 0) {
        return null;
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

function isValidBorderEdge(edge) {
    return Boolean(edge && typeof edge === 'object' && edge.style !== 'none' && (edge.style || edge.color));
}

function getStyle(cell, palette = themeColor){
    const rawStyle = (cell && cell.style) || {};
    const outStyle = {};
    let backGroundColor = null;
    if (rawStyle.fill) {
        if (rawStyle.fill.type === 'gradient' && Array.isArray(rawStyle.fill.stops) && rawStyle.fill.stops[0] && rawStyle.fill.stops[0].color) {
            backGroundColor = resolveColorObject(rawStyle.fill.stops[0].color, '#C7C9CC', palette);
        } else if (!(rawStyle.fill.type === 'pattern' && rawStyle.fill.pattern === 'none')) {
            const pattern = rawStyle.fill.pattern;
            const isSolid = !pattern || pattern === 'solid';
            if (isSolid) {
                if (rawStyle.fill.fgColor) {
                    backGroundColor = resolveColorObject(rawStyle.fill.fgColor, '#C7C9CC', palette);
                }
            } else {
                if (rawStyle.fill.bgColor) {
                    backGroundColor = resolveColorObject(rawStyle.fill.bgColor, '#C7C9CC', palette);
                } else if (rawStyle.fill.fgColor && rawStyle.fill.fgColor.indexed !== 64) {
                    backGroundColor = resolveColorObject(rawStyle.fill.fgColor, '#C7C9CC', palette);
                }
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
            if (!isValidBorderEdge(originBorder)) {
                return;
            }
            let bordColor = '#000000';
            if (typeof originBorder.color === 'string') {
                const parsed = transferArgbColor(originBorder.color);
                if (parsed === null && /^#?00[a-f\d]{6}$/i.test(originBorder.color.trim())) {
                    return;
                }
                bordColor = parsed || originBorder.color;
            } else if (originBorder.color) {
                if (typeof originBorder.color.argb === 'string' && /^#?00[a-f\d]{6}$/i.test(originBorder.color.argb.trim())) {
                    return;
                }
                bordColor = resolveColorObject(originBorder.color, '#000000', palette) || '#000000';
            }
            styleBorder[position] = [originBorder.style || 'thin', bordColor];
        });
        if (Object.keys(styleBorder).length > 0) {
            outStyle.border = styleBorder;
        }
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
    const mergedBorder = {};
    if (isValidBorderEdge(baseBorder.top)) {
        mergedBorder.top = baseBorder.top;
    }
    if (isValidBorderEdge(baseBorder.left)) {
        mergedBorder.left = baseBorder.left;
    }
    const trRight = trCell && trCell.style && trCell.style.border && trCell.style.border.right;
    const brRight = brCell && brCell.style && brCell.style.border && brCell.style.border.right;
    if (isValidBorderEdge(trRight)) {
        mergedBorder.right = trRight;
    } else if (isValidBorderEdge(brRight)) {
        mergedBorder.right = brRight;
    } else if (rightCi === leftCi && isValidBorderEdge(baseBorder.right)) {
        mergedBorder.right = baseBorder.right;
    }
    const blBottom = blCell && blCell.style && blCell.style.border && blCell.style.border.bottom;
    const brBottom = brCell && brCell.style && brCell.style.border && brCell.style.border.bottom;
    if (isValidBorderEdge(blBottom)) {
        mergedBorder.bottom = blBottom;
    } else if (isValidBorderEdge(brBottom)) {
        mergedBorder.bottom = brBottom;
    } else if (bottomRi === topRi && isValidBorderEdge(baseBorder.bottom)) {
        mergedBorder.bottom = baseBorder.bottom;
    }
    return Object.keys(mergedBorder).length > 0 ? mergedBorder : null;
}

function colIndexToLetters(ci) {
    let n = ci + 1;
    let letters = '';
    while (n > 0) {
        const rem = (n - 1) % 26;
        letters = String.fromCharCode(65 + rem) + letters;
        n = Math.floor((n - 1) / 26);
    }
    return letters;
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

function isColHidden(sheet, ci) {
    const cols = (sheet && (sheet.columns || sheet._columns)) || [];
    const col = cols[ci];
    return Boolean(col && (col._hidden || col.width === 0));
}

function iterateWorkbookSheets(workbook, cb) {
    if (!workbook) {
        return;
    }
    if (typeof workbook.eachSheet === 'function') {
        workbook.eachSheet(cb);
        return;
    }
    const list = Array.isArray(workbook.worksheets)
        ? workbook.worksheets
        : (Array.isArray(workbook._worksheets) ? workbook._worksheets.filter(Boolean) : []);
    list.forEach(cb);
}

export function transferExcelToSpreadSheet(workbook, options = {}){
    const opts = options || {};
    const themePalette = extractWorkbookThemeColors(workbook);
    const date1904 = Boolean(workbook && workbook.properties && workbook.properties.date1904);
    let workbookData = [];
    let sheets = [];
    iterateWorkbookSheets(workbook, (sheet) => {
        if (!sheet) {
            return;
        }
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
            let firstVisibleCi = leftCi;
            while (firstVisibleCi <= rightCi && isColHidden(sheet, firstVisibleCi)) {
                firstVisibleCi += 1;
            }
            if (firstVisibleRi <= bottomRi && firstVisibleCi <= rightCi) {
                const ySpan = bottomRi - firstVisibleRi;
                const xSpan = rightCi - firstVisibleCi;
                const remapped = firstVisibleRi !== topRi || firstVisibleCi !== leftCi;
                if (ySpan > 0 || xSpan > 0) {
                    if (!remapped && mergeItem.shortRange) {
                        sheetData.merges.push(mergeItem.shortRange);
                    } else {
                        const tlRef = `${colIndexToLetters(firstVisibleCi)}${firstVisibleRi + 1}`;
                        const brRef = `${colIndexToLetters(rightCi)}${bottomRi + 1}`;
                        sheetData.merges.push(`${tlRef}:${brRef}`);
                    }
                }
                const origMaster = getSheetCellAt(sheet, topRi, leftCi);
                mergeMasterMap.set(`${firstVisibleRi}:${firstVisibleCi}`, {
                    topRi,
                    leftCi,
                    bottomRi,
                    rightCi,
                    YRange: ySpan,
                    XRange: xSpan,
                    origMaster,
                    remapped
                });
            }
            effectiveMaxColLen = Math.max(effectiveMaxColLen, mergeItem.model.right || 0);
            effectiveMaxRowLen = Math.max(effectiveMaxRowLen, mergeItem.model.bottom || 0);
        }

        const applyCellStyle = (targetCellObj, cell, mergeInfo, fmtColor = null) => {
            let cellForStyle = cell || {};
            if (mergeInfo) {
                const outerBorder = buildMergeOuterBorder(sheet, mergeInfo, cellForStyle);
                cellForStyle = {
                    ...cellForStyle,
                    style: {
                        ...(cellForStyle.style || {}),
                        border: outerBorder || undefined
                    }
                };
            }
            const cellStyle = getStyle(cellForStyle, themePalette);
            if (fmtColor) {
                cellStyle.color = fmtColor;
            }
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
                effectiveMaxColLen = Math.max(effectiveMaxColLen, spreadSheetColIndex + 1);
                const mergeInfo = mergeMasterMap.get(`${spreadSheetRowIndex}:${spreadSheetColIndex}`);
                if (cell.isMerged && cell.master && cell.master.address !== cell._address && !mergeInfo) {
                    return;
                }
                const sourceCell = (mergeInfo && mergeInfo.remapped && mergeInfo.origMaster) ? mergeInfo.origMaster : cell;
                const cellOut = {};
                sheetData.rows[spreadSheetRowIndex].cells[spreadSheetColIndex] = cellOut;
                if(mergeInfo && (mergeInfo.YRange > 0 || mergeInfo.XRange > 0)){
                    cellOut.merge = [mergeInfo.YRange, mergeInfo.XRange];
                }
                const { text, color: fmtColor } = getCellTextWithMeta(sourceCell, date1904);
                cellOut.text = text;
                applyCellStyle(cellOut, sourceCell, mergeInfo, fmtColor);
            });
        });

        // Backfill merge masters if the target visible cell did not have a cell object yet
        mergeMasterMap.forEach((mergeInfo, key) => {
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
                if (mergeInfo.origMaster) {
                    const { text, color: fmtColor } = getCellTextWithMeta(mergeInfo.origMaster, date1904);
                    cellOut.text = text;
                    applyCellStyle(cellOut, mergeInfo.origMaster, mergeInfo, fmtColor);
                } else {
                    cellOut.text = '';
                    applyCellStyle(cellOut, {}, mergeInfo, null);
                }
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
            ? Math.floor(opts.minRowLength)
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
        media: (workbook && workbook.media) || []
    };
    return {
        workbookData,
        workbookSource,
        medias: (workbook && workbook.media) || []
    };
}