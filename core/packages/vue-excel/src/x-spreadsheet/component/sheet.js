import { h } from './element';
import {
  bind,
  unbind,
  mouseMoveUp,
  bindTouch,
  createEventEmitter,
} from './event';
import Resizer from './resizer';
import Scrollbar from './scrollbar';
import Selector from './selector';
import Editor from './editor';
import Print from './print';
import ContextMenu from './contextmenu';
import Table from './table';
import Toolbar from './toolbar/index';
import ModalValidation from './modal_validation';
import SortFilter from './sort_filter';
import { xtoast } from './message';
import { cssPrefix } from '../config';
import { formulas } from '../core/formula';

function getOverlayerOffset(overlayerEl, evt) {
  const oRect = overlayerEl && typeof overlayerEl.box === 'function' ? overlayerEl.box() : null;
  const useClient = oRect && oRect.width > 0 && typeof evt.clientX === 'number' && typeof evt.clientY === 'number';
  return {
    offsetX: useClient ? (evt.clientX - oRect.left) : evt.offsetX,
    offsetY: useClient ? (evt.clientY - oRect.top) : evt.offsetY,
  };
}

function isExternalEditableTarget(target) {
  if (!target || typeof target !== 'object') return false;
  const tag = typeof target.tagName === 'string' ? target.tagName.toUpperCase() : '';
  const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || Boolean(target.isContentEditable);
  if (!isEditable) return false;
  if (this.editor && this.editor.textEl && target === this.editor.textEl.el) return false;
  if (this.selector && this.selector.br && this.selector.br.hideInput && target === this.selector.br.hideInput.el) return false;
  return true;
}

function showSheetToast(msg) {
  let tracked = null;
  const remove = xtoast('Tip', msg, () => {
    if (this._toastRemovers && tracked) {
      this._toastRemovers.delete(tracked);
    }
  });
  if (this._toastRemovers) {
    tracked = () => {
      this._toastRemovers.delete(tracked);
      remove();
    };
    this._toastRemovers.add(tracked);
  }
}

function scrollbarMove() {
  const {
    data, verticalScrollbar, horizontalScrollbar,
  } = this;
  const {
    l, t, left, top, width, height,
  } = data.getSelectedRect();
  const tableOffset = this.getTableOffset();
  // console.log(',l:', l, ', left:', left, ', tOffset.left:', tableOffset.width);
  if (left + width > tableOffset.width) {
    horizontalScrollbar.move({ left: Math.max(0, l + width - tableOffset.width - 1) });
  } else {
    const fsw = data.freezeTotalWidth();
    if (left < fsw && l >= fsw) {
      horizontalScrollbar.move({ left: Math.max(0, l - 1 - fsw) });
    }
  }
  // console.log('top:', top, ', height:', height, ', tof.height:', tableOffset.height);
  if (top + height > tableOffset.height) {
    verticalScrollbar.move({ top: Math.max(0, t + height - tableOffset.height - 1) });
  } else {
    const fsh = data.freezeTotalHeight();
    if (top < fsh && t >= fsh) {
      verticalScrollbar.move({ top: Math.max(0, t - 1 - fsh) });
    }
  }
}

function selectorSet(multiple, ri, ci, indexesUpdated = true, moving = false) {
  if (multiple && ri === -1 && ci === -1) return;
  const {
    selector, data,
    contextMenu, toolbar,
  } = this;
  const nri = data.sortedRowMap && data.sortedRowMap.has(ri) ? data.sortedRowMap.get(ri) : ri;
  const cell = data.getCell(nri, ci);
  const prevRange = selector.range
    ? [selector.range.sri, selector.range.sci, selector.range.eri, selector.range.eci]
    : null;
  if (multiple) {
    selector.setEnd(ri, ci, moving);
    this.trigger('cells-selected', cell, selector.range);
  } else {
    // trigger click event
    selector.set(ri, ci, indexesUpdated);
    if (ri === -1 && ci === -1) {
      this.trigger('cells-selected', cell, selector.range);
    } else {
      this.trigger('cell-selected', cell, ri, ci);
    }
  }
  const nextRange = selector.range;
  const rangeChanged = !prevRange || !nextRange
    || prevRange[0] !== nextRange.sri
    || prevRange[1] !== nextRange.sci
    || prevRange[2] !== nextRange.eri
    || prevRange[3] !== nextRange.eci;
  if ((!moving || rangeChanged) && this.table && typeof this.table.render === 'function') {
    this.table.render();
  }
  if (data.settings && data.settings.mode === 'read') {
    contextMenu.setMode('read');
  } else {
    contextMenu.setMode((ri === -1 || ci === -1) ? 'row-col' : 'range');
  }
  if (toolbar && typeof toolbar.reset === 'function') {
    toolbar.reset();
  }
}

// multiple: boolean
// direction: left | right | up | down | row-first | row-last | col-first | col-last
function selectorMove(multiple, direction) {
  const {
    selector, data,
  } = this;
  const { rows, cols } = data;
  let [ri, ci] = selector.indexes || [0, 0];
  const {
    sri, sci, eri, eci,
  } = selector.range;
  if (multiple) {
    [ri, ci] = selector.moveIndexes || selector.indexes || [0, 0];
  }
  // console.log('selector.move:', ri, ci);
  if (direction === 'left') {
    if (!multiple && sci !== ci) ci = sci;
    if (ci > 0) ci -= 1;
  } else if (direction === 'right') {
    if (!multiple && eci !== ci) ci = eci;
    if (ci < cols.len - 1) ci += 1;
  } else if (direction === 'up') {
    if (!multiple && sri !== ri) ri = sri;
    if (ri > 0) ri -= 1;
  } else if (direction === 'down') {
    if (!multiple && eri !== ri) ri = eri;
    if (ri < rows.len - 1) ri += 1;
  } else if (direction === 'row-first') {
    ci = 0;
  } else if (direction === 'row-last') {
    ci = Math.max(0, cols.len - 1);
  } else if (direction === 'col-first') {
    ri = 0;
  } else if (direction === 'col-last') {
    ri = Math.max(0, rows.len - 1);
  }
  if (multiple) {
    selector.moveIndexes = [ri, ci];
  }
  selectorSet.call(this, multiple, ri, ci);
  scrollbarMove.call(this);
}

