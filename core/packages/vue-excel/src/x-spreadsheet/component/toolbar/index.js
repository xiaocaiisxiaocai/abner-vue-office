import Align from './align';
import Valign from './valign';
import Autofilter from './autofilter';
import Bold from './bold';
import Italic from './italic';
import Strike from './strike';
import Underline from './underline';
import Border from './border';
import Clearformat from './clearformat';
import Paintformat from './paintformat';
import TextColor from './text_color';
import FillColor from './fill_color';
import FontSize from './font_size';
import Font from './font';
import Format from './format';
import Formula from './formula';
import Freeze from './freeze';
import Merge from './merge';
import Redo from './redo';
import Undo from './undo';
import Print from './print';
import Textwrap from './textwrap';
import More from './more';
import Item from './item';

import { h } from '../element';
import { cssPrefix } from '../../config';
import { bind, unbind } from '../event';
import { hideTooltip } from '../tooltip';

function buildDivider() {
  return h('div', `${cssPrefix}-toolbar-divider`);
}

function initBtns2() {
  this.btns2 = [];
  this.items.forEach((it) => {
    if (Array.isArray(it)) {
      it.forEach(({ el }) => {
        const rect = el.box();
        const { marginLeft, marginRight } = el.computedStyle();
        this.btns2.push([el, rect.width + (parseFloat(marginLeft) || 0) + (parseFloat(marginRight) || 0)]);
      });
    } else {
      const rect = it.box();
      const { marginLeft, marginRight } = it.computedStyle();
      this.btns2.push([it, rect.width + (parseFloat(marginLeft) || 0) + (parseFloat(marginRight) || 0)]);
    }
  });
}

function hideAllDropdowns() {
  [
    this.formatEl,
    this.fontEl,
    this.fontSizeEl,
    this.textColorEl,
    this.fillColorEl,
    this.borderEl,
    this.alignEl,
    this.valignEl,
    this.formulaEl,
    this.moreEl,
  ].forEach((it) => {
    if (it && it.dd && typeof it.dd.hide === 'function') {
      it.dd.hide();
    }
  });
}

function moreResize() {
  const {
    el, btns, moreEl,
  } = this;
  if (!this.btns2) return;
  hideTooltip(el.el);
  hideAllDropdowns.call(this);
  const { moreBtns, contentEl } = moreEl.dd;
  el.css('width', `${this.widthFn()}px`);
  const elBox = el.box();
  if (!elBox || elBox.width <= 0) return;

  if (this.btns2.length > 0 && this.btns2.every(([, w]) => w === 0)) {
    moreBtns.html('');
    btns.html('').children(...this.btns2.map(([it]) => it));
    initBtns2.call(this);
  }
  const { btns2 } = this;

  let sumWidth = 160;
  let sumWidth2 = 12;
  const list1 = [];
  const list2 = [];
  btns2.forEach(([it, w], index) => {
    sumWidth += w;
    if (index === btns2.length - 1 || sumWidth < elBox.width) {
      list1.push(it);
    } else {
      sumWidth2 += w;
      list2.push(it);
    }
  });
  btns.html('').children(...list1);
  moreBtns.html('').children(...list2);
  contentEl.css('width', `${sumWidth2}px`);
  if (list2.length > 0) {
    moreEl.show();
  } else {
    moreEl.hide();
  }
}

function genBtn(it) {
  const btn = new Item();
  btn.el.on('click', () => {
    if (this.data && this.data.settings && this.data.settings.mode === 'read') return;
    if (it.onClick) it.onClick(this.data.getData(), this.data);
  });
  btn.tip = it.tip || '';

  let { el } = it;

  if (it.icon) {
    el = h('img').attr('src', it.icon);
  }

  if (el) {
    const icon = h('div', `${cssPrefix}-icon`);
    icon.child(el);
    btn.el.child(icon);
  }

  return btn;
}

