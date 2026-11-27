import helper from './helper';
import { expr2expr, expr2xy, stringAt } from './alphabet';

function shiftFormulaRefs(formula, xn, yn, condition, ignoreAbs = false, delBounds = null) {
  let out = '';
  let i = 0;
  while (i < formula.length) {
    const ch = formula[i];
    if (ch === '"') {
      let end = i + 1;
      while (end < formula.length) {
        if (formula[end] === '"') {
          if (formula[end + 1] === '"') {
            end += 2;
            continue;
          }
          end += 1;
          break;
        }
        end += 1;
      }
      out += formula.slice(i, end);
      i = end;
      continue;
    }
    const tail = formula.slice(i);
    const prevChar = i > 0 ? formula[i - 1] : '';
    const isBoundaryBefore = !prevChar || !/[A-Za-z0-9_!]/.test(prevChar);
    const m = isBoundaryBefore && tail.match(/^(\$?[A-Za-z]{1,3}\$?\d+)(?![A-Za-z0-9_(])/);
    if (m) {
      const word = m[1];
      const afterPos = i + word.length;
      const nextChar = formula[afterPos] || '';
      if (nextChar === '!') {
        out += word;
        i = afterPos;
        continue;
      }
      if (delBounds) {
        const refMatch = word.match(/^(\$?)([A-Za-z]+)(\$?)(\d+)$/);
        if (refMatch) {
          const [, absCol, , absRow] = refMatch;
          const [x, y] = expr2xy(word);
          if (!Number.isNaN(x) && !Number.isNaN(y)) {
            if (delBounds.axis === 'row' && y >= delBounds.start && y <= delBounds.end) {
              if (prevChar === ':') {
                const clampedY = Math.max(0, delBounds.start - 1);
                out += `${absCol}${stringAt(x)}${absRow}${clampedY + 1}`;
                i = afterPos;
                continue;
              }
              if (nextChar === ':') {
                out += `${absCol}${stringAt(x)}${absRow}${delBounds.start + 1}`;
                i = afterPos;
                continue;
              }
            } else if (delBounds.axis === 'col' && x >= delBounds.start && x <= delBounds.end) {
              if (prevChar === ':') {
                const clampedX = Math.max(0, delBounds.start - 1);
                out += `${absCol}${stringAt(clampedX)}${absRow}${y + 1}`;
                i = afterPos;
                continue;
              }
              if (nextChar === ':') {
                out += `${absCol}${stringAt(delBounds.start)}${absRow}${y + 1}`;
                i = afterPos;
                continue;
              }
            }
          }
        }
      }
      out += expr2expr(word, xn, yn, condition, ignoreAbs);
      i = afterPos;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

class Rows {
  constructor({ len, height }) {
    this._ = {};
    this.len = len;
    // default row height
    this.height = height;
  }

  getHeight(ri) {
    if (this.isHide(ri)) return 0;
    const row = this.get(ri);
    if (row && row.height !== undefined) {
      return row.height;
    }
    return this.height;
  }

  setHeight(ri, v) {
    const row = this.getOrNew(ri);
    row.height = v;
  }

  unhide(idx) {
    if (idx >= 0 && this.isHide(idx)) {
      this.setHide(idx, false);
    }
    let index = idx;
    while (index > 0) {
      index -= 1;
      if (this.isHide(index)) {
        this.setHide(index, false);
      } else break;
    }
  }

  isHide(ri) {
    const row = this.get(ri);
    return !!(row && row.hide);
  }

  setHide(ri, v) {
    const row = this.getOrNew(ri);
    if (v === true) row.hide = true;
    else delete row.hide;
  }

  setStyle(ri, style) {
    const row = this.getOrNew(ri);
    row.style = style;
  }

  sumHeight(min, max, exceptSet) {
    return helper.rangeSum(min, max, (i) => {
      if (exceptSet && exceptSet.has(i)) return 0;
      return this.getHeight(i);
    });
  }

  totalHeight() {
    return this.sumHeight(0, this.len);
  }

  get(ri) {
    return this._[ri];
  }

  getOrNew(ri) {
    if (!this._[ri]) {
      this._[ri] = { cells: {} };
    } else if (!this._[ri].cells) {
      this._[ri].cells = {};
    }
    return this._[ri];
  }

  getCell(ri, ci) {
    const row = this.get(ri);
    if (row !== undefined && row.cells !== undefined && row.cells[ci] !== undefined) {
      return row.cells[ci];
    }
    return null;
  }

  getCellMerge(ri, ci) {
    const cell = this.getCell(ri, ci);
    if (cell && cell.merge) return cell.merge;
    return [0, 0];
  }

  getCellOrNew(ri, ci) {
    const row = this.getOrNew(ri);
    row.cells[ci] = row.cells[ci] || {};
    return row.cells[ci];
  }

  // what: all | text | format
  setCell(ri, ci, cell, what = 'all') {
    const row = this.getOrNew(ri);
    const existing = row.cells[ci];
    if (existing && existing.editable === false) {
      return;
    }
    if (what === 'all') {
      row.cells[ci] = helper.cloneDeep(cell);
    } else if (what === 'text') {
      row.cells[ci] = existing || {};
      row.cells[ci].text = cell.text;
    } else if (what === 'format') {
      row.cells[ci] = existing || {};
      row.cells[ci].style = cell.style;
      if (cell.merge) row.cells[ci].merge = cell.merge.slice();
    }
  }

  setCellText(ri, ci, text) {
    const cell = this.getCellOrNew(ri, ci);
    if (cell.editable !== false) cell.text = text;
  }

  // what: all | format | text
  copyPaste(srcCellRange, dstCellRange, what, autofill = false, cb = () => {}, beforeWrite = null) {
    const {
      sri, sci, eri, eci,
    } = srcCellRange;
    const dsri = dstCellRange.sri;
    const dsci = dstCellRange.sci;
    const deri = dstCellRange.eri;
    const deci = dstCellRange.eci;
    const [rn, cn] = srcCellRange.size();
    const snapshot = [];
    for (let i = sri; i <= eri; i += 1) {
      if (this._[i] && this._[i].cells) {
        for (let j = sci; j <= eci; j += 1) {
          if (this._[i].cells[j] !== undefined) {
            snapshot.push([i, j, helper.cloneDeep(this._[i].cells[j])]);
          }
        }
      }
    }
    if (typeof beforeWrite === 'function') {
      beforeWrite();
    }
    snapshot.forEach(([i, j, srcCell]) => {
      for (let ii = dsri; ii <= deri; ii += rn) {
        for (let jj = dsci; jj <= deci; jj += cn) {
          const nri = ii + (i - sri);
          const nci = jj + (j - sci);
          if (nri > deri || nci > deci) continue;
          const ncell = helper.cloneDeep(srcCell);
          if (autofill && ncell && ncell.text != null) {
            const textStr = String(ncell.text);
            if (textStr.length > 0) {
              if (textStr[0] === '=') {
                const dx = nci - j;
                const dy = nri - i;
                ncell.text = shiftFormulaRefs(textStr, dx, dy, () => true, false);
              } else if ((rn <= 1 && cn > 1 && (dsri > eri || deri < sri))
                || (cn <= 1 && rn > 1 && (dsci > eci || deci < sci))
                || (rn <= 1 && cn <= 1)) {
                const step = (nci - j) !== 0 ? (nci - j) : (nri - i);
                const result = /^-?\d+$/.exec(textStr) || /\d+$/.exec(textStr);
                if (result !== null) {
                  const index = Number(result[0]) + step;
                  ncell.text = `${textStr.substring(0, result.index)}${index}`;
                }
              }
            }
          }
          this.setCell(nri, nci, ncell, what);
          cb(nri, nci, ncell);
        }
      }
    });
  }

  cutPaste(srcCellRange, dstCellRange) {
    const [srn, scn] = srcCellRange.size();
    const snapshot = [];
    srcCellRange.each((ri, ci) => {
      const cell = this.getCell(ri, ci);
      if (cell !== null && cell.editable !== false) {
        snapshot.push([ri - srcCellRange.sri, ci - srcCellRange.sci, helper.cloneDeep(cell)]);
      }
    });
    this.deleteCells(srcCellRange, 'all');
    for (let dr = 0; dr < srn; dr += 1) {
      for (let dc = 0; dc < scn; dc += 1) {
        this.deleteCell(dstCellRange.sri + dr, dstCellRange.sci + dc, 'all');
      }
    }
    snapshot.forEach(([dr, dc, cell]) => {
      this.setCell(dstCellRange.sri + dr, dstCellRange.sci + dc, cell, 'all');
    });
  }

  // src: Array<Array<String>>
  paste(src, dstCellRange) {
    if (src.length <= 0) return;
    const { sri, sci } = dstCellRange;
    src.forEach((row, i) => {
      const ri = sri + i;
      row.forEach((cell, j) => {
        const ci = sci + j;
        this.setCellText(ri, ci, cell);
      });
    });
  }

  insert(sri, n = 1) {
    const ndata = {};
    this.each((ri, row) => {
      let nri = parseInt(ri, 10);
      this.eachCells(ri, (ci, cell) => {
        if (cell && cell.text && cell.text[0] === '=') {
          cell.text = shiftFormulaRefs(cell.text, 0, n, (_x, y) => y >= sri, true);
        }
      });
      if (nri >= sri) {
        nri += n;
      }
      ndata[nri] = row;
    });
    this._ = ndata;
    this.len += n;
  }

  delete(sri, eri) {
    const n = eri - sri + 1;
    const ndata = {};
    this.each((ri, row) => {
      const nri = parseInt(ri, 10);
      if (nri < sri || nri > eri) {
        this.eachCells(ri, (ci, cell) => {
          if (cell && cell.text && cell.text[0] === '=') {
            cell.text = shiftFormulaRefs(
              cell.text,
              0,
              -n,
              (_x, y) => y > eri,
              true,
              { axis: 'row', start: sri, end: eri },
            );
          }
        });
      }
      if (nri < sri) {
        ndata[nri] = row;
      } else if (nri > eri) {
        ndata[nri - n] = row;
      }
    });
    this._ = ndata;
    this.len = Math.max(0, this.len - n);
  }

  insertColumn(sci, n = 1) {
    this.each((ri, row) => {
      const rndata = {};
      this.eachCells(ri, (ci, cell) => {
        let nci = parseInt(ci, 10);
        if (cell && cell.text && cell.text[0] === '=') {
          cell.text = shiftFormulaRefs(cell.text, n, 0, x => x >= sci, true);
        }
        if (nci >= sci) {
          nci += n;
        }
        rndata[nci] = cell;
      });
      row.cells = rndata;
    });
  }

  deleteColumn(sci, eci) {
    const n = eci - sci + 1;
    this.each((ri, row) => {
      const rndata = {};
      this.eachCells(ri, (ci, cell) => {
        const nci = parseInt(ci, 10);
        if (nci < sci || nci > eci) {
          if (cell && cell.text && cell.text[0] === '=') {
            cell.text = shiftFormulaRefs(
              cell.text,
              -n,
              0,
              x => x > eci,
              true,
              { axis: 'col', start: sci, end: eci },
            );
          }
        }
        if (nci < sci) {
          rndata[nci] = cell;
        } else if (nci > eci) {
          rndata[nci - n] = cell;
        }
      });
      row.cells = rndata;
    });
  }

  // what: all | text | format | merge
  deleteCells(cellRange, what = 'all') {
    cellRange.each((i, j) => {
      this.deleteCell(i, j, what);
    });
  }

  // what: all | text | format | merge
  deleteCell(ri, ci, what = 'all') {
    const row = this.get(ri);
    if (row && row.cells) {
      const cell = this.getCell(ri, ci);
      if (cell !== null && cell.editable !== false) {
        if (what === 'all') {
          delete row.cells[ci];
        } else if (what === 'text') {
          if (cell.text !== undefined) delete cell.text;
          if (cell.value !== undefined) delete cell.value;
        } else if (what === 'format') {
          if (cell.style !== undefined) delete cell.style;
          if (cell.merge) delete cell.merge;
        } else if (what === 'merge') {
          if (cell.merge) delete cell.merge;
        }
      }
    }
  }

  maxCell() {
    let maxRi = 0;
    let maxCi = 0;
    Object.keys(this._).forEach((riKey) => {
      const ri = parseInt(riKey, 10);
      if (Number.isNaN(ri)) return;
      if (ri > maxRi) maxRi = ri;
      const row = this._[riKey];
      if (row && row.cells) {
        Object.keys(row.cells).forEach((ciKey) => {
          const ci = parseInt(ciKey, 10);
          if (!Number.isNaN(ci)) {
            const cell = row.cells[ciKey];
            const spanRi = ri + (cell && Array.isArray(cell.merge) ? (cell.merge[0] || 0) : 0);
            const spanCi = ci + (cell && Array.isArray(cell.merge) ? (cell.merge[1] || 0) : 0);
            if (spanRi > maxRi) maxRi = spanRi;
            if (spanCi > maxCi) maxCi = spanCi;
          }
        });
      }
    });
    return [maxRi, maxCi];
  }

  each(cb) {
    Object.entries(this._).forEach(([ri, row]) => {
      cb(ri, row);
    });
  }

  eachCells(ri, cb) {
    if (this._[ri] && this._[ri].cells) {
      Object.entries(this._[ri].cells).forEach(([ci, cell]) => {
        cb(ci, cell);
      });
    }
  }

  setData(d) {
    if (!d || typeof d !== 'object') {
      return;
    }
    const copy = {};
    Object.keys(d).forEach((k) => {
      if (k === 'len') {
        const parsedLen = Number(d.len);
        if (Number.isInteger(parsedLen) && parsedLen >= 0) {
          this.len = parsedLen;
        }
      } else if (k !== '__proto__' && k !== 'constructor' && k !== 'prototype') {
        const rowObj = d[k];
        if (rowObj && typeof rowObj === 'object') {
          copy[k] = {
            ...rowObj,
            ...(rowObj.cells && typeof rowObj.cells === 'object' ? { cells: { ...rowObj.cells } } : {}),
          };
        } else {
          copy[k] = rowObj;
        }
      }
    });
    this._ = copy;
  }

  getData() {
    const { len } = this;
    return Object.assign({ len }, this._);
  }
}

export default {};
export {
  Rows,
};