function isResizeAllowed(data) {
  return Boolean(data && data.settings && data.settings.resizable !== false);
}

// private methods
function overlayerMousemove(evt) {
  if (evt.buttons !== 0) return;
  if (evt.target && evt.target.className === `${cssPrefix}-resizer-hover`) return;
  const {
    rowResizer, colResizer, tableEl, data, overlayerEl,
  } = this;
  if (!isResizeAllowed(data)) {
    rowResizer.hide();
    colResizer.hide();
    return;
  }
  const isRead = data.settings && data.settings.mode === 'read';
  const { offsetX, offsetY } = getOverlayerOffset(overlayerEl, evt);
  const { rows, cols } = data;
  if (offsetX > cols.indexWidth && offsetY > rows.height) {
    rowResizer.hide();
    colResizer.hide();
    return;
  }
  const tRect = tableEl.box();
  const cRect = data.getCellRectByXY(offsetX, offsetY);
  if (cRect.ri >= 0 && cRect.ci === -1) {
    let targetRowRect = cRect;
    const hasHiddenPrevRow = !isRead && rows.isHide(cRect.ri - 1);
    if (!hasHiddenPrevRow && offsetY - cRect.top <= 4 && cRect.top > rows.height) {
      const prevRect = data.getCellRectByXY(offsetX, cRect.top - 1);
      if (
        prevRect.ri >= 0
        && prevRect.ri !== cRect.ri
        && prevRect.ci === -1
        && Math.abs((prevRect.top + prevRect.height) - cRect.top) <= 1
      ) {
        targetRowRect = prevRect;
      }
    }
    targetRowRect.width = cols.indexWidth;
    rowResizer.show(targetRowRect, {
      width: tRect.width,
    });
    if (!isRead && rows.isHide(targetRowRect.ri - 1)) {
      rowResizer.showUnhide(targetRowRect.ri);
    } else {
      rowResizer.hideUnhide();
    }
  } else {
    rowResizer.hide();
  }
  if (cRect.ri === -1 && cRect.ci >= 0) {
    let targetColRect = cRect;
    const hasHiddenPrevCol = !isRead && cols.isHide(cRect.ci - 1);
    if (!hasHiddenPrevCol && offsetX - cRect.left <= 4 && cRect.left > cols.indexWidth) {
      const prevRect = data.getCellRectByXY(cRect.left - 1, offsetY);
      if (
        prevRect.ci >= 0
        && prevRect.ci !== cRect.ci
        && prevRect.ri === -1
        && Math.abs((prevRect.left + prevRect.width) - cRect.left) <= 1
      ) {
        targetColRect = prevRect;
      }
    }
    targetColRect.height = rows.height;
    colResizer.show(targetColRect, {
      height: tRect.height,
    });
    if (!isRead && cols.isHide(targetColRect.ci - 1)) {
      colResizer.showUnhide(targetColRect.ci);
    } else {
      colResizer.hideUnhide();
    }
  } else {
    colResizer.hide();
  }
}

function overlayerMousescroll(evt) {
  const { verticalScrollbar, horizontalScrollbar, data } = this;
  const { rows, cols, exceptRowSet, freeze = [0, 0] } = data;
  const [fri, fci] = freeze;

  const { deltaY = 0, deltaX = 0 } = evt;
  let didScroll = false;
  const moveY = (vertical) => {
    if (vertical > 0) {
      let ri = Math.max(data.scroll.ri, fri);
      while (ri < rows.len && ((exceptRowSet && exceptRowSet.has(ri)) || rows.getHeight(ri) <= 0)) {
        ri += 1;
      }
      if (ri < rows.len - 1) {
        const rh = rows.getHeight(ri);
        if (rh > 0) {
          verticalScrollbar.move({ top: Math.max(1, data.scroll.y + rh - 1) });
          didScroll = true;
        }
      }
    } else {
      let ri = data.scroll.ri - 1;
      while (ri >= fri && ((exceptRowSet && exceptRowSet.has(ri)) || rows.getHeight(ri) <= 0)) {
        ri -= 1;
      }
      if (ri >= fri) {
        const rh = rows.getHeight(ri);
        if (ri <= fri) {
          verticalScrollbar.move({ top: 0 });
          didScroll = true;
        } else if (rh > 0) {
          verticalScrollbar.move({ top: Math.max(0, data.scroll.y - rh - 1) });
          didScroll = true;
        }
      } else if (data.scroll.y > 0) {
        verticalScrollbar.move({ top: 0 });
        didScroll = true;
      }
    }
  };

  const moveX = (horizontal) => {
    if (horizontal > 0) {
      let ci = Math.max(data.scroll.ci, fci);
      while (ci < cols.len && cols.getWidth(ci) <= 0) {
        ci += 1;
      }
      if (ci < cols.len - 1) {
        const cw = cols.getWidth(ci);
        if (cw > 0) {
          horizontalScrollbar.move({ left: Math.max(1, data.scroll.x + cw - 1) });
          didScroll = true;
        }
      }
    } else {
      let ci = data.scroll.ci - 1;
      while (ci >= fci && cols.getWidth(ci) <= 0) {
        ci -= 1;
      }
      if (ci >= fci) {
        const cw = cols.getWidth(ci);
        if (ci <= fci) {
          horizontalScrollbar.move({ left: 0 });
          didScroll = true;
        } else if (cw > 0) {
          horizontalScrollbar.move({ left: Math.max(0, data.scroll.x - cw - 1) });
          didScroll = true;
        }
      } else if (data.scroll.x > 0) {
        horizontalScrollbar.move({ left: 0 });
        didScroll = true;
      }
    }
  };
  const tempY = Math.abs(deltaY);
  const tempX = Math.abs(deltaX);
  const temp = Math.max(tempY, tempX);
  if (typeof window !== 'undefined' && window.navigator && /Firefox/i.test(window.navigator.userAgent) && evt.detail) {
    moveY(evt.detail);
  }
  if (temp === 0) {
    if (didScroll && typeof evt.preventDefault === 'function') evt.preventDefault();
    return;
  }
  if (deltaX !== 0 && temp === tempX) moveX(deltaX);
  if (deltaY !== 0 && temp === tempY) moveY(deltaY);
  if (didScroll && typeof evt.preventDefault === 'function') evt.preventDefault();
}

