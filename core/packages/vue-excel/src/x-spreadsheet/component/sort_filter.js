import { h } from './element';
import Button from './button';
import { bindClickoutside, unbindClickoutside } from './event';
import { cssPrefix } from '../config';
import { t } from '../locale/locale';

function buildMenu(clsName) {
  return h('div', `${cssPrefix}-item ${clsName}`);
}

function buildSortItem(it) {
  return buildMenu('state').child(t(`sort.${it}`))
    .on('click.stop', () => this.itemClick(it));
}

function buildFilterBody(items) {
  const { filterbEl, filterValues } = this;
  filterbEl.html('');
  const itemKeys = Object.keys(items);
  itemKeys.forEach((it, index) => {
    const cnt = items[it];
    const active = filterValues.includes(it) ? 'checked' : '';
    filterbEl.child(h('div', `${cssPrefix}-item state ${active}`)
      .on('click.stop', () => this.filterClick(index, it))
      .children(it === '' ? t('filter.empty') : it, h('div', 'label').child(`(${cnt})`)));
  });
}

function resetFilterHeader() {
  const { filterhEl, filterValues, values } = this;
  const total = Array.isArray(values) ? values.length : 0;
  filterhEl.el.textContent = `${filterValues.length} / ${total}`;
  filterhEl.checked(filterValues.length === total);
}

export default class SortFilter {
  constructor() {
    this.filterbEl = h('div', `${cssPrefix}-body`);
    this.filterhEl = h('div', `${cssPrefix}-header state`).on('click.stop', () => this.toggleAll());
    this.el = h('div', `${cssPrefix}-sort-filter`).children(
      this.sortAscEl = buildSortItem.call(this, 'asc'),
      this.sortDescEl = buildSortItem.call(this, 'desc'),
      buildMenu('divider'),
      h('div', `${cssPrefix}-filter`).children(
        this.filterhEl,
        this.filterbEl,
      ),
      h('div', `${cssPrefix}-buttons`).children(
        new Button('cancel').on('click', () => this.btnClick('cancel')),
        new Button('ok', 'primary').on('click', () => this.btnClick('ok')),
      ),
    ).hide();
    this.ci = null;
    this.sort = null;
    this.values = null;
    this.filterValues = [];
    this._outsideTimer = null;
  }

  btnClick(it) {
    if (it === 'ok') {
      const { ci, sort, filterValues } = this;
      if (this.ok) {
        this.ok(ci, sort, 'in', filterValues);
      }
    }
    this.hide();
  }

  itemClick(it) {
    this.sort = it;
    const { sortAscEl, sortDescEl } = this;
    sortAscEl.checked(it === 'asc');
    sortDescEl.checked(it === 'desc');
  }

  toggleAll() {
    const { filterbEl, filterValues, values } = this;
    const children = filterbEl.children();
    if (children.length === filterValues.length) {
      this.filterValues = [];
      children.forEach(i => h(i).checked(false));
    } else {
      this.filterValues = Array.from(values || []);
      children.forEach(i => h(i).checked(true));
    }
    resetFilterHeader.call(this);
  }

  filterClick(index, it) {
    const { filterbEl, filterValues } = this;
    const children = filterbEl.children();
    if (!children[index]) return;
    const checked = h(children[index]).toggle('checked');
    if (checked) {
      if (!filterValues.includes(it)) {
        filterValues.push(it);
      }
    } else {
      const idx = filterValues.findIndex(i => i === it);
      if (idx >= 0) {
        filterValues.splice(idx, 1);
      }
    }
    resetFilterHeader.call(this);
  }

  // v: autoFilter
  // items: {value: cnt}
  // sort { ci, order }
  set(ci, items, filter, sort) {
    this.ci = ci;
    const { sortAscEl, sortDescEl } = this;
    if (sort != null) {
      this.sort = sort.order;
      sortAscEl.checked(sort.asc());
      sortDescEl.checked(sort.desc());
    } else {
      this.sort = null;
      sortAscEl.checked(false);
      sortDescEl.checked(false);
    }
    this.values = Object.keys(items || {});
    if (filter && Array.isArray(filter.value)) {
      const valueSet = new Set(this.values);
      this.filterValues = filter.value.filter(val => valueSet.has(val));
    } else {
      this.filterValues = this.values.slice();
    }
    buildFilterBody.call(this, items || {}, filter);
    resetFilterHeader.call(this);
  }

  setOffset(v, view = null) {
    const offset = { ...v };
    if (typeof offset.left === 'number') {
      if (view && typeof view.width === 'number' && view.width > 0) {
        const boxW = (this.el.box && this.el.box().width) || 260;
        offset.left = Math.min(offset.left, Math.max(0, view.width - boxW));
      }
      offset.left = Math.max(0, offset.left);
    }
    if (typeof offset.top === 'number') {
      if (view && typeof view.height === 'number' && view.height > 0) {
        const boxH = (this.el.box && this.el.box().height) || 340;
        if (offset.top + boxH > view.height) {
          offset.top = Math.max(0, view.height - boxH);
        }
      }
      offset.top = Math.max(0, offset.top);
    }
    this.el.offset(offset).show();
    if (this._outsideTimer) {
      clearTimeout(this._outsideTimer);
    }
    this._outsideTimer = setTimeout(() => {
      this._outsideTimer = null;
      bindClickoutside(this.el, () => {
        this.hide();
      });
    }, 0);
  }

  show() {
    this.el.show();
  }

  hide() {
    if (this._outsideTimer) {
      clearTimeout(this._outsideTimer);
      this._outsideTimer = null;
    }
    this.el.hide();
    unbindClickoutside(this.el);
  }
}
