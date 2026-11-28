import Selector from './selector';
import Scroll from './scroll';
import History from './history';
import Clipboard from './clipboard';
import AutoFilter from './auto_filter';
import { Merges } from './merge';
import helper from './helper';
import { Rows, shiftFormulaRefs } from './row';
import { Cols } from './col';
import { Validations } from './validation';
import { CellRange } from './cell_range';
import { expr2xy, xy2expr } from './alphabet';
import { t } from '../locale/locale';
import { computeAutoFitCols, computeAutoFitRows } from './autofit';

// private methods
/*
 * {
 *  name: ''
 *  freeze: [0, 0],
 *  formats: [],
 *  styles: [
 *    {
 *      bgcolor: '',
 *      align: '',
 *      valign: '',
 *      textwrap: false,
 *      strike: false,
 *      underline: false,
 *      color: '',
 *      format: 1,
 *      border: {
 *        left: [style, color],
 *        right: [style, color],
 *        top: [style, color],
 *        bottom: [style, color],
 *      },
 *      font: {
 *        name: 'Helvetica',
 *        size: 10,
 *        bold: false,
 *        italic: false,
 *      }
 *    }
 *  ],
 *  merges: [
 *    'A1:F11',
 *    ...
 *  ],
 *  rows: {
 *    1: {
 *      height: 50,
 *      style: 1,
 *      cells: {
 *        1: {
 *          style: 2,
 *          type: 'string',
 *          text: '',
 *          value: '', // cal result
 *        }
 *      }
 *    },
 *    ...
 *  },
 *  cols: {
 *    2: { width: 100, style: 1 }
 *  }
 * }
 */
const defaultSettings = {
  mode: 'edit', // edit | read
  resizable: true,
  view: {
    height: () => (typeof document !== 'undefined' && document.documentElement ? document.documentElement.clientHeight : 0),
    width: () => (typeof document !== 'undefined' && document.documentElement ? document.documentElement.clientWidth : 0),
  },
  showGrid: true,
  showToolbar: true,
  showContextmenu: true,
  showBottomBar: true,
  row: {
    len: 100,
    height: 25,
  },
  col: {
    len: 26,
    width: 100,
    indexWidth: 60,
    minWidth: 60,
  },
  style: {
    bgcolor: '#ffffff',
    align: 'left',
    valign: 'middle',
    textwrap: false,
    strike: false,
    underline: false,
    color: '#0a0a0a',
    font: {
      name: 'Arial',
      size: 10,
      bold: false,
      italic: false,
    },
    format: 'normal',
  },
};

const toolbarHeight = 41;
const bottombarHeight = 41;

// src: cellRange
// dst: cellRange
function canPaste(src, dst, error = () => {}, autofill = false) {
  const { merges } = this;
  const cellRange = dst.clone();
  if (!autofill) {
    const [srn, scn] = src.size();
    const [drn, dcn] = dst.size();
    if (srn > drn) {
      cellRange.eri = dst.sri + srn - 1;
    }
    if (scn > dcn) {
      cellRange.eci = dst.sci + scn - 1;
    }
  }
  if (merges.intersects(cellRange)) {
    error(t('error.pasteForMergedCell'));
    return false;
  }
  return true;
}
function copyPaste(srcCellRange, dstCellRange, what, autofill = false) {
  const { rows, merges, validations } = this;
  const [srn, scn] = srcCellRange.size();
  const effectiveDst = dstCellRange.clone();
  if (!autofill) {
    effectiveDst.eri = Math.max(dstCellRange.eri, dstCellRange.sri + srn - 1);
    effectiveDst.eci = Math.max(dstCellRange.eci, dstCellRange.sci + scn - 1);
  }
  const beforeWrite = () => {
    if (what === 'all' || what === 'format') {
      rows.deleteCells(effectiveDst, what);
      merges.deleteWithin(effectiveDst);
    } else if (what === 'text') {
      rows.deleteCells(effectiveDst, what);
    }
  };
  rows.copyPaste(srcCellRange, effectiveDst, what, autofill, (ri, ci, cell) => {
    if (what !== 'text' && cell && cell.merge) {
      const [rn, cn] = cell.merge;
      if (rn > 0 || cn > 0) {
        if (ri + rn <= effectiveDst.eri && ci + cn <= effectiveDst.eci) {
          merges.add(new CellRange(ri, ci, ri + rn, ci + cn));
        }
      }
    }
  }, beforeWrite);
  if (what === 'all' || what === 'text') {
    effectiveDst.each((ri, ci) => {
      const c = rows.getCell(ri, ci);
      if (!c || c.editable !== false) {
        validations.validate(ri, ci, c && c.text != null ? c.text : '');
      }
    });
  }
}

function cutPaste(srcCellRange, dstCellRange, what = 'all') {
  const {
    clipboard, rows, merges, validations,
  } = this;
  const { dRi, dCi, movedCoords } = rows.cutPaste(srcCellRange, dstCellRange, what);
  if (what !== 'text') {
    merges.forEach((it) => {
      if (it.within(srcCellRange) && movedCoords.has(`${it.sri}:${it.sci}`)) {
        it.sri += dRi;
        it.eri += dRi;
        it.sci += dCi;
        it.eci += dCi;
      }
    });
  }
  srcCellRange.each((ri, ci) => {
    const sc = rows.getCell(ri, ci);
    if (!sc || sc.editable !== false) {
      validations.validate(ri, ci, sc && sc.text != null ? sc.text : '');
    }
    const dc = rows.getCell(ri + dRi, ci + dCi);
    if (!dc || dc.editable !== false) {
      validations.validate(ri + dRi, ci + dCi, dc && dc.text != null ? dc.text : '');
    }
  });
  clipboard.clear();
}

// bss: { top, bottom, left, right }
function setStyleBorder(ri, ci, bss) {
  const { styles, rows } = this;
  const cell = rows.getCellOrNew(ri, ci);
  let cstyle = {};
  if (cell.style !== undefined && styles[cell.style]) {
    cstyle = helper.cloneDeep(styles[cell.style]);
  }
  cstyle = helper.merge(cstyle, { border: bss });
  cell.style = this.addStyle(cstyle);
}