function overlayerTouch(direction, distance) {
  const { verticalScrollbar, horizontalScrollbar } = this;
  const { top } = verticalScrollbar.scroll();
  const { left } = horizontalScrollbar.scroll();

  if (direction === 'left' || direction === 'right') {
    horizontalScrollbar.move({ left: left - distance });
  } else if (direction === 'up' || direction === 'down') {
    verticalScrollbar.move({ top: top - distance });
  }
}

function verticalScrollbarSet() {
  const { data, verticalScrollbar } = this;
  const { height } = this.getTableOffset();
  const erth = data.exceptRowTotalHeight(0, -1);
  const contentHeight = Math.max(0, data.rows.totalHeight() - erth);
  verticalScrollbar.set(height, contentHeight);
  if (contentHeight <= height - 1 && (data.scroll.y > 0 || data.scroll.ri > 0)) {
    data.scroll.y = 0;
    data.scroll.ri = 0;
    verticalScrollbar.move({ top: 0 }, true);
  }
}

function horizontalScrollbarSet() {
  const { data, horizontalScrollbar } = this;
  const { width } = this.getTableOffset();
  if (data) {
    const contentWidth = Math.max(0, data.cols.totalWidth());
    horizontalScrollbar.set(width, contentWidth);
    if (contentWidth <= width - 1 && (data.scroll.x > 0 || data.scroll.ci > 0)) {
      data.scroll.x = 0;
      data.scroll.ci = 0;
      horizontalScrollbar.move({ left: 0 }, true);
    }
  }
}

function sheetFreeze() {
  const {
    selector, data, editor,
  } = this;
  const [ri, ci] = data.freeze;
  if (ri > 0 || ci > 0) {
    const fwidth = data.freezeTotalWidth();
    const fheight = data.freezeTotalHeight();
    editor.setFreezeLengths(fwidth, fheight);
  } else {
    editor.setFreezeLengths(0, 0);
  }
  selector.resetAreaOffset();
}

function sheetReset() {
  const {
    tableEl,
    overlayerEl,
    overlayerCEl,
    table,
    toolbar,
    selector,
    el,
  } = this;
  const tOffset = this.getTableOffset();
  const vRect = this.getRect();
  tableEl.attr(vRect);
  overlayerEl.offset(vRect);
  overlayerCEl.offset(tOffset);
  el.css('width', `${vRect.width}px`);
  verticalScrollbarSet.call(this);
  horizontalScrollbarSet.call(this);
  sheetFreeze.call(this);
  table.render();
  toolbar.reset();
  selector.reset();
}

function clearClipboard() {
  const { data, selector } = this;
  data.clearClipboard();
  selector.hideClipboard();
}

function copy(evt) {
  const { data, selector } = this;
  data.copy();
  data.copyToSystemClipboard(evt);
  selector.showClipboard();
}

function cut() {
  const { data, selector } = this;
  if (data.settings.mode === 'read') return;
  data.cut();
  selector.showClipboard();
}

function paste(what, evt) {
  const { data } = this;
  if (data.settings.mode === 'read') return;
  if (data.clipboard.isClear()) {
    if (evt && evt.clipboardData) {
      const cdata = evt.clipboardData.getData('text/plain');
      this.data.pasteFromText(cdata);
      sheetReset.call(this);
      return;
    }
    const resetSheet = () => {
      if (!this._isDestroyed) sheetReset.call(this);
    };
    const eventTrigger = (rows) => {
      if (!this._isDestroyed) this.trigger('pasted-clipboard', rows);
    };
    // pastFromSystemClipboard is async operation, need to tell it how to reset sheet and trigger event after it finishes
    // pasting content from system clipboard
    data.pasteFromSystemClipboard(resetSheet, eventTrigger);
  } else if (data.paste(what, msg => showSheetToast.call(this, msg))) {
    sheetReset.call(this);
  }
}

function hideRowsOrCols() {
  if (this.data.settings.mode === 'read') return;
  this.data.hideRowsOrCols();
  sheetReset.call(this);
}

function unhideRowsOrCols(type, index) {
  if (this.data.settings.mode === 'read') return;
  this.data.unhideRowsOrCols(type, index);
  sheetReset.call(this);
}

function autofilter() {
  if (this.data.settings.mode === 'read') return;
  const { data } = this;
  data.autofilter();
  sheetReset.call(this);
}

function toolbarChangePaintformatPaste() {
  const { toolbar } = this;
  if (toolbar.paintformatActive()) {
    paste.call(this, 'format');
    clearClipboard.call(this);
    toolbar.paintformatToggle();
  }
}

