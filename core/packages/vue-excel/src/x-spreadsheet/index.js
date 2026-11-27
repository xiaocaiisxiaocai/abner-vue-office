import { h } from './component/element';
import DataProxy from './core/data_proxy';
import Sheet from './component/sheet';
import Bottombar from './component/bottombar';
import { cssPrefix } from './config';
import { locale } from './locale/locale';

class Spreadsheet {
  constructor(selectors, options = {}) {
    let targetEl = selectors;
    this.options = { showBottomBar: true, ...options };
    this.sheetIndex = 1;
    this.datas = [];
    if (typeof selectors === 'string') {
      targetEl = typeof document !== 'undefined' ? document.querySelector(selectors) : null;
    }
    if (!targetEl) {
      throw new Error('Spreadsheet target element is required');
    }
    this.bottombar = this.options.showBottomBar ? new Bottombar(() => {
      if (this.options.mode === 'read') return;
      this.addSheet();
    }, (index) => {
      const d = this.datas[index];
      if (d) {
        this.data = d;
        if (this.sheet) {
          this.sheet.resetData(d);
        }
      }
    }, () => {
      this.deleteSheet();
    }, (index, value) => {
      if (this.datas[index]) {
        this.datas[index].name = value;
      }
      if (this.sheet) {
        this.sheet.trigger('change', this.data ? this.data.getData() : undefined);
      }
    }, this.options) : null;
    this.data = null;
    this.sheet = null;
    const d = this.addSheet(undefined, true);
    this.data = d;
    const rootEl = h('div', `${cssPrefix}`)
      .on('contextmenu', evt => evt.preventDefault());
    this.rootEl = rootEl;
    // create canvas element
    targetEl.appendChild(rootEl.el);
    this.sheet = new Sheet(rootEl, this.data);
    if (this.bottombar !== null) {
      rootEl.child(this.bottombar.el);
    }
  }

  addSheet(name, active = true) {
    const n = name || `sheet${this.sheetIndex}`;
    const d = new DataProxy(n, this.options);
    d.change = (...args) => {
      if (this.sheet) {
        this.sheet.trigger('change', ...args);
      }
    };
    this.datas.push(d);
    if (this.bottombar !== null) {
      this.bottombar.addItem(n, active, this.options);
    }
    if (active) {
      this.data = d;
      if (this.sheet) {
        this.sheet.resetData(d);
      }
    }
    this.sheetIndex += 1;
    return d;
  }

  deleteSheet() {
    if (this.options.mode === 'read' || this.bottombar === null) return;

    const [oldIndex, nindex] = this.bottombar.deleteItem();
    if (oldIndex >= 0) {
      this.datas.splice(oldIndex, 1);
      if (nindex >= 0 && this.datas[nindex]) {
        this.data = this.datas[nindex];
        if (this.sheet) {
          this.sheet.resetData(this.data);
        }
      }
      if (this.sheet) {
        this.sheet.trigger('change', this.data ? this.data.getData() : undefined);
      }
    }
  }

  loadData(data) {
    const ds = Array.isArray(data) ? data : [data];
    if (this.bottombar !== null) {
      this.bottombar.clear();
    }
    this.datas = [];
    this.sheetIndex = 1;
    this.data = null;
    if (ds.length > 0) {
      let firstData = null;
      for (let i = 0; i < ds.length; i += 1) {
        const it = ds[i];
        const sheetName = (it && typeof it.name === 'string' && it.name.trim()) ? it.name : `sheet${this.sheetIndex}`;
        const nd = this.addSheet(sheetName, false);
        nd.setData(it);
        if (i === 0) {
          firstData = nd;
          this.data = nd;
        }
      }
      let swapped = false;
      if (this.bottombar !== null && this.bottombar.items && this.bottombar.items[0]) {
        this.bottombar.clickSwap2(this.bottombar.items[0]);
        swapped = true;
      }
      if (!swapped && firstData && this.sheet) {
        this.sheet.resetData(firstData);
      }
    } else {
      this.addSheet('sheet1', true);
    }
    return this;
  }

  getData() {
    return this.datas.map(it => it.getData());
  }

  cellText(ri, ci, text, sheetIndex = 0) {
    if (this.datas[sheetIndex]) {
      this.datas[sheetIndex].setCellText(ri, ci, text, 'finished');
    }
    return this;
  }

  cell(ri, ci, sheetIndex = 0) {
    return this.datas[sheetIndex] ? this.datas[sheetIndex].getCell(ri, ci) : null;
  }

  cellStyle(ri, ci, sheetIndex = 0) {
    return this.datas[sheetIndex] ? this.datas[sheetIndex].getCellStyle(ri, ci) : null;
  }

  reRender() {
    if (this.sheet) {
      this.sheet.table.render();
    }
    return this;
  }

  on(eventName, func) {
    if (this.sheet) {
      this.sheet.on(eventName, func);
    }
    return this;
  }

  validate() {
    if (!this.data) return true;
    const { validations } = this.data;
    return validations.errors.size <= 0;
  }

  change(cb) {
    if (this.sheet) {
      this.sheet.on('change', cb);
    }
    return this;
  }

  destroy() {
    if (this.bottombar && typeof this.bottombar.destroy === 'function') {
      this.bottombar.destroy();
    }
    if (this.sheet && typeof this.sheet.destroy === 'function') {
      this.sheet.destroy();
    }
    if (this.rootEl && this.rootEl.el && this.rootEl.el.parentNode) {
      this.rootEl.el.parentNode.removeChild(this.rootEl.el);
    }
    this.datas = [];
    this.data = null;
    this.sheet = null;
    this.bottombar = null;
    this.rootEl = null;
  }

  static locale(lang, message, clearLangList = false) {
    locale(lang, message, clearLangList);
  }
}

const spreadsheet = (el, options = {}) => new Spreadsheet(el, options);

export default Spreadsheet;
export {
  spreadsheet,
};
