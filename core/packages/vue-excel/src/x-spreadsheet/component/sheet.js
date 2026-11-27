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
import { xtoast, clearToasts } from './message';
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
    horizontalScrollbar.move({ left: l + width - tableOffset.width });
  } else {
    const fsw = data.freezeTotalWidth();
    if (left < fsw && l >= fsw) {
      horizontalScrollbar.move({ left: l - 1 - fsw });
    }
  }
  // console.log('top:', top, ', height:', height, ', tof.height:', tableOffset.height);
  if (top + height > tableOffset.height) {
    verticalScrollbar.move({ top: t + height - tableOffset.height - 1 });
  } else {
    const fsh = data.freezeTotalHeight();
    if (top < fsh && t >= fsh) {
      verticalScrollbar.move({ top: t - 1 - fsh });
    }
  }
}

function selectorSet(multiple, ri, ci, indexesUpdated = true, moving = false) {
  if (ri === -1 && ci === -1) return;
  const {
    selector, data,
    contextMenu, toolbar,
  } = this;
  const nri = data.sortedRowMap && data.sortedRowMap.has(ri) ? data.sortedRowMap.get(ri) : ri;
  const cell = data.getCell(nri, ci);
  if (multiple) {
    selector.setEnd(ri, ci, moving);
    this.trigger('cells-selected', cell, selector.range);
  } else {
    // trigger click event
    selector.set(ri, ci, indexesUpdated);
    this.trigger('cell-selected', cell, ri, ci);
  }
  contextMenu.setMode((ri === -1 || ci === -1) ? 'row-col' : 'range');
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
  const { eri, eci } = selector.range;
  if (multiple) {
    [ri, ci] = selector.moveIndexes || selector.indexes || [0, 0];
  }
  // console.log('selector.move:', ri, ci);
  if (direction === 'left') {
    if (ci > 0) ci -= 1;
  } else if (direction === 'right') {
    if (!multiple && eci !== ci) ci = eci;
    if (ci < cols.len - 1) ci += 1;
  } else if (direction === 'up') {
    if (ri > 0) ri -= 1;
  } else if (direction === 'down') {
    if (!multiple && eri !== ri) ri = eri;
    if (ri < rows.len - 1) ri += 1;
  } else if (direction === 'row-first') {
    ci = 0;
  } else if (direction === 'row-last') {
    ci = cols.len - 1;
  } else if (direction === 'col-first') {
    ri = 0;
  } else if (direction === 'col-last') {
    ri = rows.len - 1;
  }
  if (multiple) {
    selector.moveIndexes = [ri, ci];
  }
  selectorSet.call(this, multiple, ri, ci);
  scrollbarMove.call(this);
}

// private methods
function overlayerMousemove(evt) {
  if (evt.buttons !== 0) return;
  if (evt.target && evt.target.className === `${cssPrefix}-resizer-hover`) return;
  const {
    rowResizer, colResizer, tableEl, data, overlayerEl,
  } = this;
  if (data.settings.mode === 'read') {
    rowResizer.hide();
    colResizer.hide();
    return;
  }
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
    cRect.width = cols.indexWidth;
    rowResizer.show(cRect, {
      width: tRect.width,
    });
    if (rows.isHide(cRect.ri - 1)) {
      rowResizer.showUnhide(cRect.ri);
    } else {
      rowResizer.hideUnhide();
    }
  } else {
    rowResizer.hide();
  }
  if (cRect.ri === -1 && cRect.ci >= 0) {
    cRect.height = rows.height;
    colResizer.show(cRect, {
      height: tRect.height,
    });
    if (cols.isHide(cRect.ci - 1)) {
      colResizer.showUnhide(cRect.ci);
    } else {
      colResizer.hideUnhide();
    }
  } else {
    colResizer.hide();
  }
}

