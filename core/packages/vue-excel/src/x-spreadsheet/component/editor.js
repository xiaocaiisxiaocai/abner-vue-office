import { h } from './element';
import Suggest from './suggest';
import Datepicker from './datepicker';
import { cssPrefix } from '../config';

function resetTextareaSize() {
  const { inputText } = this;
  if (inputText && !/^\s*$/.test(inputText)) {
    const {
      textlineEl, textEl, areaOffset,
    } = this;
    if (!areaOffset) return;
    const txts = inputText.split('\n');
    const maxTxtSize = Math.max(...txts.map(it => it.length));
    const tlOffset = textlineEl.offset();
    const fontWidth = tlOffset.width / inputText.length;
    const tlineWidth = (maxTxtSize + 1) * fontWidth + 5;
    const rawMaxWidth = this.viewFn().width - areaOffset.left - fontWidth;
    const maxWidth = Math.max(areaOffset.width || 1, rawMaxWidth, 1);
    let h1 = txts.length;
    if (tlineWidth > areaOffset.width) {
      let twidth = tlineWidth;
      if (tlineWidth > maxWidth) {
        twidth = maxWidth;
        h1 += parseInt(tlineWidth / maxWidth, 10);
        h1 += (tlineWidth % maxWidth) > 0 ? 1 : 0;
      }
      textEl.css('width', `${twidth}px`);
    }
    h1 *= this.rowHeight;
    if (h1 > areaOffset.height) {
      textEl.css('height', `${h1}px`);
    }
  }
}

function insertText({ target }, itxt) {
  const { value = '', selectionStart, selectionEnd } = target;
  const start = typeof selectionStart === 'number' ? selectionStart : value.length;
  const end = typeof selectionEnd === 'number' ? selectionEnd : start;
  const ntxt = `${value.slice(0, start)}${itxt}${value.slice(end)}`;
  target.value = ntxt;
  target.setSelectionRange(start + itxt.length, start + itxt.length);

  this.inputText = ntxt;
  this.textlineEl.el.textContent = ntxt;
  resetTextareaSize.call(this);
  this.change('input', ntxt);
}

function keydownEventHandler(evt) {
  const { keyCode, altKey } = evt;
  if (keyCode !== 13 && keyCode !== 9) evt.stopPropagation();
  if (keyCode === 27) {
    evt.preventDefault();
    evt.stopPropagation();
    this.clear(true);
    return;
  }
  if (keyCode === 13 && altKey) {
    evt.preventDefault();
    insertText.call(this, evt, '\n');
    evt.stopPropagation();
    return;
  }
  if (keyCode === 13 && !altKey) evt.preventDefault();
}

function inputEventHandler(evt) {
  const v = evt.target.value;
  const { suggest, textlineEl, validator } = this;
  const { cell } = this;
  if (cell !== null) {
    if (('editable' in cell && cell.editable === true) || (cell.editable === undefined)) {
      this.inputText = v;
      if (validator) {
        if (validator.type === 'list') {
          suggest.search(v);
        } else {
          suggest.hide();
        }
      } else {
        const start = v.lastIndexOf('=');
        if (start !== -1) {
          suggest.search(v.substring(start + 1));
        } else {
          suggest.hide();
        }
      }
      textlineEl.el.textContent = v;
      resetTextareaSize.call(this);
      this.change('input', v);
    } else {
      evt.target.value = (cell && cell.text != null) ? String(cell.text) : '';
    }
  } else {
    this.inputText = v;
    if (validator) {
      if (validator.type === 'list') {
        suggest.search(v);
      } else {
        suggest.hide();
      }
    } else {
      const start = v.lastIndexOf('=');
      if (start !== -1) {
        suggest.search(v.substring(start + 1));
      } else {
        suggest.hide();
      }
    }
    textlineEl.el.textContent = v;
    resetTextareaSize.call(this);
    this.change('input', v);
  }
}

function setTextareaRange(position) {
  const { el } = this.textEl;
  if (this._focusTimer) {
    clearTimeout(this._focusTimer);
  }
  this._focusTimer = setTimeout(() => {
    this._focusTimer = null;
    if (!this._editing || (el && el.isConnected === false)) return;
    el.focus();
    el.setSelectionRange(position, position);
  }, 0);
}

function setText(text, position) {
  const { textEl, textlineEl } = this;
  textEl.el.blur();

  textEl.val(text);
  textlineEl.el.textContent = text;
  setTextareaRange.call(this, position);
}

