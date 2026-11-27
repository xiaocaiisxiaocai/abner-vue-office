function dpr() {
  return (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
}

function thinLineWidth() {
  return Math.max(0.5, dpr() - 0.5);
}

function npx(px) {
  return Math.trunc(px * dpr());
}

function npxLine(px) {
  const n = npx(px);
  return n === 0 ? 0.5 : n - 0.5;
}

class DrawBox {
  constructor(x, y, w, h, padding = 0) {
    this.x = x;
    this.y = y;
    this.width = w;
    this.height = h;
    this.padding = padding;
    this.bgcolor = '#ffffff';
    // border: [width, style, color]
    this.borderTop = null;
    this.borderRight = null;
    this.borderBottom = null;
    this.borderLeft = null;
  }

  setBorders(borders) {
    if (!borders || typeof borders !== 'object') return;
    const {
      top, bottom, left, right,
    } = borders;
    if (top) this.borderTop = top;
    if (right) this.borderRight = right;
    if (bottom) this.borderBottom = bottom;
    if (left) this.borderLeft = left;
  }

  innerWidth() {
    return this.width - (this.padding * 2) - 2;
  }

  innerHeight() {
    return this.height - (this.padding * 2) - 2;
  }

  textx(align = 'left') {
    const { width, padding } = this;
    let { x } = this;
    if (align === 'center') {
      x += width / 2;
    } else if (align === 'right') {
      x += width - padding;
    } else {
      x += padding;
    }
    return x;
  }

  texty(align = 'middle', h = 0) {
    const { height, padding } = this;
    let { y } = this;
    if (align === 'top') {
      y += padding;
    } else if (align === 'bottom') {
      y += height - padding - h;
    } else {
      y += height / 2 - h / 2;
    }
    return y;
  }

  topxys() {
    const { x, y, width } = this;
    return [[x, y], [x + width, y]];
  }

  rightxys() {
    const {
      x, y, width, height,
    } = this;
    return [[x + width, y], [x + width, y + height]];
  }

  bottomxys() {
    const {
      x, y, width, height,
    } = this;
    return [[x, y + height], [x + width, y + height]];
  }

  leftxys() {
    const {
      x, y, height,
    } = this;
    return [[x, y], [x, y + height]];
  }
}

function drawFontLine(type, tx, ty, align, valign, blheight, blwidth) {
  const floffset = { x: 0, y: 0 };
  if (type === 'underline') {
    if (valign === 'bottom') {
      floffset.y = 0;
    } else if (valign === 'top') {
      floffset.y = -(blheight + 2);
    } else {
      floffset.y = -blheight / 2;
    }
  } else if (type === 'strike') {
    if (valign === 'bottom') {
      floffset.y = blheight / 2;
    } else if (valign === 'top') {
      floffset.y = -((blheight / 2) + 2);
    }
  }

  if (align === 'center') {
    floffset.x = blwidth / 2;
  } else if (align === 'right') {
    floffset.x = blwidth;
  }
  this.line(
    [tx - floffset.x, ty - floffset.y],
    [tx - floffset.x + blwidth, ty - floffset.y],
  );
}

function formatCssFontFamily(name) {
  const s = typeof name === 'string' ? name.trim() : '';
  if (!s) return 'Arial';
  if (s.includes(',') || /^['"]/.test(s) || /^[a-zA-Z_-][a-zA-Z0-9_-]*$/.test(s)) {
    return s;
  }
  return `"${s.replace(/["\\]/g, '\\$&')}"`;
}

class Draw {
  constructor(el, width, height) {
    this.el = el;
    this.ctx = el ? el.getContext('2d') : null;
    if (this.el) {
      this.resize(width, height);
    }
  }

  resize(width, height) {
    if (!this.el) return;
    const w = Math.max(0, width || 0);
    const h = Math.max(0, height || 0);
    this.el.style.width = `${w}px`;
    this.el.style.height = `${h}px`;
    this.el.width = npx(w);
    this.el.height = npx(h);
  }

  clear() {
    if (!this.el || !this.ctx) return this;
    const { width, height } = this.el;
    this.ctx.clearRect(0, 0, width, height);
    return this;
  }

  attr(options) {
    if (!this.ctx) return this;
    Object.assign(this.ctx, options);
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

  translate(x, y) {
    if (!this.ctx) return this;
    this.ctx.translate(npx(x), npx(y));
    return this;
  }

  scale(x, y) {
    if (!this.ctx) return this;
    this.ctx.scale(x, y);
    return this;
  }

  clearRect(x, y, w, h) {
    if (!this.ctx) return this;
    this.ctx.clearRect(npx(x), npx(y), npx(w), npx(h));
    return this;
  }

  fillRect(x, y, w, h) {
    if (!this.ctx) return this;
    this.ctx.fillRect(npx(x) - 0.5, npx(y) - 0.5, npx(w), npx(h));
    return this;
  }

  fillText(text, x, y) {
    if (!this.ctx) return this;
    this.ctx.fillText(text, npx(x), npx(y));
    return this;
  }

  /*
    txt: render text
    box: DrawBox
    attr: {
      align: left | center | right
      valign: top | middle | bottom
      color: '#333333',
      strike: false,
      font: {
        name: 'Arial',
        size: 14,
        bold: false,
        italic: false,
      }
    }
    textWrap: text wrapping
  */
  text(mtxt, box, attr = {}, textWrap = true) {
    const { ctx } = this;
    if (!ctx) return this;
    const rawAlign = attr.align;
    const align = (rawAlign === 'center' || rawAlign === 'right' || rawAlign === 'left') ? rawAlign : 'left';
    const rawValign = attr.valign;
    const valign = (rawValign === 'top' || rawValign === 'bottom' || rawValign === 'middle') ? rawValign : 'middle';
    const {
      color = '#0a0a0a',
      strike = false,
      underline = false,
    } = attr;
    const rawFont = attr.font || {};
    const parsedFontSize = Number(rawFont.size);
    const font = {
      name: formatCssFontFamily(rawFont.name),
      size: (rawFont.size !== '' && rawFont.size != null && typeof rawFont.size !== 'boolean' && Number.isFinite(parsedFontSize) && parsedFontSize > 0)
        ? parsedFontSize
        : 10,
      bold: Boolean(rawFont.bold),
      italic: Boolean(rawFont.italic),
    };
    const tx = box.textx(align);
    ctx.save();
    ctx.beginPath();
    this.attr({
      textAlign: align,
      textBaseline: valign,
      font: `${font.italic ? 'italic' : ''} ${font.bold ? 'bold' : ''} ${Math.max(1, npx(font.size))}px ${font.name}`,
      fillStyle: color,
      strokeStyle: color,
    });
    const safeText = mtxt == null ? '' : String(mtxt);
    const txts = safeText.split(/\r\n|\r|\n/);
    const maxW = Math.max(npx(box.innerWidth()), 1);
    const ntxts = [];
    txts.forEach((it) => {
      const txtWidth = ctx.measureText(it).width;
      if (textWrap && txtWidth > maxW) {
        const chars = Array.from(it);
        let currentLine = '';
        for (let i = 0; i < chars.length; i += 1) {
          const nextLine = currentLine + chars[i];
          if (currentLine.length > 0 && ctx.measureText(nextLine).width > maxW) {
            ntxts.push(currentLine);
            currentLine = chars[i];
          } else {
            currentLine = nextLine;
          }
        }
        if (currentLine.length > 0) {
          ntxts.push(currentLine);
        }
      } else {
        ntxts.push(it);
      }
    });
    const txtHeight = (ntxts.length - 1) * (font.size + 2);
    let ty = box.texty(valign, txtHeight);
    ntxts.forEach((txt) => {
      const txtCssWidth = ctx.measureText(txt).width / dpr();
      this.fillText(txt, tx, ty);
      if (strike || underline) {
        ctx.lineWidth = thinLineWidth();
        if (typeof ctx.setLineDash === 'function') {
          ctx.setLineDash([]);
        }
      }
      if (strike) {
        drawFontLine.call(this, 'strike', tx, ty, align, valign, font.size, txtCssWidth);
      }
      if (underline) {
        drawFontLine.call(this, 'underline', tx, ty, align, valign, font.size, txtCssWidth);
      }
      ty += font.size + 2;
    });
    ctx.restore();
    return this;
  }

  border(style, color) {
    const { ctx } = this;
    if (!ctx) return this;
    const hasDash = typeof ctx.setLineDash === 'function';
    if (hasDash) {
      ctx.setLineDash([]);
    }
    ctx.lineWidth = thinLineWidth();
    ctx.strokeStyle = color;
    const dashLen = n => Math.max(1, npx(n));
    if (style === 'medium') {
      ctx.lineWidth = Math.max(1, npx(2) - 0.5);
    } else if (style === 'thick') {
      ctx.lineWidth = Math.max(1.5, npx(3));
    } else if (style === 'hair') {
      ctx.lineWidth = Math.max(0.5, thinLineWidth() * 0.75);
    } else if (style === 'dashed' && hasDash) {
      ctx.setLineDash([dashLen(3), dashLen(2)]);
    } else if (style === 'mediumDashed') {
      ctx.lineWidth = Math.max(1, npx(2) - 0.5);
      if (hasDash) ctx.setLineDash([dashLen(4), dashLen(2)]);
    } else if ((style === 'dashDot' || style === 'slantDashDot') && hasDash) {
      ctx.setLineDash([dashLen(4), dashLen(2), dashLen(1), dashLen(2)]);
    } else if (style === 'mediumDashDot') {
      ctx.lineWidth = Math.max(1, npx(2) - 0.5);
      if (hasDash) ctx.setLineDash([dashLen(4), dashLen(2), dashLen(1), dashLen(2)]);
    } else if (style === 'dashDotDot' && hasDash) {
      ctx.setLineDash([dashLen(4), dashLen(2), dashLen(1), dashLen(1), dashLen(1), dashLen(2)]);
    } else if (style === 'mediumDashDotDot') {
      ctx.lineWidth = Math.max(1, npx(2) - 0.5);
      if (hasDash) ctx.setLineDash([dashLen(4), dashLen(2), dashLen(1), dashLen(1), dashLen(1), dashLen(2)]);
    } else if (style === 'dotted' && hasDash) {
      ctx.setLineDash([dashLen(1), dashLen(1)]);
    } else if (style === 'double' && hasDash) {
      ctx.setLineDash([dashLen(2), dashLen(1)]);
    }
    return this;
  }

  line(...xys) {
    const { ctx } = this;
    if (!ctx) return this;
    if (xys.length > 1) {
      ctx.beginPath();
      const [x, y] = xys[0];
      ctx.moveTo(npxLine(x), npxLine(y));
      for (let i = 1; i < xys.length; i += 1) {
        const [x1, y1] = xys[i];
        ctx.lineTo(npxLine(x1), npxLine(y1));
      }
      ctx.stroke();
    }
    return this;
  }

  strokeBorders(box) {
    const { ctx } = this;
    if (!ctx || !box) return;
    ctx.save();
    // border
    const {
      borderTop, borderRight, borderBottom, borderLeft,
    } = box;
    if (Array.isArray(borderTop)) {
      this.border(...borderTop);
      // console.log('box.topxys:', box.topxys());
      this.line(...box.topxys());
    }
    if (Array.isArray(borderRight)) {
      this.border(...borderRight);
      this.line(...box.rightxys());
    }
    if (Array.isArray(borderBottom)) {
      this.border(...borderBottom);
      this.line(...box.bottomxys());
    }
    if (Array.isArray(borderLeft)) {
      this.border(...borderLeft);
      this.line(...box.leftxys());
    }
    ctx.restore();
  }

  dropdown(box) {
    const { ctx } = this;
    if (!ctx) return;
    const {
      x, y, width, height,
    } = box;
    const sx = x + width - 15;
    const sy = y + height - 15;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(npx(sx), npx(sy));
    ctx.lineTo(npx(sx + 8), npx(sy));
    ctx.lineTo(npx(sx + 4), npx(sy + 6));
    ctx.closePath();
    ctx.fillStyle = 'rgba(0, 0, 0, .45)';
    ctx.fill();
    ctx.restore();
  }

  error(box) {
    const { ctx } = this;
    if (!ctx) return;
    const { x, y, width } = box;
    const sx = x + width - 1;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(npx(sx - 8), npx(y + 1));
    ctx.lineTo(npx(sx), npx(y + 1));
    ctx.lineTo(npx(sx), npx(y + 9));
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 0, 0, .65)';
    ctx.fill();
    ctx.restore();
  }

  frozen(box) {
    const { ctx } = this;
    if (!ctx) return;
    const { x, y, width } = box;
    const sx = x + width - 1;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(npx(sx - 8), npx(y + 1));
    ctx.lineTo(npx(sx), npx(y + 1));
    ctx.lineTo(npx(sx), npx(y + 9));
    ctx.closePath();
    ctx.fillStyle = 'rgba(0, 255, 0, .85)';
    ctx.fill();
    ctx.restore();
  }

  rect(box, dtextcb) {
    const { ctx } = this;
    if (!ctx) return;
    const {
      x, y, width, height, bgcolor,
    } = box;
    ctx.save();
    try {
      ctx.beginPath();
      ctx.fillStyle = bgcolor || '#fff';
      const rx = npxLine(x) + 0.5;
      const ry = npxLine(y) + 0.5;
      const rw = Math.max(0, npxLine(x + width) - rx - 0.5);
      const rh = Math.max(0, npxLine(y + height) - ry - 0.5);
      ctx.rect(rx, ry, rw, rh);
      ctx.clip();
      ctx.fill();
      dtextcb();
    } finally {
      ctx.restore();
    }
  }
}

export default {};
export {
  Draw,
  DrawBox,
  thinLineWidth,
  npx,
};