function overlayerMousescroll(evt) {
  const { verticalScrollbar, horizontalScrollbar, data } = this;
  const { top } = verticalScrollbar.scroll();
  const { left } = horizontalScrollbar.scroll();

  const { rows, cols } = data;

  const { deltaY = 0, deltaX = 0 } = evt;
  const loopValue = (ii, maxLen, step, vFunc) => {
    let i = ii;
    while (i >= 0 && i < maxLen) {
      const v = vFunc(i);
      if (v > 0) return v;
      i += step;
    }
    return 0;
  };
  const moveY = (vertical) => {
    if (vertical > 0) {
      const ri = data.scroll.ri + 1;
      if (ri < rows.len) {
        const rh = loopValue(ri, rows.len, 1, i => rows.getHeight(i));
        if (rh > 0) {
          verticalScrollbar.move({ top: top + rh - 1 });
        }
      }
    } else {
      const ri = data.scroll.ri - 1;
      if (ri >= 0) {
        const rh = loopValue(ri, rows.len, -1, i => rows.getHeight(i));
        if (rh > 0 || ri === 0) {
          verticalScrollbar.move({ top: ri === 0 ? 0 : Math.max(0, top - rh) });
        }
      }
    }
  };

  const moveX = (horizontal) => {
    if (horizontal > 0) {
      const ci = data.scroll.ci + 1;
      if (ci < cols.len) {
        const cw = loopValue(ci, cols.len, 1, i => cols.getWidth(i));
        if (cw > 0) {
          horizontalScrollbar.move({ left: left + cw - 1 });
        }
      }
    } else {
      const ci = data.scroll.ci - 1;
      if (ci >= 0) {
        const cw = loopValue(ci, cols.len, -1, i => cols.getWidth(i));
        if (cw > 0 || ci === 0) {
          horizontalScrollbar.move({ left: ci === 0 ? 0 : Math.max(0, left - cw) });
        }
      }
    }
  };
  const tempY = Math.abs(deltaY);
  const tempX = Math.abs(deltaX);
  const temp = Math.max(tempY, tempX);
  if (typeof window !== 'undefined' && window.navigator && /Firefox/i.test(window.navigator.userAgent) && evt.detail) {
    moveY(evt.detail);
  }
  if (temp === 0) return;
  if (deltaX !== 0 && temp === tempX) moveX(deltaX);
  if (deltaY !== 0 && temp === tempY) moveY(deltaY);
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
  // console.log('erth:', erth);
  verticalScrollbar.set(height, data.rows.totalHeight() - erth);
}