function setStyleBorders({ mode, style, color }) {
  const { styles, selector, rows } = this;
  const {
    sri, sci, eri, eci,
  } = selector.range;
  const multiple = !this.isSingleSelected();
  if (!multiple) {
    if (mode === 'inside' || mode === 'horizontal' || mode === 'vertical') {
      return;
    }
  }
  if (mode === 'outside' && !multiple) {
    setStyleBorder.call(this, this.mapRowIndex(sri), sci, {
      top: [style, color], bottom: [style, color], left: [style, color], right: [style, color],
    });
  } else if (mode === 'none') {
    selector.range.each((ri, ci) => {
      const nri = this.mapRowIndex(ri);
      const cell = rows.getCell(nri, ci);
      if (cell && cell.style !== undefined && styles[cell.style]) {
        const ns = helper.cloneDeep(styles[cell.style]);
        delete ns.border;
        cell.style = this.addStyle(ns);
      }
    });
  } else if (mode === 'all' || mode === 'inside' || mode === 'outside'
    || mode === 'horizontal' || mode === 'vertical') {
    const merges = [];
    for (let ri = sri; ri <= eri; ri += 1) {
      const nri = this.mapRowIndex(ri);
      for (let ci = sci; ci <= eci; ci += 1) {
        // jump merges -- start
        let skipped = false;
        for (let ii = merges.length - 1; ii >= 0; ii -= 1) {
          const [mri, mci, rn, cn] = merges[ii];
          if (ri > mri + rn) {
            merges.splice(ii, 1);
          } else if (mri <= ri && ri <= mri + rn && ci >= mci && ci <= mci + cn) {
            ci = mci + cn;
            skipped = true;
            break;
          }
        }
        if (skipped) continue;
        // jump merges -- end
        const cell = rows.getCell(nri, ci);
        let [rn, cn] = [0, 0];
        if (cell && cell.merge) {
          [rn, cn] = cell.merge;
          merges.push([ri, ci, rn, cn]);
        }
        const mrl = rn > 0 && ri + rn === eri;
        const mcl = cn > 0 && ci + cn === eci;
        let bss = {};
        if (mode === 'all') {
          bss = {
            bottom: [style, color],
            top: [style, color],
            left: [style, color],
            right: [style, color],
          };
        } else if (mode === 'inside') {
          if (!mcl && ci < eci) bss.right = [style, color];
          if (!mrl && ri < eri) bss.bottom = [style, color];
        } else if (mode === 'horizontal') {
          if (!mrl && ri < eri) bss.bottom = [style, color];
        } else if (mode === 'vertical') {
          if (!mcl && ci < eci) bss.right = [style, color];
        } else if (mode === 'outside' && multiple) {
          if (sri === ri) bss.top = [style, color];
          if (mrl || eri === ri) bss.bottom = [style, color];
          if (sci === ci) bss.left = [style, color];
          if (mcl || eci === ci) bss.right = [style, color];
        }
        if (Object.keys(bss).length > 0) {
          setStyleBorder.call(this, nri, ci, bss);
        }
        ci += cn;
      }
    }
  } else if (mode === 'top' || mode === 'bottom') {
    for (let ci = sci; ci <= eci; ci += 1) {
      if (mode === 'top') {
        const m = this.merges.getFirstIncludes(sri, ci);
        const targetRi = this.mapRowIndex(m ? m.sri : sri);
        const targetCi = m ? m.sci : ci;
        setStyleBorder.call(this, targetRi, targetCi, { top: [style, color] });
        ci += m ? (m.eci - ci) : rows.getCellMerge(targetRi, ci)[1];
      }
      if (mode === 'bottom') {
        const m = this.merges.getFirstIncludes(eri, ci);
        const targetRi = this.mapRowIndex(m ? m.sri : eri);
        const targetCi = m ? m.sci : ci;
        setStyleBorder.call(this, targetRi, targetCi, { bottom: [style, color] });
        ci += m ? (m.eci - ci) : rows.getCellMerge(targetRi, ci)[1];
      }
    }
  } else if (mode === 'left' || mode === 'right') {
    for (let ri = sri; ri <= eri; ri += 1) {
      if (mode === 'left') {
        const m = this.merges.getFirstIncludes(ri, sci);
        const targetRi = this.mapRowIndex(m ? m.sri : ri);
        const targetCi = m ? m.sci : sci;
        setStyleBorder.call(this, targetRi, targetCi, { left: [style, color] });
        ri += m ? (m.eri - ri) : rows.getCellMerge(targetRi, sci)[0];
      }
      if (mode === 'right') {
        const m = this.merges.getFirstIncludes(ri, eci);
        const targetRi = this.mapRowIndex(m ? m.sri : ri);
        const targetCi = m ? m.sci : eci;
        setStyleBorder.call(this, targetRi, targetCi, { right: [style, color] });
        ri += m ? (m.eri - ri) : rows.getCellMerge(targetRi, eci)[0];
      }
    }
  }
}

function getCellRowByY(y, scrollOffsety) {
  const { rows } = this;
  if (y < rows.height) {
    return { ri: -1, top: 0, height: rows.height };
  }
  const fsh = this.freezeTotalHeight();
  let inits = rows.height;
  if (fsh + rows.height <= y) inits -= scrollOffsety;

  // handle ri in autofilter
  const frset = this.exceptRowSet;

  let ri = 0;
  let top = inits;
  let height = rows.height;
  let lastVisibleRi = -1;
  let lastVisibleTop = inits;
  let lastVisibleHeight = rows.height;
  for (; ri < rows.len; ri += 1) {
    if (top > y) break;
    if (!frset.has(ri)) {
      height = rows.getHeight(ri);
      if (height > 0) {
        lastVisibleRi = ri;
        lastVisibleTop = top;
        lastVisibleHeight = height;
        top += height;
      }
    }
  }
  if (lastVisibleRi < 0) {
    return { ri: -1, top: 0, height: rows.height };
  }

  return { ri: lastVisibleRi, top: lastVisibleTop, height: lastVisibleHeight };
}

function getCellColByX(x, scrollOffsetx) {
  const { cols } = this;
  if (x < cols.indexWidth) {
    return { ci: -1, left: 0, width: cols.indexWidth };
  }
  const fsw = this.freezeTotalWidth();
  let inits = cols.indexWidth;
  if (fsw + cols.indexWidth <= x) inits -= scrollOffsetx;
  let left = inits;
  let lastVisibleCi = -1;
  let lastVisibleLeft = inits;
  let lastVisibleWidth = cols.indexWidth;
  for (let ci = 0; ci < cols.len; ci += 1) {
    if (left > x) break;
    const width = cols.getWidth(ci);
    if (width > 0) {
      lastVisibleCi = ci;
      lastVisibleLeft = left;
      lastVisibleWidth = width;
      left += width;
    }
  }
  if (lastVisibleCi < 0) {
    return { ci: -1, left: 0, width: cols.indexWidth };
  }
  return { ci: lastVisibleCi, left: lastVisibleLeft, width: lastVisibleWidth };
}

export default class DataProxy {
  constructor(name, settings) {
    this.settings = helper.merge(defaultSettings, settings || {});
    // save data begin
    this.name = name || 'sheet';
    this.freeze = [0, 0];
    this.styles = []; // Array<Style>
    this.merges = new Merges(); // [CellRange, ...]
    this.rows = new Rows(this.settings.row);
    this.cols = new Cols(this.settings.col);
    this.validations = new Validations();
    this.hyperlinks = {};
    this.comments = {};
    this.media = [];
    // save data end

    // don't save object
    this.selector = new Selector();
    this.scroll = new Scroll();
    this.history = new History();
    this.clipboard = new Clipboard();
    this.autoFilter = new AutoFilter();
    this.change = () => {};
    this.exceptRowSet = new Set();
    this.sortedRowMap = new Map();
    this.unsortedRowMap = new Map();
    this._editingOrigin = null;
  }

  addValidation(mode, ref, validator) {
    if (!CellRange.isValidRef(ref)) return;
    this.changeData(() => {
      this.validations.add(mode, ref, validator);
      const cr = CellRange.valueOf(ref);
      cr.each((ri, ci) => {
        const cell = this.rows.getCell(ri, ci);
        this.validations.validate(ri, ci, cell && cell.text != null ? cell.text : '');
      });
    });
  }

  removeValidation() {
    const { range } = this.selector;
    this.changeData(() => {
      this.validations.remove(range);
    });
  }

  mapRowIndex(ri) {
    return (this.sortedRowMap && this.sortedRowMap.has(ri)) ? this.sortedRowMap.get(ri) : ri;
  }

  getSelectedValidator() {
    const { ri, ci } = this.selector;
    const v = this.validations.get(this.mapRowIndex(ri), ci);
    return v ? v.validator : null;
  }

  getSelectedValidation() {
    const { ri, ci, range } = this.selector;
    const v = this.validations.get(this.mapRowIndex(ri), ci);
    const ret = { ref: range.toString() };
    if (v !== null) {
      ret.mode = v.mode;
      ret.validator = v.validator;
    }
    return ret;
  }

  canUndo() {
    return this.history.canUndo();
  }

  canRedo() {
    return this.history.canRedo();
  }

  undo() {
    this.history.undo(this.getData(), (d) => {
      this.setData(d);
      this.change(this.getData());
    });
  }

  redo() {
    this.history.redo(this.getData(), (d) => {
      this.setData(d);
      this.change(this.getData());
    });
  }

  copy() {
    this.clipboard.copy(this.selector.range);
  }