function suggestItemClick(it) {
  const { inputText, validator } = this;
  let position = 0;
  if (validator && validator.type === 'list') {
    this.inputText = it != null ? String(it) : '';
    position = this.inputText.length;
  } else {
    const start = inputText.lastIndexOf('=');
    const sit = inputText.substring(0, start + 1);
    let eit = inputText.substring(start + 1);
    if (eit.indexOf(')') !== -1) {
      eit = eit.substring(eit.indexOf(')'));
    } else {
      eit = '';
    }
    const fnKey = it && it.key !== undefined ? it.key : String(it);
    this.inputText = `${sit + fnKey}(`;
    position = this.inputText.length;
    this.inputText += `)${eit}`;
  }
  setText.call(this, this.inputText, position);
  resetTextareaSize.call(this);
  this.change('input', this.inputText);
}

function resetSuggestItems() {
  this.suggest.setItems(this.formulas);
}

function dateFormat(d) {
  let month = d.getMonth() + 1;
  let date = d.getDate();
  if (month < 10) month = `0${month}`;
  if (date < 10) date = `0${date}`;
  return `${d.getFullYear()}-${month}-${date}`;
}

export default class Editor {
  constructor(formulas, viewFn, rowHeight) {
    this.viewFn = viewFn;
    this.rowHeight = rowHeight;
    this.formulas = formulas;
    this._focusTimer = null;
    this.suggest = new Suggest(formulas, (it) => {
      suggestItemClick.call(this, it);
    });
    this.datepicker = new Datepicker();
    this.datepicker.change((d) => {
      this.setText(dateFormat(d));
      this.clear();
    });
    this.areaEl = h('div', `${cssPrefix}-editor-area`)
      .children(
        this.textEl = h('textarea', '')
          .on('input', evt => inputEventHandler.call(this, evt))
          .on('paste.stop', () => {})
          .on('copy.stop', () => {})
          .on('cut.stop', () => {})
          .on('keydown', evt => keydownEventHandler.call(this, evt)),
        this.textlineEl = h('div', 'textline'),
        this.suggest.el,
        this.datepicker.el,
      )
      .on('mousemove.stop', () => {})
      .on('mousedown.stop', () => {});
    this.el = h('div', `${cssPrefix}-editor`)
      .child(this.areaEl).hide();
    this.suggest.bindInputEvents(this.textEl);

    this.areaOffset = null;
    this.freeze = { w: 0, h: 0 };
    this.cell = null;
    this.inputText = '';
    this._initialText = '';
    this._editing = false;
    this.change = () => {};
  }

  setFreezeLengths(width, height) {
    this.freeze.w = width;
    this.freeze.h = height;
  }

  clear(silent = false) {
    if (this._focusTimer) {
      clearTimeout(this._focusTimer);
      this._focusTimer = null;
    }
    if (!silent && this._editing && this.inputText !== this._initialText) {
      this.change('finished', this.inputText);
    }
    this._editing = false;
    this.cell = null;
    this.areaOffset = null;
    this.inputText = '';
    this._initialText = '';
    this.el.hide();
    this.textEl.val('');
    this.textlineEl.el.textContent = '';
    this.suggest.hide();
    resetSuggestItems.call(this);
    this.datepicker.hide();
  }

  setOffset(offset, suggestPosition = 'top') {
    const {
      textEl, areaEl, suggest, freeze, el,
    } = this;
    if (offset) {
      this.areaOffset = offset;
      const {
        left, top, width, height, l, t,
      } = offset;
      const elOffset = { left: 0, top: 0 };
      if (freeze.w > l && freeze.h > t) {
        // top-left frozen pane
      } else if (freeze.w <= l && freeze.h <= t) {
        elOffset.left = freeze.w;
        elOffset.top = freeze.h;
      } else if (freeze.w > l) {
        elOffset.top = freeze.h;
      } else if (freeze.h > t) {
        elOffset.left = freeze.w;
      }
      el.offset(elOffset);
      areaEl.offset({ left: left - elOffset.left - 0.8, top: top - elOffset.top - 0.8 });
      textEl.offset({ width: width - 9 + 0.8, height: height - 3 + 0.8 });
      const sOffset = { left: 0 };
      sOffset[suggestPosition] = height;
      suggest.setOffset(sOffset);
      suggest.hide();
    }
  }

  setCell(cell, validator) {
    if (cell && cell.editable === false) return;

    const { el, datepicker, suggest } = this;
    datepicker.hide();
    el.show();
    this._editing = true;
    this.cell = cell;
    const text = (cell && cell.text != null) ? String(cell.text) : '';
    this._initialText = text;
    this.setText(text);

    this.validator = validator;
    if (validator) {
      const { type } = validator;
      if (type === 'date') {
        datepicker.show();
        if (!/^\s*$/.test(text)) {
          datepicker.setValue(text);
        } else {
          datepicker.setValue(new Date());
        }
      }
      if (type === 'list') {
        suggest.setItems(validator.values());
        suggest.search('');
      }
    }
  }

  setText(text) {
    const strText = text != null ? String(text) : '';
    this.inputText = strText;
    setText.call(this, strText, strText.length);
    resetTextareaSize.call(this);
  }
}