function horizontalScrollbarSet() {
  const { data, horizontalScrollbar } = this;
  const { width } = this.getTableOffset();
  if (data) {
    horizontalScrollbar.set(width, data.cols.totalWidth());
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
  if (data.settings.mode === 'read') return;
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
  } else if (data.paste(what, msg => xtoast('Tip', msg))) {
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
      sortFilter.setOffset({ left, top: top + height + 2 });
      return;
    }
  }

  if (!evt.shiftKey) {
    if (isAutofillEl) {
      selector.showAutofill(ri, ci);
    } else {
      selectorSet.call(this, false, ri, ci);
    }

    // mouse move up
    if (typeof window !== 'undefined') {
      this._cancelMoveUp = mouseMoveUp(window, (e) => {
        const { offsetX: mx, offsetY: my } = getOverlayerOffset(overlayerEl, e);
        ({ ri, ci } = data.getCellRectByXY(mx, my));
        if (isAutofillEl) {
          selector.showAutofill(ri, ci);
        } else if (e.buttons === 1 && !e.shiftKey) {
          selectorSet.call(this, true, ri, ci, true, true);
        }
      }, () => {
        this._cancelMoveUp = null;
        if (isAutofillEl && selector.arange && data.settings.mode !== 'read') {
          if (data.autofill(selector.arange, 'all', msg => xtoast('Tip', msg))) {
            table.render();
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

  if (!isAutofillEl && evt.buttons === 1) {
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

function editorSet() {
  const { editor, data } = this;
  if (data.settings.mode === 'read') return;
  editorSetOffset.call(this);
  editor.setCell(data.getSelectedCell(), data.getSelectedValidator());
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

function rowResizerFinished(cRect, distance) {
  if (this.data.settings.mode === 'read') return;
  const { ri } = cRect;
  const { table, selector, data } = this;
  const { sri, eri } = selector.range;
  if (ri >= sri && ri <= eri) {
    for (let row = sri; row <= eri; row += 1) {
      data.rows.setHeight(row, distance);
    }
  } else {
    data.rows.setHeight(ri, distance);
  }

  table.render();
  selector.resetAreaOffset();
  verticalScrollbarSet.call(this);
  editorSetOffset.call(this);
}

function colResizerFinished(cRect, distance) {
  if (this.data.settings.mode === 'read') return;
  const { ci } = cRect;
  const { table, selector, data } = this;
  const { sci, eci } = selector.range;
  if (ci >= sci && ci <= eci) {
    for (let col = sci; col <= eci; col += 1) {
      data.cols.setWidth(col, distance);
    }
  } else {
    data.cols.setWidth(ci, distance);
  }

  table.render();
  selector.resetAreaOffset();
  horizontalScrollbarSet.call(this);
  editorSetOffset.call(this);
}

function dataSetCellText(text, state = 'finished') {
  if (this._isDestroyed) return;
  const { data, table } = this;
  if (data.settings.mode === 'read') return;
  const selectedCell = data.getSelectedCell();
  if (selectedCell && selectedCell.editable === false) return;
  data.setSelectedCellText(text, state);
  const { ri, ci } = data.selector;
  if (state === 'finished') {
    table.render();
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
    if (type === 'formula' && !data.selector.multiple()) {
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
        if (this.data.xyInSelectedRect(offsetX, offsetY)) {
          contextMenu.setPosition(offsetX, offsetY);
        } else {
          overlayerMousedown.call(this, evt);
          contextMenu.setPosition(offsetX, offsetY);
        }
        evt.stopPropagation();
      } else if (evt.detail === 2) {
        editorSet.call(this);
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
    dataSetCellText.call(this, v, 'input');
    editorSet.call(this);
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
  };
  // contextmenu
  contextMenu.itemClick = (type) => {
    if (this.data.settings.mode === 'read') return;
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
    this.focusing = overlayerEl.contains(evt.target);
  };
  this._onWindowPaste = (evt) => {
    if (!this.focusing || this.data.settings.mode === 'read') return;
    paste.call(this, 'all', evt);
    evt.preventDefault();
  };
  this._onWindowCopy = (evt) => {
    if (!this.focusing || this.data.settings.mode === 'read') return;
    copy.call(this, evt);
    evt.preventDefault();
  };

  // for selector
  this._onWindowKeydown = (evt) => {
    if (!this.focusing) return;
    const keyCode = evt.keyCode || evt.which;
    const {
      key, ctrlKey, shiftKey, metaKey, altKey, isComposing,
    } = evt;
    if (ctrlKey || metaKey) {
      switch (keyCode) {
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
      } else if (altKey || isComposing || evt.key === 'Process') {
        return;
      } else if ((keyCode >= 65 && keyCode <= 90)
        || (keyCode >= 48 && keyCode <= 57)
        || (keyCode >= 96 && keyCode <= 105)
        || evt.key === '='
      ) {
        dataSetCellText.call(this, evt.key, 'input');
        editorSet.call(this);
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
    this.rowResizer = new Resizer(false, data.rows.height);
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
    this.contextMenu = new ContextMenu(() => this.getRect(), !showContextmenu || data.settings.mode === 'read');
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
    this.editor.clear(true);
    this.contextMenu.hide();
    this.sortFilter.hide();
    this.modalValidation.hide();
    this.rowResizer.hide();
    this.colResizer.hide();
    // after
    this.data = data;
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
    this.data.setData(data);
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
    clearToasts();
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
