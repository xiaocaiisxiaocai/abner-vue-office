import helper from './helper';

class Cols {
  constructor({
    len, width, indexWidth, minWidth,
  }) {
    this._ = {};
    this.len = len;
    this.width = width;
    this.indexWidth = indexWidth;
    this.minWidth = minWidth;
  }

  setData(d) {
    if (!d || typeof d !== 'object') {
      return;
    }
    const copy = {};
    Object.keys(d).forEach((k) => {
      if (k === 'len') {
        this.len = d.len;
      } else if (k !== '__proto__' && k !== 'constructor' && k !== 'prototype') {
        copy[k] = d[k];
      }
    });
    this._ = copy;
  }

  getData() {
    const { len } = this;
    return Object.assign({ len }, this._);
  }

  getWidth(i) {
    if (this.isHide(i)) return 0;
    const col = this._[i];
    if (col && col.width !== undefined) {
      return col.width;
    }
    return this.width;
  }

  getOrNew(ci) {
    this._[ci] = this._[ci] || {};
    return this._[ci];
  }

  setWidth(ci, width) {
    const col = this.getOrNew(ci);
    col.width = width;
  }

  unhide(idx) {
    if (idx >= 0 && this.isHide(idx)) {
      this.setHide(idx, false);
    }
    let index = idx;
    while (index > 0) {
      index -= 1;
      if (this.isHide(index)) {
        this.setHide(index, false);
      } else break;
    }
  }

  isHide(ci) {
    const col = this._[ci];
    return !!(col && col.hide);
  }

  setHide(ci, v) {
    const col = this.getOrNew(ci);
    if (v === true) col.hide = true;
    else delete col.hide;
  }

  setStyle(ci, style) {
    const col = this.getOrNew(ci);
    col.style = style;
  }

  sumWidth(min, max) {
    return helper.rangeSum(min, max, i => this.getWidth(i));
  }

  totalWidth() {
    return this.sumWidth(0, this.len);
  }
}

export default {};
export {
  Cols,
};