function overlayerMousedown(evt) {
  if (evt.button !== undefined && evt.button !== 0 && evt.button !== 2) {
    return;
  }
  const {
    selector, data, table, sortFilter, overlayerEl,
  } = this;
  const isRead = data.settings.mode === 'read';
  const isAutofillEl = !isRead && evt.target && evt.target.className === `${cssPrefix}-selector-corner`;
  const { offsetX, offsetY } = getOverlayerOffset(overlayerEl, evt);
  const cellRect = data.getCellRectByXY(offsetX, offsetY);
  const {
    left, top, width, height,
  } = cellRect;
  let { ri, ci } = cellRect;
  const isRightButton = evt.buttons === 2 || evt.button === 2;
  if (isRightButton) {
    selectorSet.call(this, false, ri, ci);
    return;
  }
  // sort or filter
  const { autoFilter } = data;
  if (!isRead && autoFilter.includes(ri, ci)) {
    if (left + width - 20 < offsetX && top + height - 20 < offsetY) {
      const items = autoFilter.items(ci, (r, c) => data.rows.getCell(r, c));
      sortFilter.hide();
      sortFilter.set(ci, items, autoFilter.getFilter(ci), autoFilter.getSort(ci));
      sortFilter.setOffset({ left, top: top + height + 2 }, this.getRect());
      return;
    }
  }

  if (ri === -1 && ci === -1) {
    selectorSet.call(this, false, -1, -1);
    return;
  }

  const startedOnCell = ri >= 0 && ci >= 0;
  const startedOnColHeader = ri === -1 && ci >= 0;
  const startedOnRowHeader = ri >= 0 && ci === -1;
  if (!evt.shiftKey) {
    if (isAutofillEl) {
      selector.showAutofill(ri, ci);
    } else {
      selectorSet.call(this, false, ri, ci);
    }

    // mouse move up
    if (typeof window !== 'undefined') {
      this._cancelMoveUp = mouseMoveUp(window, (e) => {
        if (e.buttons === 0) {
          if (typeof this._cancelMoveUp === 'function') this._cancelMoveUp();
          return;
        }
        const { offsetX: mx, offsetY: my } = getOverlayerOffset(overlayerEl, e);
        ({ ri, ci } = data.getCellRectByXY(mx, my));
        if (startedOnColHeader && !isAutofillEl) {
          ri = -1;
          ci = Math.max(0, ci);
        } else if (startedOnRowHeader && !isAutofillEl) {
          ci = -1;
          ri = Math.max(0, ri);
        } else if (startedOnCell && !isAutofillEl) {
          ri = Math.max(0, ri);
          ci = Math.max(0, ci);
        }
        if (isAutofillEl) {
          selector.showAutofill(ri, ci);
        } else if (e.buttons === 1 && !e.shiftKey) {
          selectorSet.call(this, true, ri, ci, true, true);
        }
      }, () => {
        this._cancelMoveUp = null;
        if (isAutofillEl && selector.arange && data.settings.mode !== 'read') {
          if (data.autofill(selector.arange, 'all', msg => showSheetToast.call(this, msg))) {
            table.render();
            if (this.toolbar && typeof this.toolbar.reset === 'function') {
              this.toolbar.reset();
            }
          }
        }
        selector.hideAutofill();
        toolbarChangePaintformatPaste.call(this);
      }, () => {
        this._cancelMoveUp = null;
        selector.hideAutofill();
      });
    }
  }

  if (!isAutofillEl && (evt.buttons === 1 || evt.button === 0)) {
    if (evt.shiftKey) {
      selectorSet.call(this, true, ri, ci);
    }
  }
}

function editorSetOffset() {
  const { editor, data } = this;
  const sOffset = data.getSelectedRect();
  const tOffset = this.getTableOffset();
  let sPosition = 'top';
  // console.log('sOffset:', sOffset, ':', tOffset);
  if (sOffset.top > tOffset.height / 2) {
    sPosition = 'bottom';
  }
  editor.setOffset(sOffset, sPosition);
}

function editorSet(initialTextOverride) {
  const { editor, data } = this;
  if (data.settings.mode === 'read') return;
  this.focusing = true;
  editorSetOffset.call(this);
  editor.setCell(data.getSelectedCell(), data.getSelectedValidator(), initialTextOverride);
  clearClipboard.call(this);
}

function verticalScrollbarMove(distance) {
  const { data, table, selector } = this;
  data.scrolly(distance, () => {
    selector.resetBRLAreaOffset();
    editorSetOffset.call(this);
    table.render();
  });
}

function horizontalScrollbarMove(distance) {
  const { data, table, selector } = this;
  data.scrollx(distance, () => {
    selector.resetBRTAreaOffset();
    editorSetOffset.call(this);
    table.render();
  });
}

function refreshAfterSizeChange() {
  const {
    table, selector, toolbar,
  } = this;
  sheetFreeze.call(this);
  table.render();
  selector.resetAreaOffset();
  verticalScrollbarSet.call(this);
  horizontalScrollbarSet.call(this);
  editorSetOffset.call(this);
  if (toolbar && typeof toolbar.reset === 'function') {
    toolbar.reset();
  }
}

function rowResizerFinished(cRect, distance) {
  if (!isResizeAllowed(this.data)) return;
  const { ri } = cRect;
  const {
    selector, data,
  } = this;
  const { range } = selector;
  const { sri, eri } = range;
  const isFullRowSel = range && range.sci === 0 && range.eci === data.cols.len - 1;
  const apply = () => {
    if (isFullRowSel && ri >= sri && ri <= eri) {
      for (let row = sri; row <= eri; row += 1) {
        if (!data.rows.isHide(row) && !(data.exceptRowSet && data.exceptRowSet.has(row))) {
          data.rows.setHeight(row, distance);
        }
      }
    } else {
      data.rows.setHeight(ri, distance);
    }
  };
  if (data.settings.mode !== 'read') {
    data.changeData(apply);
  } else {
    apply();
  }
  refreshAfterSizeChange.call(this);
}

function colResizerFinished(cRect, distance) {
  if (!isResizeAllowed(this.data)) return;
  const { ci } = cRect;
  const {
    selector, data,
  } = this;
  const { range } = selector;
  const { sci, eci } = range;
  const isFullColSel = range && range.sri === 0 && range.eri === data.rows.len - 1;
  const apply = () => {
    if (isFullColSel && ci >= sci && ci <= eci) {
      for (let col = sci; col <= eci; col += 1) {
        if (!data.cols.isHide(col)) {
          data.cols.setWidth(col, distance);
        }
      }
    } else {
      data.cols.setWidth(ci, distance);
    }
  };
  if (data.settings.mode !== 'read') {
    data.changeData(apply);
  } else {
    apply();
  }
  refreshAfterSizeChange.call(this);
}

function dataSetCellText(text, state = 'finished') {
  if (this._isDestroyed) return;
  const { data, table, toolbar } = this;
  if (data.settings.mode === 'read') return;
  const selectedCell = data.getSelectedCell();
  if (selectedCell && selectedCell.editable === false) return;
  if (state === 'cancel') {
    const { ri, ci } = data.selector;
    const nri = data.mapRowIndex(ri);
    const hasOrigin = data._editingOrigin && data._editingOrigin.ri === nri && data._editingOrigin.ci === ci;
    const revertText = hasOrigin ? data._editingOrigin.text : (text != null ? text : '');
    data._editingOrigin = null;
    data.rows.setCellText(nri, ci, revertText);
    data.validations.validate(nri, ci, revertText);
    table.render();
    return;
  }
  data.setSelectedCellText(text, state);
  const { ri, ci } = data.selector;
  if (state === 'finished') {
    table.render();
    if (toolbar && typeof toolbar.reset === 'function') {
      toolbar.reset();
    }
  } else {
    this.trigger('cell-edited', text, ri, ci);
  }
}

