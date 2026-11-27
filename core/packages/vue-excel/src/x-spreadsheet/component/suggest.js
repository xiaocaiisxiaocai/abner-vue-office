import { h } from './element';
import { bindClickoutside, unbindClickoutside } from './event';
import { cssPrefix } from '../config';

function inputMovePrev(evt) {
  evt.stopPropagation();
  const { filterItems } = this;
  if (filterItems.length <= 0) return;
  evt.preventDefault();
  if (this.itemIndex >= 0 && this.itemIndex < filterItems.length) {
    filterItems[this.itemIndex].toggle();
  }
  this.itemIndex -= 1;
  if (this.itemIndex < 0 || this.itemIndex >= filterItems.length) {
    this.itemIndex = filterItems.length - 1;
  }
  filterItems[this.itemIndex].toggle();
}

function inputMoveNext(evt) {
  evt.stopPropagation();
  const { filterItems } = this;
  if (filterItems.length <= 0) return;
  evt.preventDefault();
  if (this.itemIndex >= 0 && this.itemIndex < filterItems.length) {
    filterItems[this.itemIndex].toggle();
  }
  this.itemIndex += 1;
  if (this.itemIndex < 0 || this.itemIndex > filterItems.length - 1) {
    this.itemIndex = 0;
  }
  filterItems[this.itemIndex].toggle();
}

function inputEnter(evt) {
  if (evt.altKey) return;
  evt.preventDefault();
  const { filterItems } = this;
  if (filterItems.length <= 0) return;
  evt.stopPropagation();
  if (this.itemIndex < 0 || this.itemIndex >= filterItems.length) {
    this.itemIndex = 0;
  }
  filterItems[this.itemIndex].el.click();
  this.hide();
}

function inputKeydownHandler(evt) {
  if (evt.isComposing || evt.keyCode === 229 || evt.key === 'Process') {
    return;
  }
  const { keyCode } = evt;
  if (evt.ctrlKey) {
    evt.stopPropagation();
  }
  switch (keyCode) {
    case 27: // esc
      this.hide();
      break;
    case 37: // left
      evt.stopPropagation();
      break;
    case 38: // up
      inputMovePrev.call(this, evt);
      break;
    case 39: // right
      evt.stopPropagation();
      break;
    case 40: // down
      inputMoveNext.call(this, evt);
      break;
    case 13: // enter
      inputEnter.call(this, evt);
      break;
    case 9:
      inputEnter.call(this, evt);
      break;
    default:
      evt.stopPropagation();
      break;
  }
}

export default class Suggest {
  constructor(items, itemClick, width = '200px') {
    this.filterItems = [];
    this.items = items;
    this.el = h('div', `${cssPrefix}-suggest`).css('width', width).hide();
    this.itemClick = itemClick;
    this.itemIndex = -1;
    this._clickoutsideEl = null;
  }

  setOffset(v) {
    this.el.cssRemoveKeys('top', 'bottom')
      .offset(v);
  }

  hide() {
    const { el } = this;
    this.filterItems = [];
    this.itemIndex = -1;
    el.hide();
    if (el && el.el && el.el.parentNode) {
      unbindClickoutside(el.parent());
    }
    if (this._clickoutsideEl) {
      unbindClickoutside(this._clickoutsideEl);
      this._clickoutsideEl = null;
    }
  }

  setItems(items) {
    this.items = items;
  }

  search(word) {
    this.itemIndex = -1;
    let items = Array.isArray(this.items) ? this.items : [];
    if (!/^\s*$/.test(word)) {
      const upperWord = String(word).toUpperCase();
      items = items.filter((it) => {
        const searchKey = (it && typeof it === 'object' && it.key !== undefined) ? it.key : it;
        return String(searchKey).toUpperCase().startsWith(upperWord);
      });
    }
    items = items.map((it) => {
      let title = it && typeof it === 'object' ? it.title : it;
      if (title !== undefined) {
        if (typeof title === 'function') {
          title = title();
        }
      } else {
        title = (it && typeof it === 'object' && it.key !== undefined) ? it.key : '';
      }
      const item = h('div', `${cssPrefix}-item`)
        .child(title != null ? String(title) : '')
        .on('click.stop', () => {
          this.itemClick(it);
          this.hide();
        });
      if (it && it.label !== undefined && it.label !== null && it.label !== '') {
        item.child(h('div', 'label').child(String(it.label)));
      }
      return item;
    });
    this.filterItems = items;
    if (items.length <= 0) {
      this.hide();
      return;
    }
    const { el } = this;
    el.html('').children(...items).show();
    if (el && el.el && el.el.parentNode) {
      const parentEl = el.parent();
      this._clickoutsideEl = parentEl;
      bindClickoutside(parentEl, () => { this.hide(); });
    }
  }

  bindInputEvents(input) {
    input.on('keydown', evt => inputKeydownHandler.call(this, evt));
  }
}
