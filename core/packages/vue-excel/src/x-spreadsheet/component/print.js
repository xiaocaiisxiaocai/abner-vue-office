import { h } from './element';
import { cssPrefix } from '../config';
import Button from './button';
import { Draw, npx } from '../canvas/draw';
import { renderCell } from './table';
import { t } from '../locale/locale';

// resolution: 72 => 595 x 842
// 150 => 1240 x 1754
// 200 => 1654 x 2339
// 300 => 2479 x 3508
// 96 * cm / 2.54 , 96 * cm / 2.54

const PAGER_SIZES = [
  ['A3', 11.69, 16.54],
  ['A4', 8.27, 11.69],
  ['A5', 5.83, 8.27],
  ['B4', 9.84, 13.90],
  ['B5', 6.93, 9.84],
];

const PAGER_ORIENTATIONS = ['landscape', 'portrait'];
const FALLBACK_ORIENTATIONS = ['Landscape', 'Portrait'];

function inches2px(inc) {
  return parseInt(96 * inc, 10);
}

function btnClick(type) {
  if (type === 'cancel') {
    this.el.hide();
  } else {
    this.toPrint();
  }
}

function pagerSizeChange(evt) {
  const { paper } = this;
  const { value } = evt.target;
  const ps = PAGER_SIZES[value];
  if (!ps) return;
  paper.w = inches2px(ps[1]);
  paper.h = inches2px(ps[2]);
  this.preview();
}
function pagerOrientationChange(evt) {
  const { paper } = this;
  const { value } = evt.target;
  const v = PAGER_ORIENTATIONS[value];
  if (!v) return;
  paper.orientation = v;
  this.preview();
}

export default class Print {
  constructor(data) {
    this.paper = {
      w: inches2px(PAGER_SIZES[0][1]),
      h: inches2px(PAGER_SIZES[0][2]),
      padding: 50,
      orientation: PAGER_ORIENTATIONS[0],
      get width() {
        return this.orientation === 'landscape' ? this.h : this.w;
      },
      get height() {
        return this.orientation === 'landscape' ? this.w : this.h;
      },
    };
    this.data = data;
    this.canvases = [];
    this._printIframe = null;
    this._iframeTimer = null;
    const translatedOrientations = t('print.orientations');
    const orientations = Array.isArray(translatedOrientations) && translatedOrientations.length >= 2
      ? translatedOrientations
      : FALLBACK_ORIENTATIONS;
    this.el = h('div', `${cssPrefix}-print`)
      .children(
        h('div', `${cssPrefix}-print-bar`)
          .children(
            h('div', '-title').child('Print settings'),
            h('div', '-right').children(
              h('div', `${cssPrefix}-buttons`).children(
                new Button('cancel').on('click', btnClick.bind(this, 'cancel')),
                new Button('next', 'primary').on('click', btnClick.bind(this, 'next')),
              ),
            ),
          ),
        h('div', `${cssPrefix}-print-content`)
          .children(
            this.contentEl = h('div', '-content'),
            h('div', '-sider').child(
              h('form', '').children(
                h('fieldset', '').children(
                  h('label', '').child(`${t('print.size')}`),
                  h('select', '').children(
                    ...PAGER_SIZES.map((it, index) => h('option', '').attr('value', index).child(`${it[0]} ( ${it[1]}''x${it[2]}'' )`)),
                  ).on('change', pagerSizeChange.bind(this)),
                ),
                h('fieldset', '').children(
                  h('label', '').child(`${t('print.orientation')}`),
                  h('select', '').children(
                    ...PAGER_ORIENTATIONS.map((it, index) => h('option', '').attr('value', index).child(`${orientations[index]}`)),
                  ).on('change', pagerOrientationChange.bind(this)),
                ),
              ),
            ),
          ),
      ).hide();
  }

  resetData(data) {
    this.data = data;
    this.el.hide();
    this.removePrintIframe();
  }

