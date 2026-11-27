import { h } from './element';
import { bindClickoutside, unbindClickoutside } from './event';
import { cssPrefix } from '../config';
import Icon from './icon';
import FormInput from './form_input';
import Dropdown from './dropdown';
// Record: temp not used
// import { xtoast } from './message';
import { tf } from '../locale/locale';

class DropdownMore extends Dropdown {
  constructor(click) {
    const icon = new Icon('ellipsis');
    super(icon, 'auto', false, 'top-left');
    this.contentClick = click;
  }

  reset(items) {
    const eles = items.map((it, i) => h('div', `${cssPrefix}-item`)
      .css('width', '150px')
      .css('font-weight', 'normal')
      .on('click', () => {
        this.contentClick(i);
        this.hide();
      })
      .child(it));
    this.setContentChildren(...eles);
  }

  setTitle() {}
}

const menuItems = [
  { key: 'delete', title: tf('contextmenu.deleteSheet') },
];

function buildMenuItem(item) {
  return h('div', `${cssPrefix}-item`)
    .child(item.title())
    .on('click', () => {
      this.itemClick(item.key);
      this.hide();
    });
}

function buildMenu() {
  return menuItems.map(it => buildMenuItem.call(this, it));
}

class ContextMenu {
  constructor() {
    this.el = h('div', `${cssPrefix}-contextmenu`)
      .css('width', '160px')
      .children(...buildMenu.call(this))
      .hide();
    this.itemClick = () => {};
  }

  hide() {
    const { el } = this;
    el.hide();
    unbindClickoutside(el);
  }

  setOffset(offset) {
    const { el } = this;
    el.offset(offset);
    el.show();
    bindClickoutside(el);
  }
}

export default class Bottombar {
  constructor(addFunc = () => {},
    swapFunc = () => {},
    deleteFunc = () => {},
    updateFunc = () => {},
    options = {}) {
    this.swapFunc = swapFunc;
    this.updateFunc = updateFunc;
    this.options = options || {};
    this.dataNames = [];
    this.activeEl = null;
    this.deleteEl = null;
    this.items = [];
    this._cancelRename = null;
    this.moreEl = new DropdownMore((i) => {
      this.clickSwap2(this.items[i]);
    });
    this.contextMenu = new ContextMenu();
    this.contextMenu.itemClick = deleteFunc;
    this.controlsEl = h('div', `${cssPrefix}-bottombar-controls`).children(
      new Icon('add').on('click', () => {
        if (this.options && this.options.mode === 'read') return;
        addFunc();
      }),
      h('span', '').child(this.moreEl),
    );
    this.el = h('div', `${cssPrefix}-bottombar`).children(
      this.contextMenu.el,
      this.controlsEl,
      this.menuEl = h('ul', `${cssPrefix}-menu`),
    );
  }

  addItem(name, active, options = this.options) {
    const resolvedOpts = options || this.options || {};
    this.dataNames.push(name);
    const item = h('li', active ? 'active' : '').child(name);
    item.on('click', () => {
      this.clickSwap2(item);
    }).on('contextmenu', () => {
      if (resolvedOpts.mode === 'read') return;
      const { offsetLeft, offsetHeight } = item.el;
      const scrollLeft = (this.menuEl && this.menuEl.el && this.menuEl.el.scrollLeft) || 0;
      const left = Math.max(0, offsetLeft - scrollLeft);
      this.contextMenu.setOffset({ left, bottom: offsetHeight + 1 });
      this.deleteEl = item;
    }).on('dblclick', () => {
      if (resolvedOpts.mode === 'read') return;
      if (item.el && typeof item.el.querySelector === 'function' && item.el.querySelector('input')) {
        return;
      }
      const idx = this.items.indexOf(item);
      if (idx < 0) return;
      const v = this.dataNames[idx];
      const input = new FormInput('auto', '');
      input.val(v);
      let committed = false;
      this._cancelRename = () => {
        committed = true;
        input.clearTimer();
        const nindex = this.items.indexOf(item);
        if (nindex >= 0) {
          item.html('').child(this.dataNames[nindex]);
        }
      };
      const finishRename = (newVal, cancelled = false) => {
        if (committed) return;
        committed = true;
        this._cancelRename = null;
        input.clearTimer();
        const nindex = this.items.indexOf(item);
        if (nindex < 0) return;
        if (cancelled) {
          item.html('').child(this.dataNames[nindex]);
          return;
        }
        const trimmed = newVal != null ? String(newVal) : '';
        const finalVal = /^\s*$/.test(trimmed) ? this.dataNames[nindex] : trimmed;
        this.renameItem(nindex, finalVal, finalVal !== this.dataNames[nindex]);
      };
      input.input
        .on('click.stop', () => {})
        .on('keydown', (evt) => {
          if (evt.isComposing || evt.keyCode === 229 || evt.key === 'Process') {
            return;
          }
          if (evt.keyCode === 13) {
            evt.stopPropagation();
            finishRename(evt.target.value, false);
          } else if (evt.keyCode === 27) {
            evt.stopPropagation();
            finishRename(v, true);
          }
        })
        .on('blur', ({ target }) => {
          finishRename(target.value, false);
        });
      item.html('').child(input.el);
      input.focus();
    });
    if (active) {
      this.clickSwap(item);
    }
    this.items.push(item);
    this.menuEl.child(item);
    this.moreEl.reset(this.dataNames);
  }

  renameItem(index, value, notify = true) {
    if (index < 0 || index >= this.items.length) return;
    this.dataNames.splice(index, 1, value);
    this.moreEl.reset(this.dataNames);
    this.items[index].html('').child(value);
    if (notify) {
      this.updateFunc(index, value);
    }
  }

  clear() {
    if (typeof this._cancelRename === 'function') {
      this._cancelRename();
      this._cancelRename = null;
    }
    if (this.contextMenu) {
      this.contextMenu.hide();
    }
    if (this.moreEl) {
      this.moreEl.hide();
    }
    const oldItems = this.items;
    this.items = [];
    this.dataNames = [];
    this.activeEl = null;
    this.deleteEl = null;
    oldItems.forEach((it) => {
      this.menuEl.removeChild(it.el);
    });
    this.moreEl.reset(this.dataNames);
  }

  destroy() {
    this.clear();
  }

  deleteItem() {
    if (typeof this._cancelRename === 'function') {
      this._cancelRename();
      this._cancelRename = null;
    }
    const { activeEl, deleteEl } = this;
    if (!deleteEl) return [-1];
    if (this.items.length > 1) {
      const index = this.items.findIndex(it => it === deleteEl);
      if (index < 0) return [-1];
      this.items.splice(index, 1);
      this.dataNames.splice(index, 1);
      this.menuEl.removeChild(deleteEl.el);
      this.deleteEl = null;
      this.moreEl.reset(this.dataNames);
      if (activeEl === deleteEl) {
        const [f] = this.items;
        this.activeEl = f;
        this.activeEl.toggle();
        return [index, 0];
      }
      return [index, -1];
    }
    return [-1];
  }

  clickSwap2(item) {
    const index = this.items.findIndex(it => it === item);
    if (index < 0) return;
    this.clickSwap(item);
    this.activeEl.toggle();
    this.swapFunc(index);
  }

  clickSwap(item) {
    if (this.activeEl !== null) {
      this.activeEl.toggle();
    }
    this.activeEl = item;
  }
}
