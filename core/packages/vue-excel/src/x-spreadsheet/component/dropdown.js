import { Element, h } from './element';
import { bindClickoutside, unbindClickoutside } from './event';
import { cssPrefix } from '../config';

export default class Dropdown extends Element {
  constructor(title, width, showArrow, placement, ...children) {
    super('div', `${cssPrefix}-dropdown ${placement}`);
    this.title = title;
    this.change = () => {};
    this._clickoutsideEl = null;
    if (typeof title === 'string') {
      this.title = h('div', `${cssPrefix}-dropdown-title`).child(title);
    } else if (showArrow) {
      this.title.addClass('arrow-left');
    }
    this.contentEl = h('div', `${cssPrefix}-dropdown-content`)
      .css('width', width)
      .hide();

    this.setContentChildren(...children);

    this.headerEl = h('div', `${cssPrefix}-dropdown-header`);
    this.headerEl.on('click', () => {
      if (this.contentEl.css('display') !== 'block') {
        this.show();
      } else {
        this.hide();
      }
    }).children(
      this.title,
      showArrow ? h('div', `${cssPrefix}-icon arrow-right`).child(
        h('div', `${cssPrefix}-icon-img arrow-down`),
      ) : '',
    );
    this.children(this.headerEl, this.contentEl);
  }

  setContentChildren(...children) {
    this.contentEl.html('');
    if (children.length > 0) {
      this.contentEl.children(...children);
    }
  }

  setTitle(title) {
    if (this.title && this.title.el) {
      this.title.el.textContent = title != null ? String(title) : '';
    }
    this.hide();
  }

  show() {
    const { contentEl } = this;
    contentEl.show();
    if (this._clickoutsideEl) {
      this._clickoutsideEl.active(false);
      unbindClickoutside(this._clickoutsideEl);
      this._clickoutsideEl = null;
    }
    if (this.el && this.el.parentNode) {
      const parentEl = this.parent();
      parentEl.active();
      this._clickoutsideEl = parentEl;
      bindClickoutside(parentEl, () => {
        this.hide();
      });
    }
  }

  hide() {
    this.contentEl.hide();
    if (this.el && this.el.parentNode) {
      const parentEl = this.parent();
      parentEl.active(false);
      unbindClickoutside(parentEl);
    }
    if (this._clickoutsideEl) {
      this._clickoutsideEl.active(false);
      unbindClickoutside(this._clickoutsideEl);
      this._clickoutsideEl = null;
    }
  }
}