function insertDeleteRowColumn(type) {
  const { data } = this;
  if (data.settings.mode === 'read') return;
  if (type === 'insert-row') {
    data.insert('row');
  } else if (type === 'delete-row') {
    data.delete('row');
  } else if (type === 'insert-column') {
    data.insert('column');
  } else if (type === 'delete-column') {
    data.delete('column');
  } else if (type === 'delete-cell') {
    data.deleteCell();
  } else if (type === 'delete-cell-format') {
    data.deleteCell('format');
  } else if (type === 'delete-cell-text') {
    data.deleteCell('text');
  } else if (type === 'cell-printable') {
    data.setSelectedCellAttr('printable', true);
  } else if (type === 'cell-non-printable') {
    data.setSelectedCellAttr('printable', false);
  } else if (type === 'cell-editable') {
    data.setSelectedCellAttr('editable', true);
  } else if (type === 'cell-non-editable') {
    data.setSelectedCellAttr('editable', false);
  }
  clearClipboard.call(this);
  sheetReset.call(this);
}

function toolbarChange(type, value) {
  const { data, toolbar } = this;
  if (data.settings.mode === 'read') {
    if (toolbar && typeof toolbar.reset === 'function') {
      toolbar.reset();
    }
    return;
  }
  if (type === 'undo') {
    this.undo();
  } else if (type === 'redo') {
    this.redo();
  } else if (type === 'print') {
    this.print.preview();
  } else if (type === 'paintformat') {
    if (value === true) copy.call(this);
    else clearClipboard.call(this);
  } else if (type === 'clearformat') {
    insertDeleteRowColumn.call(this, 'delete-cell-format');
  } else if (type === 'link') {
    // link
  } else if (type === 'chart') {
    // chart
  } else if (type === 'autofilter') {
    // filter
    autofilter.call(this);
  } else if (type === 'freeze') {
    if (value) {
      const { ri, ci } = data.selector;
      this.freeze(ri, ci);
    } else {
      this.freeze(0, 0);
    }
  } else {
    data.setSelectedCellAttr(type, value);
    if (type === 'formula' && data.isSingleSelected()) {
      editorSet.call(this);
    }
    sheetReset.call(this);
  }
}

function sortFilterChange(ci, order, operator, value) {
  if (this.data.settings.mode === 'read') return;
  // console.log('sort:', sortDesc, operator, value);
  this.data.setAutoFilter(ci, order, operator, value);
  sheetReset.call(this);
}