  preview() {
    const { data, paper } = this;
    const { width, height, padding } = paper;
    const iwidth = width - padding * 2;
    const iheight = height - padding * 2;
    const cr = data.contentRange();
    const scale = cr.w > 0 ? iwidth / cr.w : 1;
    const effHeight = scale < 1 ? iheight / scale : iheight;
    let left = padding;
    const top = padding;
    if (scale > 1) {
      left += (iwidth - cr.w) / 2;
    }
    let ri = 0;
    let yoffset = 0;
    this.contentEl.html('');
    this.canvases = [];
    const mViewRange = {
      sri: 0,
      sci: 0,
      eri: 0,
      eci: 0,
    };
    const { exceptRowSet } = data;
    const maxPages = cr.eri - cr.sri + 2;
    for (let i = 0; i < maxPages && (ri <= cr.eri || i === 0); i += 1) {
      let th = 0;
      let yo = 0;
      const wrap = h('div', `${cssPrefix}-canvas-card`);
      const canvas = h('canvas', `${cssPrefix}-canvas`);
      this.canvases.push(canvas.el);
      const draw = new Draw(canvas.el, width, height);
      const clipAndTransform = (cb) => {
        draw.save();
        if (draw.ctx && typeof draw.ctx.rect === 'function' && typeof draw.ctx.clip === 'function') {
          draw.ctx.rect(npx(padding), npx(top), npx(iwidth), npx(iheight));
          draw.ctx.clip();
        }
        draw.translate(left, top);
        if (scale < 1) draw.scale(scale, scale);
        cb();
        draw.restore();
      };
      // cell-content
      let pageHiddenOffset = 0;
      let hasRenderedRow = false;
      clipAndTransform(() => {
        for (; ri <= cr.eri; ri += 1) {
          if (exceptRowSet && exceptRowSet.has(ri)) {
            const hiddenH = data.rows.getHeight(ri);
            pageHiddenOffset -= hiddenH;
            continue;
          }
          const rh = data.rows.getHeight(ri);
          th += rh;
          if (th < effHeight || !hasRenderedRow) {
            hasRenderedRow = true;
            for (let ci = 0; ci <= cr.eci; ci += 1) {
              renderCell(draw, data, ri, ci, yoffset + pageHiddenOffset, true);
              mViewRange.eci = ci;
            }
            if (th >= effHeight) {
              yo = -th + pageHiddenOffset;
              ri += 1;
              break;
            }
          } else {
            yo = -(th - rh) + pageHiddenOffset;
            break;
          }
        }
      });
      mViewRange.eri = Math.max(mViewRange.sri, ri - 1);
      // merge-cell
      const yof = yoffset;
      clipAndTransform(() => {
        data.eachMergesInView(mViewRange, ({ sri, sci }) => {
          if (exceptRowSet && exceptRowSet.has(sri)) return;
          const hiddenAbove = exceptRowSet
            ? (data.rows.sumHeight(mViewRange.sri, sri, exceptRowSet) - data.rows.sumHeight(mViewRange.sri, sri))
            : 0;
          renderCell(draw, data, sri, sci, yof + hiddenAbove, true);
        });
      });

      mViewRange.sri = ri;
      mViewRange.sci = 0;
      yoffset += yo;
      this.contentEl.child(h('div', `${cssPrefix}-canvas-card-wraper`).child(wrap.child(canvas)));
    }
    this.el.show();
  }

  removePrintIframe() {
    if (this._iframeTimer) {
      clearTimeout(this._iframeTimer);
      this._iframeTimer = null;
    }
    if (this._printIframe && this._printIframe.parentNode) {
      this._printIframe.parentNode.removeChild(this._printIframe);
    }
    this._printIframe = null;
  }

  toPrint() {
    this.el.hide();
    this.removePrintIframe();
    if (!this.canvases || this.canvases.length === 0) return;
    if (typeof window === 'undefined' || !window.document || !window.document.body) return;
    const { paper } = this;
    const iframe = h('iframe', '').css({
      position: 'fixed',
      left: '-9999px',
      top: '0',
      width: '0',
      height: '0',
      border: '0',
      visibility: 'hidden',
    });
    const { el } = iframe;
    this._printIframe = el;
    window.document.body.appendChild(el);
    const { contentWindow } = el;
    if (!contentWindow || !contentWindow.document) {
      this.removePrintIframe();
      return;
    }
    const idoc = contentWindow.document;
    const style = idoc.createElement ? idoc.createElement('style') : window.document.createElement('style');
    style.innerHTML = `
      @page { size: ${paper.width}px ${paper.height}px; }
      canvas {
        page-break-before: auto;
        page-break-after: always;
        image-rendering: pixelated;
      }
    `;
    if (idoc.head) idoc.head.appendChild(style);
    this.canvases.forEach((it) => {
      const cn = it.cloneNode(false);
      const ctx = cn.getContext ? cn.getContext('2d') : null;
      if (ctx) {
        ctx.drawImage(it, 0, 0);
      }
      if (idoc.body) idoc.body.appendChild(cn);
    });
    contentWindow.onafterprint = () => {
      this.removePrintIframe();
    };
    if (typeof contentWindow.focus === 'function') {
      contentWindow.focus();
    }
    if (typeof contentWindow.print === 'function') {
      contentWindow.print();
    }
    if (this._printIframe) {
      this._iframeTimer = setTimeout(() => {
        this.removePrintIframe();
      }, 60000);
    }
  }

  destroy() {
    this.el.hide();
    this.removePrintIframe();
    this.canvases = [];
  }
}
