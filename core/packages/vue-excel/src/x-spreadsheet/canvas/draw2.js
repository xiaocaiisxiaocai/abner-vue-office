class Draw {
  constructor(el) {
    this.el = el;
    this.ctx = el ? el.getContext('2d') : null;
  }

  clear() {
    if (!this.el || !this.ctx) return this;
    const { width, height } = this.el;
    this.ctx.clearRect(0, 0, width, height);
    return this;
  }

  attr(m) {
    if (!this.ctx) return this;
    Object.assign(this.ctx, m);
    return this;
  }

  save() {
    if (!this.ctx) return this;
    this.ctx.save();
    this.ctx.beginPath();
    return this;
  }

  restore() {
    if (!this.ctx) return this;
    this.ctx.restore();
    return this;
  }

  beginPath() {
    if (!this.ctx) return this;
    this.ctx.beginPath();
    return this;
  }

  closePath() {
    if (!this.ctx) return this;
    this.ctx.closePath();
    return this;
  }

  measureText(text) {
    if (!this.ctx) return { width: 0 };
    return this.ctx.measureText(text);
  }

  rect(x, y, width, height) {
    if (!this.ctx) return this;
    this.ctx.rect(x, y, width, height);
    return this;
  }

  scale(x, y) {
    if (!this.ctx) return this;
    this.ctx.scale(x, y);
    return this;
  }

  rotate(angle) {
    if (!this.ctx) return this;
    this.ctx.rotate(angle);
    return this;
  }

  translate(x, y) {
    if (!this.ctx) return this;
    this.ctx.translate(x, y);
    return this;
  }

  transform(a, b, c, d, e, f) {
    if (!this.ctx) return this;
    this.ctx.transform(a, b, c, d, e, f);
    return this;
  }

  fillRect(x, y, w, h) {
    if (!this.ctx) return this;
    this.ctx.fillRect(x, y, w, h);
    return this;
  }

  strokeRect(x, y, w, h) {
    if (!this.ctx) return this;
    this.ctx.strokeRect(x, y, w, h);
    return this;
  }

  fillText(text, x, y, maxWidth) {
    if (!this.ctx) return this;
    this.ctx.fillText(text, x, y, maxWidth);
    return this;
  }

  strokeText(text, x, y, maxWidth) {
    if (!this.ctx) return this;
    this.ctx.strokeText(text, x, y, maxWidth);
    return this;
  }
}

export default {};
export {
  Draw,
};