  copyToSystemClipboard(evt) {
    let copyText = [];
    const {
      sri, eri, sci, eci,
    } = this.selector.range;

    for (let ri = sri; ri <= eri; ri += 1) {
      if (this.exceptRowSet.has(ri)) continue;
      const nri = this.sortedRowMap.has(ri) ? this.sortedRowMap.get(ri) : ri;
      const row = [];
      for (let ci = sci; ci <= eci; ci += 1) {
        const cell = this.getCell(nri, ci);
        row.push((cell && cell.text != null) ? cell.text : '');
      }
      copyText.push(row);
    }

    // Adding \n and why not adding \r\n is to support online office and client MS office and WPS
    copyText = copyText.map(row => row.join('\t')).join('\n');

    // why used this
    // cuz http protocol will be blocked request clipboard by browser
    if (evt && evt.clipboardData) {
      evt.clipboardData.clearData();
      evt.clipboardData.setData('text/plain', copyText);
      evt.preventDefault();
      return;
    }

    // this need https protocol
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(copyText).then(() => {}, (err) => {
        console.log('text copy to the system clipboard error  ', copyText, err);
      });
    }
  }

  cut() {
    this.clipboard.cut(this.selector.range);
  }

  // what: all | text | format
  paste(what = 'all', error = () => {}) {
    // console.log('sIndexes:', sIndexes);
    const { clipboard, selector } = this;
    if (clipboard.isClear()) return false;
    if (!canPaste.call(this, clipboard.range, selector.range, error)) return false;

    this.changeData(() => {
      if (clipboard.isCopy()) {
        copyPaste.call(this, clipboard.range, selector.range, what);
      } else if (clipboard.isCut()) {
        cutPaste.call(this, clipboard.range, selector.range, what);
      }
    });
    return true;
  }

  pasteFromSystemClipboard(resetSheet, eventTrigger) {
    if (typeof navigator === 'undefined' || !navigator.clipboard || typeof navigator.clipboard.readText !== 'function') {
      return Promise.resolve();
    }
    const { selector } = this;
    return navigator.clipboard.readText().then((content) => {
      const contentToPaste = this.parseClipboardContent(content);
      if (contentToPaste.length === 0) return;
      let startRow = selector.range.sri >= 0 ? selector.range.sri : selector.ri;
      const baseCol = selector.range.sci >= 0 ? selector.range.sci : selector.ci;
      this.changeData(() => {
        contentToPaste.forEach((row) => {
          while (this.exceptRowSet && this.exceptRowSet.has(startRow)) {
            startRow += 1;
          }
          if (startRow >= this.rows.len) {
            this.rows.len = startRow + 1;
          }
          const targetRow = this.mapRowIndex(startRow);
          let startColumn = baseCol;
          row.forEach((cellContent) => {
            if (startColumn >= this.cols.len) {
              this.cols.len = startColumn + 1;
            }
            this.rows.setCellText(targetRow, startColumn, cellContent);
            const updatedCell = this.rows.getCell(targetRow, startColumn);
            if (!updatedCell || updatedCell.editable !== false) {
              this.validations.validate(targetRow, startColumn, cellContent);
            }
            startColumn += 1;
          });
          startRow += 1;
        });
      });
      resetSheet();
      eventTrigger(this.rows.getData());
    }).catch(() => {});
  }

  parseClipboardContent(clipboardContent) {
    const raw = String(clipboardContent == null ? '' : clipboardContent);
    if (raw === '') return [];
    const normalized = raw.endsWith('\r\n')
      ? raw.slice(0, -2)
      : (raw.endsWith('\n') || raw.endsWith('\r') ? raw.slice(0, -1) : raw);
    const rows = [];
    let currentRow = [];
    let currentField = '';
    let inQuotes = false;
    for (let i = 0; i < normalized.length; i += 1) {
      const ch = normalized[i];
      if (inQuotes) {
        if (ch === '"') {
          if (normalized[i + 1] === '"') {
            currentField += '"';
            i += 1;
          } else {
            inQuotes = false;
          }
        } else {
          currentField += ch;
        }
      } else if (ch === '"' && currentField.length === 0) {
        inQuotes = true;
      } else if (ch === '\t') {
        currentRow.push(currentField);
        currentField = '';
      } else if (ch === '\r' || ch === '\n') {
        if (ch === '\r' && normalized[i + 1] === '\n') {
          i += 1;
        }
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += ch;
      }
    }
    currentRow.push(currentField);
    rows.push(currentRow);
    return rows;
  }

  pasteFromText(txt) {
    const raw = String(txt == null ? '' : txt);
    if (raw === '') return;
    const lines = this.parseClipboardContent(raw);
    if (lines.length) {
      const { rows, selector, validations } = this;
      this.changeData(() => {
        let curVisualRi = selector.range.sri >= 0 ? selector.range.sri : selector.ri;
        const baseCi = selector.range.sci >= 0 ? selector.range.sci : selector.ci;
        lines.forEach((row) => {
          while (this.exceptRowSet && this.exceptRowSet.has(curVisualRi)) {
            curVisualRi += 1;
          }
          if (curVisualRi >= rows.len) {
            rows.len = curVisualRi + 1;
          }
          const ri = this.mapRowIndex(curVisualRi);
          row.forEach((cellVal, j) => {
            const ci = baseCi + j;
            if (ci >= this.cols.len) {
              this.cols.len = ci + 1;
            }
            rows.setCellText(ri, ci, cellVal);
            const updatedCell = rows.getCell(ri, ci);
            if (!updatedCell || updatedCell.editable !== false) {
              validations.validate(ri, ci, cellVal);
            }
          });
          curVisualRi += 1;
        });
      });
    }
  }

  autofill(cellRange, what, error = () => {}) {
    const srcRange = this.selector.range;
    if (!canPaste.call(this, srcRange, cellRange, error, true)) return false;
    this.changeData(() => {
      copyPaste.call(this, srcRange, cellRange, what, true);
    });
    return true;
  }

  clearClipboard() {
    this.clipboard.clear();
  }

  calSelectedRangeByEnd(ri, ci) {
    const {
      selector, rows, cols, merges,
    } = this;
    let {
      sri, sci, eri, eci,
    } = selector.range;
    const cri = selector.ri;
    const cci = selector.ci;
    if (ri < 0) {
      sri = 0;
      eri = Math.max(0, rows.len - 1);
    } else if (ri > cri) {
      [sri, eri] = [cri, ri];
    } else {
      [sri, eri] = [ri, cri];
    }
    if (ci < 0) {
      sci = 0;
      eci = Math.max(0, cols.len - 1);
    } else if (ci > cci) {
      [sci, eci] = [cci, ci];
    } else {
      [sci, eci] = [ci, cci];
    }
    selector.range = merges.union(new CellRange(
      sri, sci, eri, eci,
    ));
    return selector.range;
  }

  calSelectedRangeByStart(ri, ci) {
    const {
      selector, rows, cols, merges,
    } = this;
    let cellRange = merges.getFirstIncludes(ri, ci);
    // console.log('cellRange:', cellRange, ri, ci, merges);
    if (cellRange === null) {
      cellRange = new CellRange(ri, ci, ri, ci);
      if (ri === -1) {
        cellRange.sri = 0;
        cellRange.eri = rows.len - 1;
      }
      if (ci === -1) {
        cellRange.sci = 0;
        cellRange.eci = cols.len - 1;
      }
    }
    selector.range = cellRange;
    return cellRange;
  }

  setSelectedCellAttr(property, value) {
    if (property === 'merge') {
      if (value) this.merge();
      else this.unmerge();
      return;
    }
    this.changeData(() => {
      const { selector, styles, rows } = this;
      if (property === 'border') {
        setStyleBorders.call(this, value);
      } else if (property === 'formula') {
        const { ri, ci, range } = selector;
        if (!this.isSingleSelected()) {
          const [rn, cn] = selector.size();
          const {
            sri, sci, eri, eci,
          } = range;
          if (rn > 1) {
            const targetRi = eri + 1;
            if (targetRi >= rows.len) {
              rows.len = targetRi + 1;
            }
            for (let i = sci; i <= eci; i += 1) {
              const mappedTarget = this.mapRowIndex(targetRi);
              const cell = rows.getCellOrNew(mappedTarget, i);
              if (cell.editable !== false) {
                cell.text = `=${value}(${xy2expr(i, sri)}:${xy2expr(i, eri)})`;
              }
            }
          } else if (cn > 1) {
            const targetCi = eci + 1;
            if (targetCi >= this.cols.len) {
              this.cols.len = targetCi + 1;
            }
            const mappedRi = this.mapRowIndex(ri);
            const cell = rows.getCellOrNew(mappedRi, targetCi);
            if (cell.editable !== false) {
              cell.text = `=${value}(${xy2expr(sci, ri)}:${xy2expr(eci, ri)})`;
            }
          }
        } else {
          const mappedRi = this.mapRowIndex(ri);
          const cell = rows.getCellOrNew(mappedRi, ci);
          if (cell.editable !== false) {
            cell.text = `=${value}()`;
          }
        }
      } else {
        selector.range.each((ri, ci) => {
          const nri = this.mapRowIndex(ri);
          const cell = rows.getCellOrNew(nri, ci);
          let cstyle = {};
          if (cell.style !== undefined && styles[cell.style]) {
            cstyle = helper.cloneDeep(styles[cell.style]);
          }
          if (property === 'format') {
            cstyle.format = value;
            cell.style = this.addStyle(cstyle);
          } else if (property === 'font-bold' || property === 'font-italic'
            || property === 'font-name' || property === 'font-size') {
            const nfont = {};
            nfont[property.split('-')[1]] = value;
            cstyle.font = Object.assign(cstyle.font || {}, nfont);
            cell.style = this.addStyle(cstyle);
          } else if (property === 'strike' || property === 'textwrap'
            || property === 'underline'
            || property === 'align' || property === 'valign'
            || property === 'color' || property === 'bgcolor') {
            cstyle[property] = value;
            cell.style = this.addStyle(cstyle);
          } else {
            cell[property] = value;
          }
        });
      }
    });
  }

  // state: input | finished
  setSelectedCellText(text, state = 'input') {
    const { autoFilter, selector, rows } = this;
    const { ri, ci } = selector;
    const nri = this.mapRowIndex(ri);
    const hasOrigin = this._editingOrigin && this._editingOrigin.ri === nri && this._editingOrigin.ci === ci;
    const oldCell = rows.getCell(nri, ci);
    const rawOld = hasOrigin ? this._editingOrigin.text : (oldCell && oldCell.text != null ? oldCell.text : '');
    const oldText = (rawOld != null && !/^\s*$/.test(String(rawOld))) ? String(rawOld) : '';
    const updateAutoFilter = () => {
      if (state === 'finished' && autoFilter.active()) {
        const afRange = autoFilter.range();
        if (afRange.includes(nri, ci) && nri > afRange.sri) {
          const filter = autoFilter.getFilter(ci);
          if (filter && filter.operator === 'in' && Array.isArray(filter.value)) {
            const items = autoFilter.items(ci, (r, c) => rows.getCell(r, c));
            const normalizedNew = (text != null && !/^\s*$/.test(String(text))) ? String(text) : '';
            const hasNew = filter.value.some(v => String(v) === normalizedNew);
            if (!hasNew) {
              const vIndex = filter.value.findIndex(v => String(v) === oldText);
              if (!items[oldText] && vIndex >= 0) {
                filter.value.splice(vIndex, 1, normalizedNew);
              } else {
                filter.value.push(normalizedNew);
              }
            } else if (!items[oldText] && oldText !== normalizedNew) {
              const vIndex = filter.value.findIndex(v => String(v) === oldText);
              if (vIndex >= 0) {
                filter.value.splice(vIndex, 1);
              }
            }
          }
        }
      }
    };
    this.setCellText(nri, ci, text, state, updateAutoFilter);
  }

  getSelectedCell() {
    const { ri, ci } = this.selector;
    return this.rows.getCell(this.mapRowIndex(ri), ci);
  }

  xyInSelectedRect(x, y) {
    const {
      left, top, l, t, width, height,
    } = this.getSelectedRect();
    const x1 = x - this.cols.indexWidth;
    const y1 = y - this.rows.height;
    const fsw = this.freezeTotalWidth();
    const fsh = this.freezeTotalHeight();
    if (fsw > 0 && l >= fsw && x1 < fsw) return false;
    if (fsh > 0 && t >= fsh && y1 < fsh) return false;
    return x1 > left && x1 < (left + width)
      && y1 > top && y1 < (top + height);
  }

  getSelectedRect() {
    return this.getRect(this.selector.range);
  }

  getClipboardRect() {
    const { clipboard } = this;
    if (!clipboard.isClear()) {
      return this.getRect(clipboard.range);
    }
    return { left: -100, top: -100 };
  }

  getRect(cellRange) {
    const {
      scroll, rows, cols, exceptRowSet,
    } = this;
    const {
      sri, sci, eri, eci,
    } = cellRange;
    // console.log('sri:', sri, ',sci:', sci, ', eri:', eri, ', eci:', eci);
    // no selector
    if (sri < 0 && sci < 0) {
      return {
        left: 0, l: 0, top: 0, t: 0, width: 0, height: 0, scroll,
      };
    }
    const left = sci > 0 ? cols.sumWidth(0, sci) : 0;
    const top = sri > 0 ? rows.sumHeight(0, sri, exceptRowSet) : 0;
    const height = eri >= Math.max(0, sri) ? rows.sumHeight(Math.max(0, sri), eri + 1, exceptRowSet) : 0;
    const width = eci >= Math.max(0, sci) ? cols.sumWidth(Math.max(0, sci), eci + 1) : 0;
    // console.log('sri:', sri, ', sci:', sci, ', eri:', eri, ', eci:', eci);
    let left0 = left - scroll.x;
    let top0 = top - scroll.y;
    const fsh = this.freezeTotalHeight();
    const fsw = this.freezeTotalWidth();
    if (fsw > 0 && fsw > left) {
      left0 = left;
    }
    if (fsh > 0 && fsh > top) {
      top0 = top;
    }
    return {
      l: left,
      t: top,
      left: left0,
      top: top0,
      height,
      width,
      scroll,
    };
  }

  getCellRectByXY(x, y) {
    const {
      scroll, merges, rows, cols,
    } = this;
    let { ri, top, height } = getCellRowByY.call(this, y, scroll.y);
    let { ci, left, width } = getCellColByX.call(this, x, scroll.x);
    if (ci === -1) {
      width = cols.totalWidth();
    }
    if (ri === -1) {
      height = rows.totalHeight();
    }
    if (ri >= 0 && ci >= 0) {
      const merge = merges.getFirstIncludes(ri, ci);
      if (merge) {
        ri = merge.sri;
        ci = merge.sci;
        const rect = this.getRect(merge);
        left = rect.left + cols.indexWidth;
        top = rect.top + rows.height;
        width = rect.width;
        height = rect.height;
      }
    }
    return {
      ri, ci, left, top, width, height,
    };
  }

  isSingleSelected() {
    const {
      sri, sci, eri, eci,
    } = this.selector.range;
    const cell = this.getCell(this.mapRowIndex(sri), sci);
    if (cell && cell.merge) {
      const [rn, cn] = cell.merge;
      if (sri + rn === eri && sci + cn === eci) return true;
    }
    return !this.selector.multiple();
  }

  canUnmerge() {
    const {
      sri, sci, eri, eci,
    } = this.selector.range;
    const cell = this.getCell(this.mapRowIndex(sri), sci);
    if (cell && cell.merge) {
      const [rn, cn] = cell.merge;
      if (sri + rn === eri && sci + cn === eci) return true;
    }
    return false;
  }

  merge() {
    const { selector, rows, validations } = this;
    if (this.isSingleSelected()) return;
    const [rn, cn] = selector.size();
    if (rn > 1 || cn > 1) {
      let hasLocked = false;
      selector.range.each((ri, ci) => {
        const c = rows.getCell(this.mapRowIndex(ri), ci);
        if (c && c.editable === false) {
          hasLocked = true;
        }
      });
      if (hasLocked) return;
      const { sri, sci } = selector.range;
      this.changeData(() => {
        const cell = helper.cloneDeep(rows.getCell(sri, sci) || {});
        cell.merge = [rn - 1, cn - 1];
        this.merges.add(selector.range);
        this.rows.deleteCells(selector.range);
        this.rows.setCell(sri, sci, cell);
        selector.range.each((ri, ci) => {
          if (ri !== sri || ci !== sci) {
            validations.validate(ri, ci, '');
          }
        });
      });
    }
  }

  unmerge() {
    const { selector, rows } = this;
    if (!this.canUnmerge()) return;
    const { sri, sci } = selector.range;
    const nri = this.mapRowIndex(sri);
    const cell = rows.getCell(nri, sci);
    if (cell && cell.editable === false) return;
    this.changeData(() => {
      this.rows.deleteCell(nri, sci, 'merge');
      this.merges.deleteWithin(selector.range);
    });
  }

  canAutofilter() {
    return !this.autoFilter.active();
  }

  autofilter() {
    const { autoFilter, selector } = this;
    this.changeData(() => {
      if (autoFilter.active()) {
        autoFilter.clear();
        this.exceptRowSet = new Set();
        this.sortedRowMap = new Map();
        this.unsortedRowMap = new Map();
      } else {
        autoFilter.ref = selector.range.toString();
      }
    });
  }

  setAutoFilter(ci, order, operator, value) {
    this.changeData(() => {
      const { autoFilter } = this;
      autoFilter.addFilter(ci, operator, value);
      autoFilter.setSort(ci, order);
      this.resetAutoFilter();
    });
  }

  resetAutoFilter() {
    const { autoFilter, rows } = this;
    if (!autoFilter.active()) {
      this.exceptRowSet = new Set();
      this.sortedRowMap = new Map();
      this.unsortedRowMap = new Map();
      return;
    }
    const { sort } = autoFilter;
    const { rset, fset } = autoFilter.filteredRows((r, c) => rows.getCell(r, c));
    const fary = Array.from(fset);
    const oldAry = Array.from(fset);
    if (sort) {
      const getSortText = (r) => {
        const c = rows.getCell(r, sort.ci);
        return (c && c.text != null) ? String(c.text) : '';
      };
      fary.sort((a, b) => {
        const va = getSortText(a);
        const vb = getSortText(b);
        const trimA = va.trim();
        const trimB = vb.trim();
        const na = trimA === '' ? NaN : Number(trimA);
        const nb = trimB === '' ? NaN : Number(trimB);
        const isNumA = Number.isFinite(na);
        const isNumB = Number.isFinite(nb);
        let cmp = 0;
        if (isNumA && isNumB) {
          cmp = na - nb;
        } else if (isNumA !== isNumB) {
          cmp = isNumA ? -1 : 1;
        } else {
          const emptyA = trimA === '';
          const emptyB = trimB === '';
          if (emptyA !== emptyB) {
            cmp = emptyA ? 1 : -1;
          } else {
            cmp = va.localeCompare(vb);
          }
        }
        if (sort.order === 'asc') return cmp;
        if (sort.order === 'desc') return -cmp;
        return 0;
      });
    }
    this.exceptRowSet = rset;
    this.sortedRowMap = new Map();
    this.unsortedRowMap = new Map();
    fary.forEach((it, index) => {
      this.sortedRowMap.set(oldAry[index], it);
      this.unsortedRowMap.set(it, oldAry[index]);
    });
  }

  deleteCell(what = 'all') {
    const {
      selector, rows, merges, validations,
    } = this;
    this.changeData(() => {
      selector.range.each((ri, ci) => {
        const nri = this.mapRowIndex(ri);
        rows.deleteCell(nri, ci, what);
        if (what === 'all' || what === 'text') {
          const afterCell = rows.getCell(nri, ci);
          if (!afterCell || afterCell.editable !== false) {
            validations.validate(nri, ci, '');
          }
        }
      });
      if (what === 'all' || what === 'format') {
        merges._ = merges._.filter((it) => {
          if (!it.within(selector.range)) return true;
          const masterCell = rows.getCell(this.mapRowIndex(it.sri), it.sci);
          return Boolean(masterCell && masterCell.editable === false);
        });
      }
    });
  }

  shiftRefsAndMeta(type, si, delta, delEnd = -1) {
    const shiftRef = (ref) => {
      if (!CellRange.isValidRef(ref)) return null;
      const cr = CellRange.valueOf(ref);
      if (delta > 0) {
        if (type === 'row') {
          if (cr.sri >= si) cr.sri += delta;
          if (cr.eri >= si) cr.eri += delta;
        } else if (type === 'column') {
          if (cr.sci >= si) cr.sci += delta;
          if (cr.eci >= si) cr.eci += delta;
        }
        return cr.toString();
      }
      const delCount = -delta;
      if (type === 'row') {
        if (cr.sri >= si && cr.eri <= delEnd) return null;
        if (cr.sri > delEnd) cr.sri -= delCount;
        else if (cr.sri >= si) cr.sri = si;
        if (cr.eri > delEnd) cr.eri -= delCount;
        else if (cr.eri >= si) cr.eri = si - 1;
        if (cr.eri < cr.sri) return null;
      } else if (type === 'column') {
        if (cr.sci >= si && cr.eci <= delEnd) return null;
        if (cr.sci > delEnd) cr.sci -= delCount;
        else if (cr.sci >= si) cr.sci = si;
        if (cr.eci > delEnd) cr.eci -= delCount;
        else if (cr.eci >= si) cr.eci = si - 1;
        if (cr.eci < cr.sci) return null;
      }
      return cr.toString();
    };
    if (this.autoFilter && this.autoFilter.active()) {
      const nextAfRef = shiftRef(this.autoFilter.ref);
      if (!nextAfRef) {
        this.autoFilter.clear();
      } else {
        this.autoFilter.ref = nextAfRef;
        if (type === 'column') {
          const delCount = delta < 0 ? -delta : 0;
          this.autoFilter.filters = this.autoFilter.filters.filter((f) => {
            if (delta > 0) {
              if (f.ci >= si) f.ci += delta;
              return true;
            }
            if (f.ci >= si && f.ci <= delEnd) return false;
            if (f.ci > delEnd) f.ci -= delCount;
            return true;
          });
          if (this.autoFilter.sort) {
            if (delta > 0) {
              if (this.autoFilter.sort.ci >= si) this.autoFilter.sort.ci += delta;
            } else if (this.autoFilter.sort.ci >= si && this.autoFilter.sort.ci <= delEnd) {
              this.autoFilter.sort = null;
            } else if (this.autoFilter.sort.ci > delEnd) {
              this.autoFilter.sort.ci -= delCount;
            }
          }
        }
      }
      this.resetAutoFilter();
    }
    if (this.validations && Array.isArray(this.validations._)) {
      this.validations._.forEach((v) => {
        v.refs = v.refs.map(shiftRef).filter(Boolean);
      });
      this.validations._ = this.validations._.filter(v => v.refs.length > 0);
      if (this.validations.errors && this.validations.errors.size > 0) {
        const nextErrors = new Map();
        const delCount = delta < 0 ? -delta : 0;
        this.validations.errors.forEach((msg, key) => {
          const [rStr, cStr] = key.split('_');
          let r = parseInt(rStr, 10);
          let c = parseInt(cStr, 10);
          if (type === 'row') {
            if (delta > 0) {
              if (r >= si) r += delta;
            } else if (r >= si && r <= delEnd) {
              return;
            } else if (r > delEnd) {
              r -= delCount;
            }
          } else if (type === 'column') {
            if (delta > 0) {
              if (c >= si) c += delta;
            } else if (c >= si && c <= delEnd) {
              return;
            } else if (c > delEnd) {
              c -= delCount;
            }
          }
          nextErrors.set(`${r}_${c}`, msg);
        });
        this.validations.errors = nextErrors;
      }
    }
  }

  // type: row | column
  insert(type, n = 1) {
    if ((type !== 'row' && type !== 'column') || !Number.isInteger(n) || n <= 0) {
      return;
    }
    this.changeData(() => {
      const { sri, sci } = this.selector.range;
      const { rows, merges, cols } = this;
      let si = sri;
      if (type === 'row') {
        rows.insert(sri, n);
      } else if (type === 'column') {
        rows.insertColumn(sci, n);
        si = sci;
        cols.len += n;
        Object.keys(cols._).reverse().forEach((colIndex) => {
          const col = parseInt(colIndex, 10);
          if (col >= sci) {
            cols._[col + n] = cols._[col];
            delete cols._[col];
          }
        });
      }
      merges.shift(type, si, n, (ri, ci, rn, cn) => {
        const cell = rows.getCell(ri, ci);
        if (cell && cell.merge) {
          cell.merge[0] += rn;
          cell.merge[1] += cn;
        }
      });
      this.shiftRefsAndMeta(type, si, n);
    });
  }

  // type: row | column
  delete(type) {
    if (type !== 'row' && type !== 'column') {
      return;
    }
    const { range } = this.selector;
    const [rsize, csize] = range.size();
    if (type === 'row' && rsize >= this.rows.len) {
      return;
    }
    if (type === 'column' && csize >= this.cols.len) {
      return;
    }
    this.changeData(() => {
      const {
        rows, merges, selector, cols,
      } = this;
      const {
        sri, sci, eri, eci,
      } = selector.range;
      let si = sri;
      let size = rsize;
      const delEnd = type === 'row' ? eri : eci;
      if (type === 'column') {
        si = selector.range.sci;
        size = csize;
      }
      const survivingMasters = [];
      merges.forEach((m) => {
        if (type === 'row' && m.sri >= si && m.sri <= delEnd && m.eri > delEnd) {
          const mc = rows.getCell(m.sri, m.sci);
          if (mc) {
            const cloned = helper.cloneDeep(mc);
            if (cloned.text && typeof cloned.text === 'string' && cloned.text[0] === '=') {
              cloned.text = shiftFormulaRefs(
                cloned.text,
                0,
                -size,
                (_x, y) => y > delEnd,
                true,
                { axis: 'row', start: si, end: delEnd },
              );
            }
            survivingMasters.push({
              ri: si,
              ci: m.sci,
              cell: cloned,
              rn: m.eri - delEnd - 1,
              cn: m.eci - m.sci,
            });
          }
        } else if (type === 'column' && m.sci >= si && m.sci <= delEnd && m.eci > delEnd) {
          const mc = rows.getCell(m.sri, m.sci);
          if (mc) {
            const cloned = helper.cloneDeep(mc);
            if (cloned.text && typeof cloned.text === 'string' && cloned.text[0] === '=') {
              cloned.text = shiftFormulaRefs(
                cloned.text,
                -size,
                0,
                x => x > delEnd,
                true,
                { axis: 'col', start: si, end: delEnd },
              );
            }
            survivingMasters.push({
              ri: m.sri,
              ci: si,
              cell: cloned,
              rn: m.eri - m.sri,
              cn: m.eci - delEnd - 1,
            });
          }
        }
      });

      if (type === 'row') {
        rows.delete(sri, eri);
        rows.len = Math.max(1, rows.len);
      } else if (type === 'column') {
        rows.deleteColumn(sci, eci);
        cols.len = Math.max(1, cols.len - (eci - sci + 1));
        Object.keys(cols._).forEach((colIndex) => {
          const col = parseInt(colIndex, 10);
          if (col >= sci) {
            if (col > eci) cols._[col - (eci - sci + 1)] = cols._[col];
            delete cols._[col];
          }
        });
      }
      merges.shift(type, si, -size, (ri, ci, rn, cn) => {
        const cell = rows.getCell(ri, ci);
        if (cell && cell.merge) {
          cell.merge[0] += rn;
          cell.merge[1] += cn;
          if (cell.merge[0] <= 0 && cell.merge[1] <= 0) {
            delete cell.merge;
          }
        }
      });
      survivingMasters.forEach(({
        ri, ci, cell, rn, cn,
      }) => {
        if (rn <= 0 && cn <= 0) {
          delete cell.merge;
        } else {
          cell.merge = [rn, cn];
        }
        rows.setCell(ri, ci, cell, 'all', true);
      });

      const maxRi = Math.max(0, rows.len - 1);
      const maxCi = Math.max(0, cols.len - 1);
      selector.range.sri = Math.min(selector.range.sri, maxRi);
      selector.range.eri = Math.min(Math.max(selector.range.sri, selector.range.eri), maxRi);
      selector.range.sci = Math.min(selector.range.sci, maxCi);
      selector.range.eci = Math.min(Math.max(selector.range.sci, selector.range.eci), maxCi);
      selector.setIndexes(
        Math.min(selector.ri, maxRi),
        Math.min(selector.ci, maxCi),
      );
      if (this.freeze[0] > rows.len) this.freeze[0] = rows.len;
      if (this.freeze[1] > cols.len) this.freeze[1] = cols.len;
      this.shiftRefsAndMeta(type, si, -size, delEnd);
    });
  }

  scrollx(x, cb) {
    const { scroll, freeze, cols } = this;
    const [, fci] = freeze;
    const [
      ci, left, width,
    ] = helper.rangeReduceIf(fci, cols.len, 0, 0, x, i => cols.getWidth(i));
    const maxCi = Math.max(fci, cols.len - 1);
    const nextCi = x > 0 ? Math.min(ci, maxCi) : 0;
    let x1 = left;
    if (x > 0) {
      x1 = ci >= cols.len ? cols.sumWidth(fci, nextCi) : (left + width);
    }
    if (scroll.x !== x1 || scroll.ci !== nextCi) {
      scroll.ci = nextCi;
      scroll.x = x1;
      cb();
    }
  }

  scrolly(y, cb) {
    const {
      scroll, freeze, rows, exceptRowSet,
    } = this;
    const [fri] = freeze;
    const [
      ri, top, height,
    ] = helper.rangeReduceIf(fri, rows.len, 0, 0, y, i => (exceptRowSet.has(i) ? 0 : rows.getHeight(i)));
    const maxRi = Math.max(fri, rows.len - 1);
    const nextRi = y > 0 ? Math.min(ri, maxRi) : 0;
    let y1 = top;
    if (y > 0) {
      y1 = ri >= rows.len ? rows.sumHeight(fri, nextRi, exceptRowSet) : (top + height);
    }
    if (scroll.y !== y1 || scroll.ri !== nextRi) {
      scroll.ri = nextRi;
      scroll.y = y1;
      cb();
    }
  }

  cellRect(ri, ci) {
    const { rows, cols, exceptRowSet } = this;
    const left = cols.sumWidth(0, ci);
    const top = rows.sumHeight(0, ri);
    const cell = rows.getCell(this.mapRowIndex(ri), ci);
    let width = cols.getWidth(ci);
    let height = rows.getHeight(ri);
    if (cell !== null) {
      if (cell.merge) {
        const [rn, cn] = cell.merge;
        if (rn > 0) {
          for (let i = 1; i <= rn; i += 1) {
            if (!exceptRowSet.has(ri + i)) {
              height += rows.getHeight(ri + i);
            }
          }
        }
        if (cn > 0) {
          for (let i = 1; i <= cn; i += 1) {
            width += cols.getWidth(ci + i);
          }
        }
      }
    }
    return {
      left, top, width, height, cell,
    };
  }

  getCell(ri, ci) {
    return this.rows.getCell(ri, ci);
  }

  getCellTextOrDefault(ri, ci) {
    const cell = this.getCell(ri, ci);
    return (cell && cell.text != null) ? cell.text : '';
  }

  getCellStyle(ri, ci) {
    const cell = this.getCell(ri, ci);
    if (cell && cell.style !== undefined) {
      return this.styles[cell.style] || null;
    }
    return null;
  }

  getCellStyleOrDefault(ri, ci) {
    const { styles, rows } = this;
    const cell = rows.getCell(ri, ci);
    const cellStyle = (cell && cell.style !== undefined && styles[cell.style]) ? styles[cell.style] : {};
    return helper.merge(this.defaultStyle(), cellStyle);
  }

  getSelectedCellStyle() {
    const { ri, ci } = this.selector;
    return this.getCellStyleOrDefault(this.mapRowIndex(ri), ci);
  }

  // state: input | finished
  setCellText(ri, ci, text, state, beforeChange = null) {
    const { rows, history, validations } = this;
    const existingCell = rows.getCell(ri, ci);
    if (existingCell && existingCell.editable === false) {
      this._editingOrigin = null;
      return;
    }
    if (state === 'finished') {
      const hasOrigin = this._editingOrigin
        && this._editingOrigin.ri === ri
        && this._editingOrigin.ci === ci;
      const existed = hasOrigin ? this._editingOrigin.existed : Boolean(existingCell);
      const originText = hasOrigin
        ? this._editingOrigin.text
        : (existingCell && existingCell.text !== undefined ? existingCell.text : '');
      this._editingOrigin = null;
      if (hasOrigin && originText === text) {
        if (!existed && text === '') {
          rows.deleteCell(ri, ci, 'all');
        } else {
          rows.setCellText(ri, ci, text);
        }
        validations.validate(ri, ci, text);
        return;
      }
      if (!existed) {
        rows.deleteCell(ri, ci, 'all');
      } else {
        rows.setCellText(ri, ci, originText);
      }
      history.add(this.getData());
      rows.setCellText(ri, ci, text);
      validations.validate(ri, ci, text);
      if (typeof beforeChange === 'function') {
        beforeChange();
      }
      this.change(this.getData());
    } else {
      if (!this._editingOrigin || this._editingOrigin.ri !== ri || this._editingOrigin.ci !== ci) {
        this._editingOrigin = {
          ri,
          ci,
          existed: Boolean(existingCell),
          text: existingCell && existingCell.text !== undefined ? existingCell.text : '',
        };
      }
      rows.setCellText(ri, ci, text);
      validations.validate(ri, ci, text);
      this.change(this.getData());
    }
  }

  freezeIsActive() {
    const [ri, ci] = this.freeze;
    return ri > 0 || ci > 0;
  }

  setFreeze(ri, ci) {
    const fy = Number(ri);
    const fx = Number(ci);
    if (!Number.isInteger(fy) || !Number.isInteger(fx) || fy < 0 || fx < 0) {
      return;
    }
    this.changeData(() => {
      this.freeze = [fy, fx];
      if (this.scroll.ri < fy) {
        this.scroll.ri = 0;
        this.scroll.y = 0;
      }
      if (this.scroll.ci < fx) {
        this.scroll.ci = 0;
        this.scroll.x = 0;
      }
    });
  }

  freezeTotalWidth() {
    return this.cols.sumWidth(0, this.freeze[1]);
  }

  freezeTotalHeight() {
    return this.rows.sumHeight(0, this.freeze[0], this.exceptRowSet);
  }

  setRowHeight(ri, height) {
    this.changeData(() => {
      this.rows.setHeight(ri, height);
    });
  }

  setColWidth(ci, width) {
    this.changeData(() => {
      this.cols.setWidth(ci, width);
    });
  }

  viewHeight() {
    const { view, showToolbar, showBottomBar } = this.settings;
    let h = view.height();
    if (showBottomBar) {
      h -= bottombarHeight;
    }
    if (showToolbar) {
      h -= toolbarHeight;
    }
    return Math.max(0, h);
  }

  viewWidth() {
    return Math.max(0, this.settings.view.width());
  }

  freezeViewRange() {
    const [ri, ci] = this.freeze;
    return new CellRange(0, 0, ri - 1, ci - 1, this.freezeTotalWidth(), this.freezeTotalHeight());
  }

  contentRange() {
    const { rows, cols } = this;
    const [ri, ci] = rows.maxCell();
    const h = rows.sumHeight(0, ri + 1);
    const w = cols.sumWidth(0, ci + 1);
    return new CellRange(0, 0, ri, ci, w, h);
  }

  exceptRowTotalHeight(sri, eri) {
    const { exceptRowSet, rows } = this;
    const exceptRows = Array.from(exceptRowSet);
    let exceptRowTH = 0;
    const sumAll = sri > eri;
    exceptRows.forEach((ri) => {
      if (sumAll || ri < sri) {
        const height = rows.getHeight(ri);
        exceptRowTH += height;
      }
    });
    return exceptRowTH;
  }

  viewRange() {
    const {
      scroll, rows, cols, freeze, exceptRowSet,
    } = this;
    let { ri, ci } = scroll;
    if (ri < freeze[0]) [ri] = freeze;
    if (ci < freeze[1]) [, ci] = freeze;

    let [x, y] = [0, 0];
    let eri = Math.min(ri, Math.max(0, rows.len - 1));
    let eci = Math.min(ci, Math.max(0, cols.len - 1));
    for (let i = ri; i < rows.len; i += 1) {
      if (!exceptRowSet.has(i)) {
        y += rows.getHeight(i);
        eri = i;
      }
      if (y > this.viewHeight()) break;
    }
    for (let j = ci; j < cols.len; j += 1) {
      x += cols.getWidth(j);
      eci = j;
      if (x > this.viewWidth()) break;
    }
    return new CellRange(ri, ci, eri, eci, x, y);
  }

  eachMergesInView(viewRange, cb) {
    this.merges.filterIntersects(viewRange)
      .forEach(it => cb(it));
  }

  hideRowsOrCols() {
    const { rows, cols, selector } = this;
    const [rlen, clen] = selector.size();
    const {
      sri, sci, eri, eci,
    } = selector.range;
    if (rlen !== rows.len && clen !== cols.len) {
      return;
    }
    this.changeData(() => {
      if (rlen === rows.len) {
        for (let ci = sci; ci <= eci; ci += 1) {
          cols.setHide(ci, true);
        }
      } else if (clen === cols.len) {
        for (let ri = sri; ri <= eri; ri += 1) {
          rows.setHide(ri, true);
        }
      }
    });
  }

  // type: row | col
  // index row-index | col-index
  unhideRowsOrCols(type, index) {
    if (type !== 'row' && type !== 'col') {
      return;
    }
    this.changeData(() => {
      this[`${type}s`].unhide(index);
    });
  }

  rowEach(min, max, cb) {
    let y = 0;
    const { rows } = this;
    const frset = this.exceptRowSet;
    const last = Math.min(max, rows.len - 1);
    for (let i = min; i <= last; i += 1) {
      if (frset.has(i)) continue;
      const rowHeight = rows.getHeight(i);
      if (rowHeight > 0) {
        cb(i, y, rowHeight);
        y += rowHeight;
        if (y > this.viewHeight()) break;
      }
    }
  }

  colEach(min, max, cb) {
    let x = 0;
    const { cols } = this;
    const last = Math.min(max, cols.len - 1);
    for (let i = min; i <= last; i += 1) {
      const colWidth = cols.getWidth(i);
      if (colWidth > 0) {
        cb(i, x, colWidth);
        x += colWidth;
        if (x > this.viewWidth()) break;
      }
    }
  }

  defaultStyle() {
    return this.settings.style;
  }

  addStyle(nstyle) {
    const { styles } = this;
    // console.log('old.styles:', styles, nstyle);
    for (let i = 0; i < styles.length; i += 1) {
      const style = styles[i];
      if (helper.equals(style, nstyle)) return i;
    }
    styles.push(nstyle);
    return styles.length - 1;
  }

  changeData(cb) {
    this._editingOrigin = null;
    this.history.add(this.getData());
    cb();
    this.change(this.getData());
  }

  setData(d) {
    if (!d || typeof d !== 'object') {
      return this;
    }
    this._editingOrigin = null;
    this.freeze = [0, 0];
    if (!Object.prototype.hasOwnProperty.call(d, 'styles')) this.styles = [];
    if (!Object.prototype.hasOwnProperty.call(d, 'merges')) this.merges.setData([]);
    if (!Object.prototype.hasOwnProperty.call(d, 'rows')) {
      this.rows.setData({ len: this.settings.row.len });
    } else if (d.rows && typeof d.rows === 'object' && d.rows.len === undefined) {
      this.rows.len = this.settings.row.len;
    }
    if (!Object.prototype.hasOwnProperty.call(d, 'cols')) {
      this.cols.setData({ len: this.settings.col.len });
    } else if (d.cols && typeof d.cols === 'object' && d.cols.len === undefined) {
      this.cols.len = this.settings.col.len;
    }
    if (!Object.prototype.hasOwnProperty.call(d, 'validations')) this.validations.setData([]);
    if (!Object.prototype.hasOwnProperty.call(d, 'hyperlinks')) this.hyperlinks = {};
    if (!Object.prototype.hasOwnProperty.call(d, 'comments')) this.comments = {};
    if (!Object.prototype.hasOwnProperty.call(d, 'media')) this.media = [];
    Object.keys(d).forEach((property) => {
      if (property === 'merges' || property === 'rows'
        || property === 'cols' || property === 'validations') {
        this[property].setData(d[property]);
      } else if (property === 'styles') {
        this.styles = Array.isArray(d.styles) ? helper.cloneDeep(d.styles) : [];
      } else if (property === 'freeze') {
        if (typeof d[property] === 'string' && d[property]) {
          const [x, y] = expr2xy(d[property]);
          if (Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0) {
            this.freeze = [y, x];
          }
        } else if (Array.isArray(d[property]) && d[property].length >= 2) {
          const fy = Number(d[property][0]);
          const fx = Number(d[property][1]);
          if (Number.isInteger(fy) && Number.isInteger(fx) && Number.isFinite(fy) && Number.isFinite(fx) && fy >= 0 && fx >= 0) {
            this.freeze = [fy, fx];
          }
        }
      } else if (property === 'autofilter') {
        this.autoFilter.setData(d[property]);
      } else if (property === 'name') {
        if (typeof d.name === 'string' && d.name.trim()) {
          this.name = d.name;
        }
      } else if (property === 'media') {
        this.media = Array.isArray(d.media) ? helper.cloneDeep(d.media) : [];
      } else if ((property === 'hyperlinks' || property === 'comments') && d[property] !== undefined) {
        this[property] = d[property] && typeof d[property] === 'object' ? helper.cloneDeep(d[property]) : {};
      }
    });
    if (!Object.prototype.hasOwnProperty.call(d, 'autofilter')) {
      this.autoFilter.clear();
    }
    this.resetAutoFilter();
    const maxRi = Math.max(0, this.rows.len - 1);
    const maxCi = Math.max(0, this.cols.len - 1);
    if (this.freeze[0] > this.rows.len) this.freeze[0] = this.rows.len;
    if (this.freeze[1] > this.cols.len) this.freeze[1] = this.cols.len;
    this.selector.range.sri = Math.min(this.selector.range.sri, maxRi);
    this.selector.range.eri = Math.min(Math.max(this.selector.range.sri, this.selector.range.eri), maxRi);
    this.selector.range.sci = Math.min(this.selector.range.sci, maxCi);
    this.selector.range.eci = Math.min(Math.max(this.selector.range.sci, this.selector.range.eci), maxCi);
    this.selector.setIndexes(
      Math.min(this.selector.ri, maxRi),
      Math.min(this.selector.ci, maxCi),
    );
    if (this.scroll.ri > maxRi) {
      this.scroll.ri = 0;
      this.scroll.y = 0;
    }
    if (this.scroll.ci > maxCi) {
      this.scroll.ci = 0;
      this.scroll.x = 0;
    }
    // Re-validate populated cells under active validations
    this.validations.each((v) => {
      v.refs.forEach((ref) => {
        if (!CellRange.isValidRef(ref)) return;
        const cr = CellRange.valueOf(ref);
        cr.each((ri, ci) => {
          const c = this.rows.getCell(ri, ci);
          if (c && c.text != null && c.text !== '') {
            this.validations.validate(ri, ci, c.text);
          }
        });
      });
    });
    return this;
  }

  autoFitCols(startCi = 0, endCi = null, opts = {}) {
    const widths = computeAutoFitCols(this, startCi, endCi, opts);
    const keys = Object.keys(widths);
    if (keys.length === 0) return {};
    const changed = [];
    for (let i = 0; i < keys.length; i += 1) {
      const ci = Number(keys[i]);
      const nextW = widths[ci];
      if (this.cols.getWidth(ci) !== nextW) {
        changed.push([ci, nextW]);
      }
    }
    if (changed.length > 0) {
      const apply = () => {
        changed.forEach(([ci, w]) => {
          this.cols.setWidth(ci, w);
        });
      };
      if (this.settings && this.settings.mode !== 'read') {
        this.changeData(apply);
      } else {
        apply();
      }
    }
    return widths;
  }

  autoFitCol(ci, opts = {}) {
    if (typeof ci !== 'number' || !Number.isInteger(ci) || ci < 0 || ci >= this.cols.len) {
      return null;
    }
    const widths = this.autoFitCols(ci, ci, opts);
    return widths[ci] !== undefined ? widths[ci] : null;
  }

  autoFitRows(startRi = 0, endRi = null, opts = {}) {
    const heights = computeAutoFitRows(this, startRi, endRi, opts);
    const keys = Object.keys(heights);
    if (keys.length === 0) return {};
    const changed = [];
    for (let i = 0; i < keys.length; i += 1) {
      const ri = Number(keys[i]);
      const nextH = heights[ri];
      if (this.rows.getHeight(ri) !== nextH) {
        changed.push([ri, nextH]);
      }
    }
    if (changed.length > 0) {
      const apply = () => {
        changed.forEach(([ri, h]) => {
          this.rows.setHeight(ri, h);
        });
      };
      if (this.settings && this.settings.mode !== 'read') {
        this.changeData(apply);
      } else {
        apply();
      }
    }
    return heights;
  }

  autoFitRow(ri, opts = {}) {
    if (typeof ri !== 'number' || !Number.isInteger(ri) || ri < 0 || ri >= this.rows.len) {
      return null;
    }
    const heights = this.autoFitRows(ri, ri, opts);
    return heights[ri] !== undefined ? heights[ri] : null;
  }

  autoFitAll(opts = {}) {
    const cols = this.autoFitCols(0, null, opts);
    const rows = this.autoFitRows(0, null, opts);
    return { cols, rows };
  }

  getData() {
    const {
      name, freeze, styles, merges, rows, cols, validations, autoFilter, hyperlinks, comments,
    } = this;
    return {
      name,
      freeze: xy2expr(freeze[1], freeze[0]),
      styles: helper.cloneDeep(styles),
      merges: merges.getData(),
      rows: helper.cloneDeep(rows.getData()),
      cols: helper.cloneDeep(cols.getData()),
      validations: validations.getData(),
      autofilter: autoFilter.getData(),
      hyperlinks: helper.cloneDeep(hyperlinks),
      comments: helper.cloneDeep(comments),
    };
  }
}
