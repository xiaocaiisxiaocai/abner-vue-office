import { h } from './element';
import { cssPrefix } from '../config';

export default class FormInput {
  constructor(width, hint) {
    this.vchange = () => {};
    this._focusTimer = null;
    this.el = h('div', `${cssPrefix}-form-input`);
    this.input = h('input', '').css('width', width)
      .on('input', evt => this.vchange(evt))
      .attr('placeholder', hint);
    this.el.child(this.input);
  }

  focus() {
    if (this._focusTimer) {
      clearTimeout(this._focusTimer);
    }
    this._focusTimer = setTimeout(() => {
      this._focusTimer = null;
      if (this.input && this.input.el && this.input.el.isConnected !== false) {
        this.input.el.focus();
      }
    }, 10);
  }

  clearTimer() {
    if (this._focusTimer) {
      clearTimeout(this._focusTimer);
      this._focusTimer = null;
    }
  }

  hint(v) {
    this.input.attr('placeholder', v);
  }

  val(v) {
    return this.input.val(v);
  }
}
