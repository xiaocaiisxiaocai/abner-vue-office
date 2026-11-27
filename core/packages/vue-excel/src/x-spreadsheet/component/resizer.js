import { h } from './element';
import { mouseMoveUp } from './event';
import { cssPrefix } from '../config';

export default class Resizer {
  constructor(vertical = false, minDistance) {
    this.moving = false;
    this.vertical = vertical;
    this._cancelMove = null;
    this.el = h('div', `${cssPrefix}-resizer ${vertical ? 'vertical' : 'horizontal'}`).children(
      this.unhideHoverEl = h('div', `${cssPrefix}-resizer-hover`)
        .on('dblclick.stop', evt => this.mousedblclickHandler(evt))
        .css('position', 'absolute').hide(),
      this.hoverEl = h('div', `${cssPrefix}-resizer-hover`)
        .on('mousedown.stop', evt => this.mousedownHandler(evt)),
      this.lineEl = h('div', `${cssPrefix}-resizer-line`).hide(),
    ).hide();
    // cell rect
    this.cRect = null;
    this.finishedFn = null;
    this.minDistance = minDistance;
    this.unhideFn = () => {};
  }

  showUnhide(index) {
    this.unhideIndex = index;
    this.unhideHoverEl.show();
  }

  hideUnhide() {
    this.unhideHoverEl.hide();
  }

  // rect : {top, left, width, height}
  // line : {width, height}
  show(rect, line) {
    const {
      moving, vertical, hoverEl, lineEl, el,
      unhideHoverEl,
    } = this;
    if (moving) return;
    this.cRect = rect;
    const {
      left, top, width, height,
    } = rect;
    el.offset({
      left: vertical ? left + width - 5 : left,
      top: vertical ? top : top + height - 5,
    }).show();
    hoverEl.offset({
      width: vertical ? 5 : width,
      height: vertical ? height : 5,
    });
    lineEl.offset({
      width: vertical ? 0 : line.width,
      height: vertical ? line.height : 0,
    });
    unhideHoverEl.offset({
      left: vertical ? 5 - width : left,
      top: vertical ? top : 5 - height,
      width: vertical ? 5 : width,
      height: vertical ? height : 5,
    });
  }

  hide() {
    this.el.offset({
      left: 0,
      top: 0,
    }).hide();
    this.hideUnhide();
  }

  mousedblclickHandler() {
    if (this.unhideIndex) this.unhideFn(this.unhideIndex);
  }

  mousedownHandler(evt) {
    if (!this.cRect) return;
    if (evt && evt.buttons !== undefined && evt.buttons !== 1) return;
    let startEvt = evt;
    const {
      el, lineEl, cRect, vertical, minDistance,
    } = this;
    const baseDistance = vertical ? cRect.width : cRect.height;
    let rawDistance = baseDistance;
    let distance = Math.max(minDistance, baseDistance);
    const startClientX = evt && typeof evt.clientX === 'number' ? evt.clientX : null;
    const startClientY = evt && typeof evt.clientY === 'number' ? evt.clientY : null;
    lineEl.show();
    const cleanup = () => {
      this._cancelMove = null;
      startEvt = null;
      lineEl.hide();
      this.moving = false;
      this.hide();
    };
    const finish = () => {
      cleanup();
      if (this.finishedFn) {
        if (distance < minDistance) distance = minDistance;
        this.finishedFn(cRect, distance);
      }
    };
    this._cancelMove = mouseMoveUp(window, (e) => {
      this.moving = true;
      if (startEvt !== null && e.buttons === 1) {
        if (vertical) {
          if (startClientX !== null && typeof e.clientX === 'number') {
            rawDistance = baseDistance + (e.clientX - startClientX);
          } else {
            rawDistance += Number(e.movementX) || 0;
          }
          distance = Math.max(minDistance, rawDistance);
          el.css('left', `${cRect.left + distance}px`);
        } else {
          if (startClientY !== null && typeof e.clientY === 'number') {
            rawDistance = baseDistance + (e.clientY - startClientY);
          } else {
            rawDistance += Number(e.movementY) || 0;
          }
          distance = Math.max(minDistance, rawDistance);
          el.css('top', `${cRect.top + distance}px`);
        }
        startEvt = e;
      } else if (e.buttons === 0 && typeof this._cancelMove === 'function') {
        this._cancelMove();
      }
    }, finish, cleanup);
  }

  destroy() {
    if (typeof this._cancelMove === 'function') {
      this._cancelMove();
      this._cancelMove = null;
    }
    this.moving = false;
    this.lineEl.hide();
    this.hide();
  }
}
