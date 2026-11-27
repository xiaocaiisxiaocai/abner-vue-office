import { h } from './element';
import Suggest from './suggest';
import { cssPrefix } from '../config';

export default class FormSelect {
  constructor(key, items, width, getTitle = it => it, change = () => {}) {
    this.key = key;
    this.getTitle = getTitle;
    this.vchange = () => {};
    this.el = h('div', `${cssPrefix}-form-select`);
    this.suggest = new Suggest(items.map(it => ({ key: it, title: this.getTitle(it) })), (it) => {
      this.itemClick(it.key);
      change(it.key);
      this.vchange(it.key);
    }, width);
    this.itemEl = h('div', 'input-text');
    const initTitle = this.getTitle(key);
    this.itemEl.el.textContent = initTitle != null ? String(initTitle) : '';
    this.el.children(
      this.itemEl,
      this.suggest.el,
    ).on('click', () => this.show());
  }

  show() {
    this.suggest.search('');
  }

  itemClick(it) {
    this.key = it;
    const title = this.getTitle(it);
    this.itemEl.el.textContent = title != null ? String(title) : '';
  }

  val(v) {
    if (v !== undefined) {
      this.key = v;
      const title = this.getTitle(v);
      this.itemEl.el.textContent = title != null ? String(title) : '';
      return this;
    }
    return this.key;
  }
}
