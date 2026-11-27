import { h } from './element';
import { cssPrefix } from '../config';
import { t } from '../locale/locale';

const patterns = {
  number: /^-?\d+(\.\d+)?$/,
  date: /^\d{4}-\d{1,2}-\d{1,2}$/,
};

// rule: { required: false, type, pattern: // }
export default class FormField {
  constructor(input, rule, label, labelWidth) {
    this.label = '';
    this.rule = rule;
    if (label) {
      this.label = h('label', 'label').css('width', `${labelWidth}px`).child(String(label));
    }
    this.tip = h('div', 'tip').hide();
    this.input = input;
    this.input.vchange = () => this.validate();
    this.el = h('div', `${cssPrefix}-form-field`)
      .children(this.label, input.el, this.tip);
  }

  isShow() {
    return this.el.css('display') !== 'none';
  }

  show() {
    this.el.show();
  }

  hide() {
    this.el.hide();
    return this;
  }

  val(v) {
    return this.input.val(v);
  }

  hint(hint) {
    this.input.hint(hint);
  }

  clearError() {
    this.el.removeClass('error');
    this.tip.el.textContent = '';
    this.tip.hide();
  }

  validate() {
    const {
      input, rule, tip, el,
    } = this;
    const rawVal = input.val();
    const v = rawVal == null ? '' : String(rawVal);
    if (rule.required) {
      if (/^\s*$/.test(v)) {
        tip.el.textContent = t('validation.required');
        tip.show();
        el.addClass('error');
        return false;
      }
    }
    if (!rule.required && v === '') {
      this.clearError();
      return true;
    }
    if (rule.type || rule.pattern) {
      const pattern = rule.pattern || patterns[rule.type];
      if (pattern && !pattern.test(v)) {
        tip.el.textContent = t('validation.notMatch');
        tip.show();
        el.addClass('error');
        return false;
      }
      if (!rule.pattern && rule.type === 'date') {
        const m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        const y = m ? Number(m[1]) : NaN;
        const mo = m ? Number(m[2]) : NaN;
        const d = m ? Number(m[3]) : NaN;
        const parsed = new Date(y, mo - 1, d);
        if (!m || parsed.getFullYear() !== y || parsed.getMonth() !== mo - 1 || parsed.getDate() !== d) {
          tip.el.textContent = t('validation.notMatch');
          tip.show();
          el.addClass('error');
          return false;
        }
      }
    }
    this.clearError();
    return true;
  }
}
