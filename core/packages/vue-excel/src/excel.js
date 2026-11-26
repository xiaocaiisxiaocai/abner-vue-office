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
    if (src instanceof Blob) {
        return src.arrayBuffer();
    }
    if (typeof Response !== 'undefined' && src instanceof Response) {
        return src.arrayBuffer();
    }
    if (typeof src === 'string') {
        return requestExcel(src, options);
    }
    return Promise.reject(new Error('不支持的 src 格式'));
}

function requestExcel(src, options) {
    return new Promise(function (resolve, reject) {
        const xhr = new XMLHttpRequest();
        xhr.open(options.method || 'GET', src, true);
        xhr.responseType = options.responseType || 'arraybuffer';
        xhr.onload = function () {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(xhr.response);
            } else {
                reject(xhr.status);
            }
        };
        xhr.onerror = function() {
          reject(xhr.status);
        };
        xhr.withCredentials = options.withCredentials || false;
        if(options.headers) {
            Object.keys(options.headers).forEach(function(key) {
                xhr.setRequestHeader(key, options.headers[key]);
            });
        }

        xhr.send(options.body);
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


function transferColumns(excelSheet, spreadSheet, options){
    const columns = excelSheet.columns || [];
    for(let i = 0; i < columns.length; i++){
        const col = columns[i];
        spreadSheet.cols[i.toString()] = {};
        if(!col) {
            spreadSheet.cols[i.toString()].width = defaultColWidth + (options.widthOffset || 0);
        }else if(col._hidden) {
            spreadSheet.cols[i.toString()].width = 0.1;
        }else if(col.width) {
            spreadSheet.cols[i.toString()].width = col.width * 6 + (options.widthOffset || 0);
        } else {
            spreadSheet.cols[i.toString()].width = defaultColWidth + (options.widthOffset || 0);
        }
    }

    spreadSheet.cols.len = Math.max(Object.keys(spreadSheet.cols).length, options.minColLength || 0);
}

function formatExcelDate(val, fmt) {
    if (val instanceof Date) {
        return dayjs(val).add(val.getTimezoneOffset(), 'minute').format(fmt);
    }
    return dayjs(val).format(fmt);
}

function getCellText(cell){
    //console.log(cell);
    let {numFmt, value, type} = cell;
    switch (type){
        case 2: //数字
            try {
                if (typeof value !== 'number') {
                    return value != null ? String(value) : '';
                }
                const cellNumFmt = cell.style && cell.style.numFmt;
                if(cellNumFmt){
                    if(cellNumFmt.includes('%')){
                        let precision = cellNumFmt.match(/\.(\d+)%/);
                        if(precision){
                            return (value * 100).toFixed(precision[1].length) + '%';
                        }else {
                            return parseFloat((value * 100).toFixed(12)) + '%';
                        }
                    }else if(/0(\.0+)?/.test(cellNumFmt)){
                        let prefix = '';
                        if(cellNumFmt.startsWith('$')){
                            prefix = '$';
                        }else if(cellNumFmt.startsWith('"¥') || cellNumFmt.startsWith('¥')){
                            prefix = '¥';
                        }

                        if(value === 0 && cellNumFmt.startsWith('_')){
                            return '-';
                        }
                        let precision = cellNumFmt.match(/0\.(0+)/);
                        if(precision){
                            precision = precision[1].length;
                        }else{
                            precision = 0;
                        }

                        let result = value.toFixed(precision) + '';
                        if(cellNumFmt.includes('#,##')){
                            //千分位
                            result = result.split('.');
                            let number = result[0].split('').reverse();
                            let newNumber = [];
                            for(let i = 0; i< number.length; i++){
                                newNumber.push(number[i]);
                                if((i+1) % 3 === 0 && i < number.length - 1 && number[i+1] !== '-'){
                                    newNumber.push(',');
                                }

                            }
                            result[0] = newNumber.reverse().join('');
                            result = result.join('.');
                        }
                        const suffixMatch = cellNumFmt.match(/[0#][^"]*?"([^"]+)"[^"]*$/);
                        const suffix = suffixMatch ? suffixMatch[1] : '';
                        return prefix + result + suffix;
                    }

                }
                return value + '';
            }catch (e){
                return value != null ? String(value) : '';
            }

        case 3: //字符串
            return value;
        case 4: { //日期
            switch (numFmt) {
                case 'yyyy-mm-dd;@':
                    return formatExcelDate(value, 'YYYY-MM-DD');
                case 'mm-dd-yy':
                    return formatExcelDate(value, 'YYYY/MM/DD');
                case '[$-F800]dddd, mmmm dd, yyyy':
                    return formatExcelDate(value, 'YYYY年M月D日 ddd');
                case 'm"月"d"日";@':
                    return formatExcelDate(value, 'M月D日');
                case 'yyyy/m/d h:mm;@':
                case 'm/d/yy "h":mm':
                    return formatExcelDate(value, 'YYYY/M/DD HH:mm');
                case 'h:mm;@':
                    return formatExcelDate(value, 'HH:mm');
                default:
                    if (numFmt && /h{1,2}:m{1,2}:s{1,2}/i.test(numFmt)) {
                        return formatExcelDate(value, /y|d/i.test(numFmt) ? 'YYYY-MM-DD HH:mm:ss' : 'HH:mm:ss');
                    }
                    if (numFmt && /h{1,2}:m{1,2}/i.test(numFmt)) {
                        return formatExcelDate(value, /y|d/i.test(numFmt) ? 'YYYY-MM-DD HH:mm' : 'HH:mm');
                    }
                    return formatExcelDate(value, 'YYYY-MM-DD');
            }
        }

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
                const fmt = numFmt && /h{1,2}:m{1,2}/i.test(numFmt)
                    ? (/y|d/i.test(numFmt) ? 'YYYY-MM-DD HH:mm' : 'HH:mm')
                    : 'YYYY-MM-DD';
                return formatExcelDate(value.result, fmt);
            }
            if (value.result && typeof value.result === 'object' && Array.isArray(value.result.richText)) {
                return value.result.richText.map(item => item.text || '').join('');
            }
            if (value.result === undefined || value.result === null) {
                return '';
            }
            return String(value.result);
        case 8: //富文本
            return cell.text || '';
        case 9: //Boolean
            return String(cell.text ?? value ?? '').toUpperCase();
        default:
            return value;
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
    if(style.fill && style.fill.fgColor) {
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
                    bordColor = transferArgbColor(originBorder.color.argb);
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

    if(style.font && style.font.size && typeof style.font.size === 'number'){
        style.font.size = Math.round(style.font.size / 1.333333);
    }
    return style;
}

export function transferExcelToSpreadSheet(workbook, options){
    let workbookData = [];
    let sheets = [];
    workbook.eachSheet((sheet) => {
        sheets.push(sheet);
        //console.log(sheet,'sheet');
        // 构造x-data-spreadsheet 的 sheet 数据源结构
        let sheetData = { name: sheet.name,styles : [], rows: {},cols:{}, merges:[],media:[] };
        // 收集合并单元格信息
        const mergeMap = new Map();
        const styleMap = new Map();
        for(let mergeRange in sheet._merges) {
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
            mergeMap.set(mergeAddress.startAddress, mergeAddress);
        }

        let effectiveMaxColLen = 0; //真正有数据的列长度，有时excel会展示一堆没数据的列
        // 遍历行
        (sheet._rows || []).forEach((row,spreadSheetRowIndex) =>{

            sheetData.rows[spreadSheetRowIndex] = { cells: {} };
            if(row._hidden){
                sheetData.rows[spreadSheetRowIndex].height = 0.1;
                row._cells = [];
            }else if(row.height){
                sheetData.rows[spreadSheetRowIndex].height = row.height + (options.heightOffset || 0);
            }else{
                sheetData.rows[spreadSheetRowIndex].height = defaultRowHeight + (options.heightOffset || 0);
            }
            //includeEmpty = false 不包含空白单元格
            (row._cells || []).forEach((cell, spreadSheetColIndex) =>{
                sheetData.rows[spreadSheetRowIndex].cells[spreadSheetColIndex] = {};
                effectiveMaxColLen = Math.max(effectiveMaxColLen, spreadSheetColIndex);

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
        }

        let tempRowsKeys = Object.keys(sheetData.rows);
        const maxRowLen = tempRowsKeys.length ? +tempRowsKeys[tempRowsKeys.length - 1] + 1 : 0;

        sheetData.rows.len = Math.max(maxRowLen,
            Object.prototype.hasOwnProperty.call(options, 'minRowLength') ? options.minRowLength : 100);

        if(sheet._columns && sheet._columns.length > effectiveMaxColLen + 1){
            sheet._columns = sheet._columns.slice(0, effectiveMaxColLen + 1);
        }
        transferColumns(sheet,sheetData, options);
        workbookData.push(sheetData);
    });
    // console.log(workbookData, 'workbookData');
    workbook._worksheets = sheets;
    return {
        workbookData,
        workbookSource: workbook,
        medias: workbook.media || []
    };
}