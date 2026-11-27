import { h } from './element';
import { cssPrefix } from '../config';

export default class Scrollbar {
  constructor(vertical) {
    this.vertical = vertical;
    this.moveFn = null;
    this._silent = false;
    this.el = h('div', `${cssPrefix}-scrollbar ${vertical ? 'vertical' : 'horizontal'}`)
      .child(this.contentEl = h('div', ''))
      .on('mousemove.stop', () => {})
      .on('scroll.stop', (evt) => {
        if (this._silent) return;
        const { scrollTop, scrollLeft } = evt.target;
        if (this.moveFn) {
          this.moveFn(this.vertical ? scrollTop : scrollLeft, evt);
        }
      });
  }

  move(v, silent = false) {
    if (silent) {
      this._silent = true;
      try {
        this.el.scroll(v);
      } finally {
        this._silent = false;
      }
    } else {
      this.el.scroll(v);
    }
    return this;
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
