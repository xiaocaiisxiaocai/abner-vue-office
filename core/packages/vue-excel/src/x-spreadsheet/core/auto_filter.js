import { CellRange } from './cell_range';
// operator: all|eq|neq|gt|gte|lt|lte|in|be
// value:
//   in => []
//   be => [min, max]
function toStrictNum(v) {
  if (v === '' || v == null || /^\s*$/.test(String(v))) return NaN;
  return Number(v);
}

class Filter {
  constructor(ci, operator, value) {
    this.ci = ci;
    this.operator = operator;
    this.value = Array.isArray(value) ? value.slice() : value;
  }

  set(operator, value) {
    this.operator = operator;
    this.value = Array.isArray(value) ? value.slice() : value;
  }

  includes(v) {
    const { operator, value } = this;
    if (operator === 'all') {
      return true;
    }
    if (operator === 'in') {
      const sv = v == null ? '' : String(v);
      return Array.isArray(value) && value.some(it => (it == null ? '' : String(it)) === sv);
    }
    if (operator === 'eq') {
      const sv = v == null ? '' : String(v);
      return sv === (value == null ? '' : String(value));
    }
    if (operator === 'neq') {
      const sv = v == null ? '' : String(v);
      return sv !== (value == null ? '' : String(value));
    }
    const nv = toStrictNum(v);
    if (operator === 'be' && Array.isArray(value) && value.length >= 2) {
      const min = toStrictNum(value[0]);
      const max = toStrictNum(value[1]);
      return !Number.isNaN(nv) && !Number.isNaN(min) && !Number.isNaN(max) && nv >= min && nv <= max;
    }
    const target = toStrictNum(value);
    if (Number.isNaN(nv) || Number.isNaN(target)) return false;
    if (operator === 'gt') return nv > target;
    if (operator === 'gte') return nv >= target;
    if (operator === 'lt') return nv < target;
    if (operator === 'lte') return nv <= target;
    return false;
  }

  vlength() {
    const { operator, value } = this;
    if (operator === 'in' && Array.isArray(value)) {
      return value.length;
    }
    return 0;
  }

  getData() {
    const { ci, operator, value } = this;
    return { ci, operator, value: Array.isArray(value) ? value.slice() : value };
  }
}

class Sort {
  constructor(ci, order) {
    this.ci = ci;
    this.order = order;
  }

  asc() {
    return this.order === 'asc';
  }

  desc() {
    return this.order === 'desc';
  }
}

function normalizeFilterCellText(cell) {
  if (cell !== null && cell !== undefined && cell.text != null && !/^\s*$/.test(String(cell.text))) {
    return String(cell.text);
  }
  return '';
}

export default class AutoFilter {
  constructor() {
    this.ref = null;
    this.filters = [];
    this.sort = null;
  }

  setData(d) {
    this.clear();
    if (!d || typeof d !== 'object' || !CellRange.isValidRef(d.ref)) {
      return;
    }
    const { ref, filters, sort } = d;
    this.ref = ref;
    this.filters = Array.isArray(filters)
      ? filters.filter(it => it && typeof it === 'object').map(it => new Filter(it.ci, it.operator, it.value))
      : [];
    this.sort = (sort && typeof sort === 'object' && sort.order) ? new Sort(sort.ci, sort.order) : null;
  }

  getData() {
    if (this.active()) {
      const { ref, filters, sort } = this;
      return {
        ref,
        filters: filters.map(it => it.getData()),
        sort: sort ? { ci: sort.ci, order: sort.order } : null,
      };
    }
    return {};
  }

  addFilter(ci, operator, value) {
    const filter = this.getFilter(ci);
    if (filter == null) {
      this.filters.push(new Filter(ci, operator, value));
    } else {
      filter.set(operator, value);
    }
  }

  setSort(ci, order) {
    if (order) {
      this.sort = new Sort(ci, order);
    } else if (this.sort && this.sort.ci === ci) {
      this.sort = null;
    }
  }

  includes(ri, ci) {
    if (this.active()) {
      return this.hrange().includes(ri, ci);
    }
    return false;
  }

  getSort(ci) {
    const { sort } = this;
    if (sort && sort.ci === ci) {
      return sort;
    }
    return null;
  }

  getFilter(ci) {
    const { filters } = this;
    for (let i = 0; i < filters.length; i += 1) {
      if (filters[i].ci === ci) {
        return filters[i];
      }
    }
    return null;
  }

  filteredRows(getCell) {
    const rset = new Set();
    const fset = new Set();
    if (this.active()) {
      const { sri, eri } = this.range();
      const { filters } = this;
      for (let ri = sri + 1; ri <= eri; ri += 1) {
        let matched = true;
        for (let i = 0; i < filters.length; i += 1) {
          const filter = filters[i];
          const cell = getCell(ri, filter.ci);
          const ctext = normalizeFilterCellText(cell);
          if (!filter.includes(ctext)) {
            matched = false;
            break;
          }
        }
        if (matched) {
          fset.add(ri);
        } else {
          rset.add(ri);
        }
      }
    }
    return { rset, fset };
  }

  items(ci, getCell) {
    const m = Object.create(null);
    if (this.active()) {
      const { sri, eri } = this.range();
      for (let ri = sri + 1; ri <= eri; ri += 1) {
        const cell = getCell(ri, ci);
        const key = normalizeFilterCellText(cell);
        m[key] = (m[key] || 0) + 1;
      }
    }
    return m;
  }

  range() {
    return CellRange.valueOf(this.ref);
  }

  hrange() {
    const r = this.range();
    r.eri = r.sri;
    return r;
  }

  clear() {
    this.ref = null;
    this.filters = [];
    this.sort = null;
  }

  active() {
    return this.ref !== null;
  }
}