export default class Toolbar {
  constructor(data, widthFn, isHide = false) {
    this.data = data;
    this.change = () => {};
    this.widthFn = widthFn;
    this.isHide = isHide;
    const style = data.defaultStyle();
    this.items = [
      [
        this.undoEl = new Undo(),
        this.redoEl = new Redo(),
        new Print(),
        this.paintformatEl = new Paintformat(),
        this.clearformatEl = new Clearformat(),
      ],
      buildDivider(),
      [
        this.formatEl = new Format(),
      ],
      buildDivider(),
      [
        this.fontEl = new Font(),
        this.fontSizeEl = new FontSize(),
      ],
      buildDivider(),
      [
        this.boldEl = new Bold(),
        this.italicEl = new Italic(),
        this.underlineEl = new Underline(),
        this.strikeEl = new Strike(),
        this.textColorEl = new TextColor(style.color),
      ],
      buildDivider(),
      [
        this.fillColorEl = new FillColor(style.bgcolor),
        this.borderEl = new Border(),
        this.mergeEl = new Merge(),
      ],
      buildDivider(),
      [
        this.alignEl = new Align(style.align),
        this.valignEl = new Valign(style.valign),
        this.textwrapEl = new Textwrap(),
      ],
      buildDivider(),
      [
        this.freezeEl = new Freeze(),
        this.autofilterEl = new Autofilter(),
        this.formulaEl = new Formula(),
      ],
    ];

    const { extendToolbar = {} } = data.settings;

    if (extendToolbar.left && extendToolbar.left.length > 0) {
      this.items.unshift(buildDivider());
      const btns = extendToolbar.left.map(genBtn.bind(this));

      this.items.unshift(btns);
    }
    if (extendToolbar.right && extendToolbar.right.length > 0) {
      this.items.push(buildDivider());
      const btns = extendToolbar.right.map(genBtn.bind(this));
      this.items.push(btns);
    }

    this.items.push([this.moreEl = new More()]);
    if (this.moreEl && this.moreEl.dd) {
      this.moreEl.dd.childDropdowns = [
        this.formatEl && this.formatEl.dd,
        this.fontEl && this.fontEl.dd,
        this.fontSizeEl && this.fontSizeEl.dd,
        this.textColorEl && this.textColorEl.dd,
        this.fillColorEl && this.fillColorEl.dd,
        this.borderEl && this.borderEl.dd,
        this.alignEl && this.alignEl.dd,
        this.valignEl && this.valignEl.dd,
        this.formulaEl && this.formulaEl.dd,
      ].filter(Boolean);
    }

    this.el = h('div', `${cssPrefix}-toolbar`);
    this.btns = h('div', `${cssPrefix}-toolbar-btns`);

    this.items.forEach((it) => {
      if (Array.isArray(it)) {
        it.forEach((i) => {
          this.btns.child(i.el);
          i.change = (...args) => {
            this.change(...args);
          };
        });
      } else {
        this.btns.child(it.el);
      }
    });

    this.el.child(this.btns);
    if (isHide) {
      this.el.hide();
    } else {
      this.reset();
      this._resizeTimer = setTimeout(() => {
        this._resizeTimer = null;
        initBtns2.call(this);
        moreResize.call(this);
      }, 0);
      this._onWindowResize = () => {
        moreResize.call(this);
      };
      if (typeof window !== 'undefined') {
        bind(window, 'resize', this._onWindowResize);
      }
    }
  }

  destroy() {
    hideTooltip(this.el && this.el.el);
    if (this._resizeTimer) {
      clearTimeout(this._resizeTimer);
      this._resizeTimer = null;
    }
    if (this._onWindowResize) {
      if (typeof window !== 'undefined') {
        unbind(window, 'resize', this._onWindowResize);
      }
      this._onWindowResize = null;
    }
    hideAllDropdowns.call(this);
  }

  paintformatActive() {
    return this.paintformatEl.active();
  }

  paintformatToggle() {
    this.paintformatEl.toggle();
  }

  trigger(type) {
    const targetEl = this[`${type}El`];
    if (targetEl && typeof targetEl.click === 'function') {
      targetEl.click();
    }
  }

  resetData(data) {
    this.data = data;
    hideAllDropdowns.call(this);
    this.reset();
  }

  reset() {
    const { data } = this;
    const style = data.defaultStyle ? data.getSelectedCellStyle() : { font: {} };
    const font = style.font || {};
    this.boldEl.setState(font.bold);
    this.italicEl.setState(font.italic);
    this.underlineEl.setState(style.underline);
    this.strikeEl.setState(style.strike);
    if (this.isHide) return;
    // console.log('canUndo:', data.canUndo());
    this.undoEl.setState(!data.canUndo());
    this.redoEl.setState(!data.canRedo());
    this.mergeEl.setState(data.canUnmerge(), !data.selector.multiple());
    this.autofilterEl.setState(!data.canAutofilter());
    // this.mergeEl.disabled();
    // console.log('selectedCell:', style, cell);
    const { format } = style;
    this.formatEl.setState(format);
    this.fontEl.setState(font.name);
    this.fontSizeEl.setState(font.size);
    this.textColorEl.setState(style.color);
    this.fillColorEl.setState(style.bgcolor);
    this.alignEl.setState(style.align);
    this.valignEl.setState(style.valign);
    this.textwrapEl.setState(style.textwrap);
    // console.log('freeze is Active:', data.freezeIsActive());
    this.freezeEl.setState(data.freezeIsActive());
  }
}