function sheetInitEvents() {
  const {
    selector,
    overlayerEl,
    rowResizer,
    colResizer,
    verticalScrollbar,
    horizontalScrollbar,
    editor,
    contextMenu,
    toolbar,
    modalValidation,
    sortFilter,
  } = this;
  // overlayer
  overlayerEl
    .on('mousemove', (evt) => {
      overlayerMousemove.call(this, evt);
    })
    .on('mousedown', (evt) => {
      editor.clear();
      contextMenu.hide();
      const { offsetX, offsetY } = getOverlayerOffset(overlayerEl, evt);
      if (evt.buttons === 2 || evt.button === 2) {
        const hitRect = this.data.getCellRectByXY(offsetX, offsetY);
        const { selector: sel, rows: dRows, cols: dCols } = this.data;
        const inRowHeaderSelection = offsetX <= dCols.indexWidth
          && sel.size()[1] === dCols.len
          && hitRect.ri >= sel.range.sri && hitRect.ri <= sel.range.eri;
        const inColHeaderSelection = offsetY <= dRows.height
          && sel.size()[0] === dRows.len
          && hitRect.ci >= sel.range.sci && hitRect.ci <= sel.range.eci;
        if (this.data.xyInSelectedRect(offsetX, offsetY) || inRowHeaderSelection || inColHeaderSelection) {
          if (this.data.settings && this.data.settings.mode === 'read') {
            contextMenu.setMode('read');
          } else {
            contextMenu.setMode((inRowHeaderSelection || inColHeaderSelection) ? 'row-col' : 'range');
          }
          contextMenu.setPosition(offsetX, offsetY);
        } else {
          overlayerMousedown.call(this, evt);
          contextMenu.setPosition(offsetX, offsetY);
        }
        evt.stopPropagation();
      } else if (evt.detail === 2 && (evt.button === undefined || evt.button === 0)) {
        if (offsetX <= this.data.cols.indexWidth && offsetY <= this.data.rows.height) {
          selectorSet.call(this, false, -1, -1);
        } else if (offsetX > this.data.cols.indexWidth && offsetY > this.data.rows.height) {
          const hitRect = this.data.getCellRectByXY(offsetX, offsetY);
          const { autoFilter } = this.data;
          const onFilterBtn = autoFilter && autoFilter.includes(hitRect.ri, hitRect.ci)
            && hitRect.left + hitRect.width - 20 < offsetX
            && hitRect.top + hitRect.height - 20 < offsetY;
          if (!onFilterBtn) {
            editorSet.call(this);
          }
        }
      } else {
        overlayerMousedown.call(this, evt);
      }
    })
    .on('mousewheel.stop', (evt) => {
      overlayerMousescroll.call(this, evt);
    })
    .on('mouseout', (evt) => {
      const { offsetX, offsetY } = getOverlayerOffset(overlayerEl, evt);
      if (offsetY <= 0) colResizer.hide();
      if (offsetX <= 0) rowResizer.hide();
    });

  selector.inputChange = (v) => {
    const prevCell = this.data.getSelectedCell();
    const initialText = (prevCell && prevCell.text != null) ? String(prevCell.text) : '';
    dataSetCellText.call(this, v, 'input');
    editorSet.call(this, initialText);
  };

  // slide on mobile
  this._unbindTouch = bindTouch(overlayerEl.el, {
    move: (direction, d) => {
      overlayerTouch.call(this, direction, d);
    },
  });

  // toolbar change
  toolbar.change = (type, value) => toolbarChange.call(this, type, value);

  // sort filter ok
  sortFilter.ok = (ci, order, o, v) => sortFilterChange.call(this, ci, order, o, v);

  // resizer finished callback
  rowResizer.finishedFn = (cRect, distance) => {
    rowResizerFinished.call(this, cRect, distance);
  };
  colResizer.finishedFn = (cRect, distance) => {
    colResizerFinished.call(this, cRect, distance);
  };
  // resizer double-click auto-fit callback
  rowResizer.autoFitFn = (cRect) => {
    if (!isResizeAllowed(this.data) || !cRect || typeof cRect.ri !== 'number') return;
    const { range } = this.selector;
    const isFullRowSel = range && range.sci === 0 && range.eci === this.data.cols.len - 1;
    if (isFullRowSel && cRect.ri >= range.sri && cRect.ri <= range.eri) {
      this.data.autoFitRows(range.sri, range.eri);
      refreshAfterSizeChange.call(this);
    } else {
      this.autoFitRow(cRect.ri);
    }
  };
  colResizer.autoFitFn = (cRect) => {
    if (!isResizeAllowed(this.data) || !cRect || typeof cRect.ci !== 'number') return;
    const { range } = this.selector;
    const isFullColSel = range && range.sri === 0 && range.eri === this.data.rows.len - 1;
    if (isFullColSel && cRect.ci >= range.sci && cRect.ci <= range.eci) {
      this.data.autoFitCols(range.sci, range.eci);
      refreshAfterSizeChange.call(this);
    } else {
      this.autoFitCol(cRect.ci);
    }
  };
  // resizer unhide callback
  rowResizer.unhideFn = (index) => {
    unhideRowsOrCols.call(this, 'row', index);
  };
  colResizer.unhideFn = (index) => {
    unhideRowsOrCols.call(this, 'col', index);
  };
  // scrollbar move callback
  verticalScrollbar.moveFn = (distance, evt) => {
    verticalScrollbarMove.call(this, distance, evt);
  };
  horizontalScrollbar.moveFn = (distance, evt) => {
    horizontalScrollbarMove.call(this, distance, evt);
  };
  // editor
  editor.change = (state, itext) => {
    dataSetCellText.call(this, itext, state);
  };
  // modal validation
  modalValidation.change = (action, ...args) => {
    if (this.data.settings.mode === 'read') return;
    if (action === 'save') {
      this.data.addValidation(...args);
    } else {
      this.data.removeValidation();
    }
    this.table.render();
    if (toolbar && typeof toolbar.reset === 'function') {
      toolbar.reset();
    }
  };
  // contextmenu
  contextMenu.itemClick = (type) => {
    if (this.data.settings.mode === 'read') {
      if (type === 'copy') {
        this.data.copy();
        this.data.copyToSystemClipboard();
        selector.showClipboard();
      }
      return;
    }
    // console.log('type:', type);
    if (type === 'validation') {
      modalValidation.setValue(this.data.getSelectedValidation());
    } else if (type === 'copy') {
      copy.call(this);
    } else if (type === 'cut') {
      cut.call(this);
    } else if (type === 'paste') {
      paste.call(this, 'all');
    } else if (type === 'paste-value') {
      paste.call(this, 'text');
    } else if (type === 'paste-format') {
      paste.call(this, 'format');
    } else if (type === 'hide') {
      hideRowsOrCols.call(this);
    } else {
      insertDeleteRowColumn.call(this, type);
    }
  };

  this._onWindowResize = () => {
    this.reload();
  };
  this._onWindowClick = (evt) => {
    this.focusing = overlayerEl.contains(evt.target)
      || Boolean(rowResizer && rowResizer.el && typeof rowResizer.el.contains === 'function' && rowResizer.el.contains(evt.target))
      || Boolean(colResizer && colResizer.el && typeof colResizer.el.contains === 'function' && colResizer.el.contains(evt.target));
  };
  this._onWindowPaste = (evt) => {
    if (!this.focusing || this.data.settings.mode === 'read') return;
    if (isExternalEditableTarget.call(this, evt.target)) return;
    paste.call(this, 'all', evt);
    evt.preventDefault();
  };
  this._onWindowCopy = (evt) => {
    if (!this.focusing) return;
    if (isExternalEditableTarget.call(this, evt.target)) return;
    copy.call(this, evt);
    evt.preventDefault();
  };

  // for selector
  this._onWindowKeydown = (evt) => {
    const keyCode = evt.keyCode || evt.which;
    const {
      key, ctrlKey, shiftKey, metaKey, altKey, isComposing,
    } = evt;
    if (isComposing || keyCode === 229 || key === 'Process') {
      return;
    }
    if (isExternalEditableTarget.call(this, evt.target)) {
      return;
    }
    if (typeof document !== 'undefined' && isExternalEditableTarget.call(this, document.activeElement)) {
      return;
    }
    if (this.print && this.print.el && typeof this.print.el.css === 'function' && this.print.el.css('display') !== 'none') {
      return;
    }
    const isEditingCommitKey = this.editor && this.editor._editing && (keyCode === 13 || keyCode === 9);
    if (!this.focusing && !isEditingCommitKey) return;
    if (this.editor && this.editor._editing && keyCode !== 13 && keyCode !== 9) {
      return;
    }
    if (ctrlKey || metaKey) {
      switch (keyCode) {
        case 65:
          // ctrl + a: select all
          selectorSet.call(this, false, -1, -1);
          evt.preventDefault();
          break;
        case 90:
          // undo: ctrl + z | redo: ctrl + shift + z
          if (this.data.settings.mode !== 'read') {
            if (shiftKey) {
              this.redo();
            } else {
              this.undo();
            }
            evt.preventDefault();
          }
          break;
        case 89:
          // redo: ctrl + y
          if (this.data.settings.mode !== 'read') {
            this.redo();
            evt.preventDefault();
          }
          break;
        case 80:
          // print: ctrl + p
          if (this.data.settings.mode !== 'read' && this.print && typeof this.print.preview === 'function') {
            this.focusing = false;
            this.print.preview();
            evt.preventDefault();
          }
          break;
        case 67:
          // ctrl + c
          break;
        case 88:
          // ctrl + x
          if (this.data.settings.mode !== 'read') {
            cut.call(this);
            evt.preventDefault();
          }
          break;
        case 85:
          // ctrl + u
          if (this.data.settings.mode !== 'read') {
            toolbar.trigger('underline');
            evt.preventDefault();
          }
          break;
        case 86:
          // ctrl + v
          break;
        case 37:
          // ctrl + left
          selectorMove.call(this, shiftKey, 'row-first');
          evt.preventDefault();
          break;
        case 38:
          // ctrl + up
          selectorMove.call(this, shiftKey, 'col-first');
          evt.preventDefault();
          break;
        case 39:
          // ctrl + right
          selectorMove.call(this, shiftKey, 'row-last');
          evt.preventDefault();
          break;
        case 40:
          // ctrl + down
          selectorMove.call(this, shiftKey, 'col-last');
          evt.preventDefault();
          break;
        case 32:
          // ctrl + space, all cells in col
          selectorSet.call(this, false, -1, this.data.selector.ci, false);
          evt.preventDefault();
          break;
        case 66:
          // ctrl + B
          if (this.data.settings.mode !== 'read') {
            toolbar.trigger('bold');
            evt.preventDefault();
          }
          break;
        case 73:
          // ctrl + I
          if (this.data.settings.mode !== 'read') {
            toolbar.trigger('italic');
            evt.preventDefault();
          }
          break;
        default:
          break;
      }
    } else {
      switch (keyCode) {
        case 32:
          if (shiftKey) {
            selectorSet.call(this, false, this.data.selector.ri, -1, false);
          }
          break;
        case 27: // esc
          contextMenu.hide();
          clearClipboard.call(this);
          break;
        case 37: // left
          selectorMove.call(this, shiftKey, 'left');
          evt.preventDefault();
          break;
        case 38: // up
          selectorMove.call(this, shiftKey, 'up');
          evt.preventDefault();
          break;
        case 39: // right
          selectorMove.call(this, shiftKey, 'right');
          evt.preventDefault();
          break;
        case 40: // down
          selectorMove.call(this, shiftKey, 'down');
          evt.preventDefault();
          break;
        case 9: // tab
          editor.clear();
          selectorMove.call(this, false, shiftKey ? 'left' : 'right');
          evt.preventDefault();
          break;
        case 13: // enter
          editor.clear();
          selectorMove.call(this, false, shiftKey ? 'up' : 'down');
          evt.preventDefault();
          break;
        case 8: // backspace
          if (this.data.settings.mode !== 'read') {
            insertDeleteRowColumn.call(this, 'delete-cell-text');
            evt.preventDefault();
          }
          break;
        default:
          break;
      }

      if (key === 'Delete') {
        if (this.data.settings.mode !== 'read') {
          insertDeleteRowColumn.call(this, 'delete-cell-text');
          evt.preventDefault();
        }
      } else if (altKey) {
        return;
      } else if ((keyCode >= 65 && keyCode <= 90)
        || (keyCode >= 48 && keyCode <= 57)
        || (keyCode >= 96 && keyCode <= 105)
        || evt.key === '='
      ) {
        const prevCell = this.data.getSelectedCell();
        const initialText = (prevCell && prevCell.text != null) ? String(prevCell.text) : '';
        dataSetCellText.call(this, evt.key, 'input');
        editorSet.call(this, initialText);
      } else if (keyCode === 113) {
        // F2
        editorSet.call(this);
      }
    }
  };
  if (typeof window !== 'undefined') {
    bind(window, 'resize', this._onWindowResize);
    bind(window, 'click', this._onWindowClick);
    bind(window, 'paste', this._onWindowPaste);
    bind(window, 'copy', this._onWindowCopy);
    bind(window, 'keydown', this._onWindowKeydown);
  }
}

