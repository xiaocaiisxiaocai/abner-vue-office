import { h } from './element';
import { cssPrefix } from '../config';

export default class Scrollbar {
  constructor(vertical) {
    this.vertical = vertical;
    this.moveFn = null;
    this._silent = false;
    this._silentPos = null;
    this._silentTimer = null;
    this.el = h('div', `${cssPrefix}-scrollbar ${vertical ? 'vertical' : 'horizontal'}`)
      .child(this.contentEl = h('div', ''))
      .on('mousemove.stop', () => {})
      .on('scroll.stop', (evt) => {
        if (this._silent) return;
        const { scrollTop, scrollLeft } = evt.target;
        const pos = this.vertical ? scrollTop : scrollLeft;
        if (this._silentPos !== null) {
          const expected = this._silentPos;
          this._silentPos = null;
          if (this._silentTimer) {
            clearTimeout(this._silentTimer);
            this._silentTimer = null;
          }
          if (pos === expected) return;
        }
        if (this.moveFn) {
          this.moveFn(pos, evt);
        }
      });
  }

  move(v, silent = false) {
    const posKey = this.vertical ? 'top' : 'left';
    const scrollProp = this.vertical ? 'scrollTop' : 'scrollLeft';
    if (silent) {
      if (this._silentTimer) {
        clearTimeout(this._silentTimer);
        this._silentTimer = null;
      }
      const prevPos = this.el && this.el.el ? this.el.el[scrollProp] : undefined;
      this._silent = true;
      try {
        this.el.scroll(v);
      } finally {
        this._silent = false;
      }
      const nextPos = this.el && this.el.el ? this.el.el[scrollProp] : undefined;
      if (v && v[posKey] !== undefined && nextPos !== undefined && nextPos !== prevPos) {
        this._silentPos = nextPos;
        this._silentTimer = setTimeout(() => {
          this._silentPos = null;
          this._silentTimer = null;
        }, 50);
      } else {
        this._silentPos = null;
      }
    } else {
      this._silentPos = null;
      if (this._silentTimer) {
        clearTimeout(this._silentTimer);
        this._silentTimer = null;
      }
      this.el.scroll(v);
    }
    return this;
  }

  destroy() {
    this._silentPos = null;
    if (this._silentTimer) {
      clearTimeout(this._silentTimer);
      this._silentTimer = null;
    }
  }

  scroll() {
    return this.el.scroll();
  }

  set(distance, contentDistance) {
    const d = distance - 1;
    if (contentDistance > d) {
      const cssKey = this.vertical ? 'height' : 'width';
      this.el.css(cssKey, `${Math.max(0, d - 15)}px`).show();
      this.contentEl
        .css(this.vertical ? 'width' : 'height', '1px')
        .css(cssKey, `${contentDistance}px`);
    } else {
      this.el.hide();
    }
    return this;
  }
}
