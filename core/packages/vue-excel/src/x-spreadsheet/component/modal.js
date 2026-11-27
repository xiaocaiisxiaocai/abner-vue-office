import { h } from './element';
import Icon from './icon';
import { cssPrefix } from '../config';
import { bind, unbind } from './event';

export default class Modal {
  constructor(title, content, width = '600px') {
    this.title = title;
    this.dimmer = null;
    this._onKeydownEsc = null;
    this.el = h('div', `${cssPrefix}-modal`).css('width', width).children(
      h('div', `${cssPrefix}-modal-header`).children(
        new Icon('close').on('click.stop', () => this.hide()),
        this.title,
      ),
      h('div', `${cssPrefix}-modal-content`).children(...content),
    ).hide();
  }

  show() {
    if (typeof document === 'undefined' || !document.body) {
      return;
    }
    if (this.dimmer && this.dimmer.el && this.dimmer.el.parentNode) {
      this.dimmer.el.parentNode.removeChild(this.dimmer.el);
      this.dimmer = null;
    }
    if (typeof window !== 'undefined' && this._onKeydownEsc) {
      unbind(window, 'keydown', this._onKeydownEsc);
      this._onKeydownEsc = null;
    }
    // dimmer
    this.dimmer = h('div', `${cssPrefix}-dimmer active`);
    document.body.appendChild(this.dimmer.el);
    const { width, height } = this.el.show().box();
    const docEl = document.documentElement || {};
    const clientHeight = docEl.clientHeight || 0;
    const clientWidth = docEl.clientWidth || 0;
    this.el.offset({
      left: Math.max(0, (clientWidth - width) / 2),
      top: Math.max(0, (clientHeight - height) / 3),
    });
    if (typeof window !== 'undefined') {
      this._onKeydownEsc = (evt) => {
        if (evt.keyCode === 27) {
          this.hide();
        }
      };
      bind(window, 'keydown', this._onKeydownEsc);
    }
  }

  hide() {
    this.el.hide();
    if (this.dimmer && this.dimmer.el && this.dimmer.el.parentNode) {
      this.dimmer.el.parentNode.removeChild(this.dimmer.el);
    }
    this.dimmer = null;
    if (typeof window !== 'undefined' && this._onKeydownEsc) {
      unbind(window, 'keydown', this._onKeydownEsc);
      this._onKeydownEsc = null;
    }
  }
}