export default class Sheet {
  constructor(targetEl, data) {
    this._isDestroyed = false;
    this._cancelMoveUp = null;
    this._toastRemovers = new Set();
    this.eventMap = createEventEmitter();
    const { view, showToolbar, showContextmenu } = data.settings;
    this.el = h('div', `${cssPrefix}-sheet`);
    this.toolbar = new Toolbar(data, view.width, !showToolbar);
    this.print = new Print(data);
    targetEl.children(this.toolbar.el, this.el, this.print.el);
    this.data = data;
    // table
    this.tableEl = h('canvas', `${cssPrefix}-table`);
    // resizer
    this.rowResizer = new Resizer(false, Math.min(data.rows.height || 24, 16));
    this.colResizer = new Resizer(true, data.cols.minWidth);
    // scrollbar
    this.verticalScrollbar = new Scrollbar(true);
    this.horizontalScrollbar = new Scrollbar(false);
    // editor
    this.editor = new Editor(
      formulas,
      () => this.getTableOffset(),
      data.rows.height,
    );
    // data validation
    this.modalValidation = new ModalValidation();
    // contextMenu
    this.contextMenu = new ContextMenu(() => this.getRect(), !showContextmenu);
    this.contextMenu.setMode(data.settings && data.settings.mode === 'read' ? 'read' : 'range');
    // selector
    this.selector = new Selector(data);
    this.overlayerCEl = h('div', `${cssPrefix}-overlayer-content`)
      .children(
        this.editor.el,
        this.selector.el,
      );
    this.overlayerEl = h('div', `${cssPrefix}-overlayer`)
      .child(this.overlayerCEl);
    // sortFilter
    this.sortFilter = new SortFilter();
    // root element
    this.el.children(
      this.tableEl,
      this.overlayerEl.el,
      this.rowResizer.el,
      this.colResizer.el,
      this.verticalScrollbar.el,
      this.horizontalScrollbar.el,
      this.contextMenu.el,
      this.modalValidation.el,
      this.sortFilter.el,
    );
    // table
    this.table = new Table(this.tableEl.el, data);
    sheetInitEvents.call(this);
    sheetReset.call(this);
    // init selector [0, 0]
    // selectorSet.call(this, false, 0, 0);
  }

