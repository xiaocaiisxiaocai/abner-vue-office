import { stringAt } from './alphabet';
import { getFontSizePxByPt } from './font';
import _cell from './cell';
import { formulam } from './formula';
import { formatm } from './format';

const CELL_PADDING_X = 5;
const COL_EXTRA_PADDING = 16; // left 5 + right 5 + breathing buffer
const ROW_EXTRA_PADDING = 10; // top/bottom breathing buffer
const AUTOFILTER_ICON_WIDTH = 18;

const DEFAULT_MIN_COL_WIDTH = 40;
const DEFAULT_MAX_COL_WIDTH = 500;
const DEFAULT_MIN_ROW_HEIGHT = 24;
const DEFAULT_MAX_ROW_HEIGHT = 600;

const measureCtxByDoc = new WeakMap();

function getMeasureContext() {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return null;
  }
  let ctx = measureCtxByDoc.get(document);
  if (ctx !== undefined) {
    return ctx;
  }
  try {
    const canvas = document.createElement('canvas');
    ctx = canvas && typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null;
  } catch (e) {
    ctx = null;
  }
  measureCtxByDoc.set(document, ctx);
  return ctx;
}

function estimateCharWidth(ch, fontSizePx, bold) {
  const code = ch.codePointAt(0) || 0;
  let factor = 0.6;
  if (
    (code >= 0x2E80 && code <= 0x9FFF)
    || (code >= 0xAC00 && code <= 0xD7AF)
    || (code >= 0xF900 && code <= 0xFAFF)
    || (code >= 0xFE30 && code <= 0xFE6F)
    || (code >= 0xFF00 && code <= 0xFFEF)
    || code >= 0x1F000
  ) {
    factor = 1.05;
  } else if (/[MW@%&#]/.test(ch)) {
    factor = 0.82;
  } else if (/[A-Z]/.test(ch)) {
    factor = 0.7;
  } else if (/[il1.,;:'|!()[\] ]/.test(ch)) {
    factor = 0.36;
  }
  return fontSizePx * factor * (bold ? 1.08 : 1);
}

function estimateTextWidth(text, fontSizePx, bold) {
  if (!text) return 0;
  let total = 0;
  const chars = Array.from(text);
  for (let i = 0; i < chars.length; i += 1) {
    total += estimateCharWidth(chars[i], fontSizePx, bold);
  }
  return total;
}

function measureTextWidth(ctx, text, fontStr, fontSizePx, bold) {
  if (!text) return 0;
  if (ctx && typeof ctx.measureText === 'function') {
    try {
      ctx.font = fontStr;
      const measured = ctx.measureText(text);
      if (measured && typeof measured.width === 'number' && Number.isFinite(measured.width) && measured.width >= 0) {
        return measured.width;
      }
    } catch (e) {
      // fall back to heuristic
    }
  }
  return estimateTextWidth(text, fontSizePx, bold);
}

function resolveFontInfo(style, defaultStyle) {
  const baseFont = (defaultStyle && defaultStyle.font) || { name: 'Arial', size: 10, bold: false, italic: false };
  const rawFont = Object.assign({}, baseFont, (style && style.font) || {});
  const ptOrPx = getFontSizePxByPt(rawFont.size);
  const parsedPx = Number(ptOrPx);
  const fontSizePx = Number.isFinite(parsedPx) && parsedPx > 0 ? parsedPx : 13;
  const bold = Boolean(rawFont.bold);
  const italic = Boolean(rawFont.italic);
  const name = rawFont.name || 'Arial';
  const fontStr = `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}${Math.max(1, fontSizePx)}px ${name}`;
  return { fontSizePx, bold, italic, name, fontStr };
}

function resolveDisplayText(data, nrindex, cindex, cell, style) {
  if (!cell || cell.text == null || cell.text === '') {
    return '';
  }
  let cellText = '';
  if (data.settings && !data.settings.evalPaused) {
    cellText = _cell.render(
      cell.text,
      formulam,
      (y, x) => data.getCellTextOrDefault(x, y),
      [],
      `${stringAt(cindex)}${nrindex + 1}`,
    );
  } else {
    cellText = cell.text;
  }
  if (style && style.format && formatm[style.format]) {
    cellText = formatm[style.format].render(cellText);
  }
  return cellText == null ? '' : String(cellText);
}

function buildMediaTrackSets(data) {
  const mediaCols = new Set();
  const mediaRows = new Set();
  const mediaList = Array.isArray(data && data.media) ? data.media : [];
  mediaList.forEach((m) => {
    const range = m && m.range;
    if (!range || !range.tl) return;
    const tlCol = Number(range.tl.nativeCol);
    const tlRow = Number(range.tl.nativeRow);
    const brCol = range.br && typeof range.br.nativeCol === 'number' ? range.br.nativeCol : tlCol;
    const brRow = range.br && typeof range.br.nativeRow === 'number' ? range.br.nativeRow : tlRow;
    if (Number.isInteger(tlCol) && tlCol >= 0) {
      const endC = Number.isInteger(brCol) && brCol >= tlCol ? brCol : tlCol;
      for (let c = tlCol; c <= endC; c += 1) mediaCols.add(c);
    }
    if (Number.isInteger(tlRow) && tlRow >= 0) {
      const endR = Number.isInteger(brRow) && brRow >= tlRow ? brRow : tlRow;
      for (let r = tlRow; r <= endR; r += 1) mediaRows.add(r);
    }
  });
  return { mediaCols, mediaRows };
}

function countWrappedLines(ctx, text, innerWidth, textWrap, fontInfo) {
  if (!text) return 1;
  const paragraphs = text.split(/\r\n|\r|\n/);
  const maxW = Math.max(1, innerWidth);
  let totalLines = 0;
  for (let p = 0; p < paragraphs.length; p += 1) {
    const para = paragraphs[p];
    if (!textWrap || !para) {
      totalLines += 1;
      continue;
    }
    const fullW = measureTextWidth(ctx, para, fontInfo.fontStr, fontInfo.fontSizePx, fontInfo.bold);
    if (fullW <= maxW) {
      totalLines += 1;
      continue;
    }
    const chars = Array.from(para);
    let currentLine = '';
    for (let i = 0; i < chars.length; i += 1) {
      const nextLine = currentLine + chars[i];
      if (currentLine.length > 0 && measureTextWidth(ctx, nextLine, fontInfo.fontStr, fontInfo.fontSizePx, fontInfo.bold) > maxW) {
        totalLines += 1;
        currentLine = chars[i];
      } else {
        currentLine = nextLine;
      }
    }
    if (currentLine.length > 0) {
      totalLines += 1;
    }
  }
  return Math.max(1, totalLines);
}

function resolveAutoFitBounds(data, opts = {}) {
  const settings = (data && data.settings) || {};
  const minColWidth = typeof opts.minColWidth === 'number' && Number.isFinite(opts.minColWidth) && opts.minColWidth > 0
    ? opts.minColWidth
    : (typeof settings.autoFitMinColWidth === 'number' && settings.autoFitMinColWidth > 0
      ? settings.autoFitMinColWidth
      : DEFAULT_MIN_COL_WIDTH);
  const maxColWidth = typeof opts.maxColWidth === 'number' && Number.isFinite(opts.maxColWidth) && opts.maxColWidth >= minColWidth
    ? opts.maxColWidth
    : (typeof settings.autoFitMaxColWidth === 'number' && settings.autoFitMaxColWidth >= minColWidth
      ? settings.autoFitMaxColWidth
      : DEFAULT_MAX_COL_WIDTH);
  const baseRowH = (data && data.rows && data.rows.height) || DEFAULT_MIN_ROW_HEIGHT;
  const minRowHeight = typeof opts.minRowHeight === 'number' && Number.isFinite(opts.minRowHeight) && opts.minRowHeight > 0
    ? opts.minRowHeight
    : (typeof settings.autoFitMinRowHeight === 'number' && settings.autoFitMinRowHeight > 0
      ? settings.autoFitMinRowHeight
      : Math.max(DEFAULT_MIN_ROW_HEIGHT, baseRowH));
  const maxRowHeight = typeof opts.maxRowHeight === 'number' && Number.isFinite(opts.maxRowHeight) && opts.maxRowHeight >= minRowHeight
    ? opts.maxRowHeight
    : (typeof settings.autoFitMaxRowHeight === 'number' && settings.autoFitMaxRowHeight >= minRowHeight
      ? settings.autoFitMaxRowHeight
      : DEFAULT_MAX_ROW_HEIGHT);
  return {
    minColWidth,
    maxColWidth,
    minRowHeight,
    maxRowHeight,
  };
}

function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}

export function computeAutoFitCols(data, startCi = 0, endCi = null, opts = {}) {
  if (!data || !data.rows || !data.cols) return {};
  const {
    rows, cols, exceptRowSet, autoFilter, sortedRowMap,
  } = data;
  const lastCol = Math.max(0, cols.len - 1);
  const sCi = Math.max(0, Math.min(startCi, lastCol));
  const eCi = endCi == null ? lastCol : Math.max(sCi, Math.min(endCi, lastCol));
  const bounds = resolveAutoFitBounds(data, opts);
  const ctx = opts.ctx !== undefined ? opts.ctx : getMeasureContext();
  const defaultStyle = data.defaultStyle();
  const { mediaCols } = buildMediaTrackSets(data);
  const afRange = autoFilter && autoFilter.active() ? autoFilter.hrange() : null;

  const colDesired = new Map();
  const colMergeBaseline = new Map();
  const horizontalMerges = [];

  const rowKeys = Object.keys(rows._ || {});
  for (let idx = 0; idx < rowKeys.length; idx += 1) {
    const ri = Number(rowKeys[idx]);
    if (!Number.isInteger(ri) || ri < 0 || ri >= rows.len) continue;
    if (rows.isHide(ri) || (exceptRowSet && exceptRowSet.has(ri))) continue;
    const nri = sortedRowMap && sortedRowMap.has(ri) ? sortedRowMap.get(ri) : ri;
    const rowObj = rows._[nri];
    if (!rowObj || !rowObj.cells) continue;

    const cellKeys = Object.keys(rowObj.cells);
    for (let k = 0; k < cellKeys.length; k += 1) {
      const ci = Number(cellKeys[k]);
      if (!Number.isInteger(ci) || ci < 0 || ci >= cols.len) continue;
      if (cols.isHide(ci)) continue;
      const cell = rowObj.cells[ci];
      if (!cell) continue;
      const xSpan = Array.isArray(cell.merge) && cell.merge[1] > 0 ? cell.merge[1] : 0;
      const cellEndCi = Math.min(lastCol, ci + xSpan);
      if (cellEndCi < sCi || ci > eCi) continue;

      const style = data.getCellStyleOrDefault(nri, ci);
      const text = resolveDisplayText(data, nri, ci, cell, style);
      if (!text) continue;

      const fontInfo = resolveFontInfo(style, defaultStyle);
      const lines = text.split(/\r\n|\r|\n/);
      let maxLineW = 0;
      for (let l = 0; l < lines.length; l += 1) {
        const w = measureTextWidth(ctx, lines[l], fontInfo.fontStr, fontInfo.fontSizePx, fontInfo.bold);
        if (w > maxLineW) maxLineW = w;
      }
      const filterExtra = afRange && afRange.includes(ri, ci) ? AUTOFILTER_ICON_WIDTH : 0;
      const needed = Math.ceil(maxLineW + COL_EXTRA_PADDING + filterExtra);

      if (xSpan > 0) {
        horizontalMerges.push({
          sci: ci,
          eci: cellEndCi,
          needed,
        });
        let visibleSpanCount = 0;
        for (let c = ci; c <= cellEndCi; c += 1) {
          if (!cols.isHide(c)) visibleSpanCount += 1;
        }
        if (visibleSpanCount > 0) {
          const perColNeed = Math.ceil(needed / visibleSpanCount);
          for (let c = ci; c <= cellEndCi; c += 1) {
            if (cols.isHide(c) || c < sCi || c > eCi) continue;
            const prevBase = colMergeBaseline.get(c) || 0;
            if (perColNeed > prevBase) colMergeBaseline.set(c, perColNeed);
          }
        }
      } else {
        const prev = colDesired.get(ci) || 0;
        if (needed > prev) colDesired.set(ci, needed);
      }
    }
  }

  const nextWidths = new Map();
  for (let ci = sCi; ci <= eCi; ci += 1) {
    if (cols.isHide(ci)) continue;
    if (colDesired.has(ci) || colMergeBaseline.has(ci)) {
      const rawDesired = colDesired.has(ci) ? colDesired.get(ci) : colMergeBaseline.get(ci);
      let target = clamp(rawDesired, bounds.minColWidth, bounds.maxColWidth);
      if (mediaCols.has(ci)) {
        target = Math.max(target, cols.getWidth(ci));
      }
      nextWidths.set(ci, target);
    }
  }

  // Pass 2: distribute deficit of horizontally merged cells without blowing up single columns
  for (let i = 0; i < horizontalMerges.length; i += 1) {
    const { sci, eci, needed } = horizontalMerges[i];
    const cappedNeed = Math.min(needed, bounds.maxColWidth * Math.max(1, eci - sci + 1));
    let totalW = 0;
    const adjustableCols = [];
    for (let c = sci; c <= eci; c += 1) {
      if (cols.isHide(c)) continue;
      const w = nextWidths.has(c) ? nextWidths.get(c) : cols.getWidth(c);
      totalW += w;
      if (c >= sCi && c <= eCi) {
        adjustableCols.push(c);
      }
    }
    if (totalW < cappedNeed && adjustableCols.length > 0) {
      let remaining = cappedNeed - totalW;
      let candidates = adjustableCols.slice();
      while (remaining > 0.5 && candidates.length > 0) {
        const share = Math.ceil(remaining / candidates.length);
        const nextCandidates = [];
        let distributed = 0;
        for (let j = 0; j < candidates.length; j += 1) {
          const c = candidates[j];
          const cur = nextWidths.has(c) ? nextWidths.get(c) : cols.getWidth(c);
          const room = Math.max(0, bounds.maxColWidth - cur);
          if (room <= 0) continue;
          const add = Math.min(room, share, remaining - distributed);
          if (add > 0) {
            let updated = cur + add;
            if (mediaCols.has(c)) {
              updated = Math.max(updated, cols.getWidth(c));
            }
            nextWidths.set(c, updated);
            distributed += add;
            if (room - add > 0) {
              nextCandidates.push(c);
            }
          }
        }
        if (distributed <= 0) break;
        remaining -= distributed;
        candidates = nextCandidates;
      }
    }
  }

  const result = {};
  nextWidths.forEach((w, ci) => {
    result[ci] = Math.round(w);
  });
  return result;
}

export function computeAutoFitRows(data, startRi = 0, endRi = null, opts = {}) {
  if (!data || !data.rows || !data.cols) return {};
  const {
    rows, cols, exceptRowSet, sortedRowMap,
  } = data;
  const lastRow = Math.max(0, rows.len - 1);
  const sRi = Math.max(0, Math.min(startRi, lastRow));
  const eRi = endRi == null ? lastRow : Math.max(sRi, Math.min(endRi, lastRow));
  const bounds = resolveAutoFitBounds(data, opts);
  const ctx = opts.ctx !== undefined ? opts.ctx : getMeasureContext();
  const defaultStyle = data.defaultStyle();
  const { mediaRows } = buildMediaTrackSets(data);

  const rowDesired = new Map();
  const rowMergeBaseline = new Map();
  const verticalMerges = [];

  for (let ri = 0; ri < rows.len; ri += 1) {
    if (rows.isHide(ri) || (exceptRowSet && exceptRowSet.has(ri))) continue;
    const nri = sortedRowMap && sortedRowMap.has(ri) ? sortedRowMap.get(ri) : ri;
    const rowObj = rows._ && rows._[nri];
    if (!rowObj || !rowObj.cells) continue;

    const cellKeys = Object.keys(rowObj.cells);
    for (let k = 0; k < cellKeys.length; k += 1) {
      const ci = Number(cellKeys[k]);
      if (!Number.isInteger(ci) || ci < 0 || ci >= cols.len) continue;
      if (cols.isHide(ci)) continue;
      const cell = rowObj.cells[ci];
      if (!cell) continue;

      const ySpan = Array.isArray(cell.merge) && cell.merge[0] > 0 ? cell.merge[0] : 0;
      const xSpan = Array.isArray(cell.merge) && cell.merge[1] > 0 ? cell.merge[1] : 0;
      const cellEndRi = Math.min(lastRow, ri + ySpan);
      if (cellEndRi < sRi || ri > eRi) continue;

      const style = data.getCellStyleOrDefault(nri, ci);
      const text = resolveDisplayText(data, nri, ci, cell, style);
      if (!text) continue;

      let totalColW = 0;
      const cellEndCi = Math.min(cols.len - 1, ci + xSpan);
      for (let c = ci; c <= cellEndCi; c += 1) {
        if (!cols.isHide(c)) {
          totalColW += cols.getWidth(c);
        }
      }
      if (totalColW <= 0) continue;

      const fontInfo = resolveFontInfo(style, defaultStyle);
      const innerWidth = Math.max(1, totalColW - CELL_PADDING_X * 2);
      const lineCount = countWrappedLines(ctx, text, innerWidth, Boolean(style && style.textwrap), fontInfo);
      const needed = Math.ceil(lineCount * (fontInfo.fontSizePx + 2) + ROW_EXTRA_PADDING);

      if (ySpan > 0) {
        verticalMerges.push({
          sri: ri,
          eri: cellEndRi,
          needed,
        });
        let visibleSpanCount = 0;
        for (let r = ri; r <= cellEndRi; r += 1) {
          if (!rows.isHide(r) && !(exceptRowSet && exceptRowSet.has(r))) visibleSpanCount += 1;
        }
        if (visibleSpanCount > 0) {
          const perRowNeed = Math.ceil(needed / visibleSpanCount);
          for (let r = ri; r <= cellEndRi; r += 1) {
            if (rows.isHide(r) || (exceptRowSet && exceptRowSet.has(r)) || r < sRi || r > eRi) continue;
            const prevBase = rowMergeBaseline.get(r) || 0;
            if (perRowNeed > prevBase) rowMergeBaseline.set(r, perRowNeed);
          }
        }
      } else if (ri >= sRi && ri <= eRi) {
        const prev = rowDesired.get(ri) || 0;
        if (needed > prev) rowDesired.set(ri, needed);
      }
    }
  }

  const nextHeights = new Map();
  for (let ri = sRi; ri <= eRi; ri += 1) {
    if (rows.isHide(ri) || (exceptRowSet && exceptRowSet.has(ri))) continue;
    if (rowDesired.has(ri) || rowMergeBaseline.has(ri)) {
      const rawDesired = rowDesired.has(ri) ? rowDesired.get(ri) : rowMergeBaseline.get(ri);
      let target = clamp(rawDesired, bounds.minRowHeight, bounds.maxRowHeight);
      if (mediaRows.has(ri)) {
        target = Math.max(target, rows.getHeight(ri));
      }
      nextHeights.set(ri, target);
    }
  }

  // Pass 2: distribute deficit of vertically merged cells across visible rows in the merge
  for (let i = 0; i < verticalMerges.length; i += 1) {
    const { sri, eri, needed } = verticalMerges[i];
    const cappedNeed = Math.min(needed, bounds.maxRowHeight * Math.max(1, eri - sri + 1));
    let totalH = 0;
    const adjustableRows = [];
    for (let r = sri; r <= eri; r += 1) {
      if (rows.isHide(r) || (exceptRowSet && exceptRowSet.has(r))) continue;
      const h = nextHeights.has(r) ? nextHeights.get(r) : rows.getHeight(r);
      totalH += h;
      if (r >= sRi && r <= eRi) {
        adjustableRows.push(r);
      }
    }
    if (totalH < cappedNeed && adjustableRows.length > 0) {
      let remaining = cappedNeed - totalH;
      let candidates = adjustableRows.slice();
      while (remaining > 0.5 && candidates.length > 0) {
        const share = Math.ceil(remaining / candidates.length);
        const nextCandidates = [];
        let distributed = 0;
        for (let j = 0; j < candidates.length; j += 1) {
          const r = candidates[j];
          const cur = nextHeights.has(r) ? nextHeights.get(r) : rows.getHeight(r);
          const room = Math.max(0, bounds.maxRowHeight - cur);
          if (room <= 0) continue;
          const add = Math.min(room, share, remaining - distributed);
          if (add > 0) {
            let updated = cur + add;
            if (mediaRows.has(r)) {
              updated = Math.max(updated, rows.getHeight(r));
            }
            nextHeights.set(r, updated);
            distributed += add;
            if (room - add > 0) {
              nextCandidates.push(r);
            }
          }
        }
        if (distributed <= 0) break;
        remaining -= distributed;
        candidates = nextCandidates;
      }
    }
  }

  const result = {};
  nextHeights.forEach((h, ri) => {
    result[ri] = Math.round(h);
  });
  return result;
}

export default {
  computeAutoFitCols,
  computeAutoFitRows,
};