  on(eventName, func) {
    this.eventMap.on(eventName, func);
    return this;
  }

  trigger(eventName, ...args) {
    const { eventMap } = this;
    eventMap.fire(eventName, args);
  }

  resetData(data) {
    // before
    if (typeof this._cancelMoveUp === 'function') {
      this._cancelMoveUp();
      this._cancelMoveUp = null;
    }
    this.editor.clear();
    this.contextMenu.hide();
    this.sortFilter.hide();
    this.modalValidation.hide();
    this.rowResizer.destroy();
    this.colResizer.destroy();
    // after
    this.data = data;
    this.contextMenu.setMode(data.settings && data.settings.mode === 'read' ? 'read' : 'range');
    verticalScrollbarSet.call(this);
    horizontalScrollbarSet.call(this);
    this.verticalScrollbar.move({ top: data.scroll.y }, true);
    this.horizontalScrollbar.move({ left: data.scroll.x }, true);
    this.toolbar.resetData(data);
    this.print.resetData(data);
    this.selector.resetData(data);
    sheetFreeze.call(this);
    this.table.resetData(data);
  }

  loadData(data) {
    if (typeof this._cancelMoveUp === 'function') {
      this._cancelMoveUp();
      this._cancelMoveUp = null;
    }
    this.editor.clear(true);
    this.contextMenu.hide();
    this.sortFilter.hide();
    this.modalValidation.hide();
    this.rowResizer.destroy();
    this.colResizer.destroy();
    this.data.setData(data);
    this.contextMenu.setMode(this.data.settings && this.data.settings.mode === 'read' ? 'read' : 'range');
    sheetReset.call(this);
    return this;
  }

  // freeze rows or cols
  freeze(ri, ci) {
    const { data } = this;
    if (data.settings.mode === 'read') return this;
    data.setFreeze(ri, ci);
    sheetReset.call(this);
    return this;
  }

  undo() {
    if (this.data.settings.mode === 'read') return;
    this.data.undo();
    sheetReset.call(this);
  }

  redo() {
    if (this.data.settings.mode === 'read') return;
    this.data.redo();
    sheetReset.call(this);
  }

  reload() {
    sheetReset.call(this);
    return this;
  }

  autoFitCol(ci, opts = {}) {
    if (!this.data) return this;
    this.data.autoFitCol(ci, opts);
    refreshAfterSizeChange.call(this);
    return this;
  }

  autoFitAllCols(opts = {}) {
    if (!this.data) return this;
    this.data.autoFitCols(0, null, opts);
    refreshAfterSizeChange.call(this);
    return this;
  }

  autoFitRow(ri, opts = {}) {
    if (!this.data) return this;
    this.data.autoFitRow(ri, opts);
    refreshAfterSizeChange.call(this);
    return this;
  }

  autoFitAllRows(opts = {}) {
    if (!this.data) return this;
    this.data.autoFitRows(0, null, opts);
    refreshAfterSizeChange.call(this);
    return this;
  }

  autoFitAll(opts = {}) {
    if (!this.data) return this;
    this.data.autoFitAll(opts);
    refreshAfterSizeChange.call(this);
    return this;
  }

  getRect() {
    const { data } = this;
    return { width: data.viewWidth(), height: data.viewHeight() };
  }

  getTableOffset() {
    const { rows, cols } = this.data;
    const { width, height } = this.getRect();
    return {
      width: width - cols.indexWidth,
      height: height - rows.height,
      left: cols.indexWidth,
      top: rows.height,
    };
  }

  destroy() {
    this._isDestroyed = true;
    if (this._toastRemovers) {
      Array.from(this._toastRemovers).forEach(fn => fn());
      this._toastRemovers.clear();
    }
    if (this.verticalScrollbar && typeof this.verticalScrollbar.destroy === 'function') {
      this.verticalScrollbar.destroy();
    }
    if (this.horizontalScrollbar && typeof this.horizontalScrollbar.destroy === 'function') {
      this.horizontalScrollbar.destroy();
    }
    if (typeof this._unbindTouch === 'function') {
      this._unbindTouch();
      this._unbindTouch = null;
    }
    if (typeof this._cancelMoveUp === 'function') {
      this._cancelMoveUp();
      this._cancelMoveUp = null;
    }
    if (this.editor && typeof this.editor.clear === 'function') {
      this.editor.clear(true);
    }
    if (this.rowResizer && typeof this.rowResizer.destroy === 'function') {
      this.rowResizer.destroy();
    }
    if (this.colResizer && typeof this.colResizer.destroy === 'function') {
      this.colResizer.destroy();
    }
    if (this.print && typeof this.print.destroy === 'function') {
      this.print.destroy();
    }
    if (this.contextMenu && typeof this.contextMenu.hide === 'function') {
      this.contextMenu.hide();
    }
    if (this.sortFilter && typeof this.sortFilter.hide === 'function') {
      this.sortFilter.hide();
    }
    if (this.modalValidation && typeof this.modalValidation.hide === 'function') {
      this.modalValidation.hide();
    }
    if (typeof window !== 'undefined') {
      if (this._onWindowResize) unbind(window, 'resize', this._onWindowResize);
      if (this._onWindowClick) unbind(window, 'click', this._onWindowClick);
      if (this._onWindowPaste) unbind(window, 'paste', this._onWindowPaste);
      if (this._onWindowCopy) unbind(window, 'copy', this._onWindowCopy);
      if (this._onWindowKeydown) unbind(window, 'keydown', this._onWindowKeydown);
    }
    this._onWindowResize = null;
    this._onWindowClick = null;
    this._onWindowPaste = null;
    this._onWindowCopy = null;
    this._onWindowKeydown = null;
    if (this.toolbar && typeof this.toolbar.destroy === 'function') {
      this.toolbar.destroy();
    }
    if (this.eventMap && typeof this.eventMap.removeAllListeners === 'function') {
      this.eventMap.removeAllListeners();
    }
  }
}
