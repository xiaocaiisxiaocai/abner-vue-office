import { CellRange } from './cell_range';

class Merges {
  constructor(d = []) {
    this._ = d;
  }

  forEach(cb) {
    this._.forEach(cb);
  }

  deleteWithin(cr) {
    this._ = this._.filter(it => !it.within(cr));
  }

  getFirstIncludes(ri, ci) {
    for (let i = 0; i < this._.length; i += 1) {
      const it = this._[i];
      if (it.includes(ri, ci)) {
        return it.clone();
      }
    }
    return null;
  }

  filterIntersects(cellRange) {
    return new Merges(this._.filter(it => it.intersects(cellRange)));
  }

  intersects(cellRange) {
    for (let i = 0; i < this._.length; i += 1) {
      const it = this._[i];
      if (it.intersects(cellRange)) {
        return true;
      }
    }
    return false;
  }

  union(cellRange) {
    let cr = cellRange.clone();
    let changed = true;
    while (changed) {
      changed = false;
      this._.forEach((it) => {
        if (it.intersects(cr) && !it.within(cr)) {
          cr = it.union(cr);
          changed = true;
        }
      });
    }
    return cr;
  }

  add(cr) {
    this.deleteWithin(cr);
    this._.push(cr.clone());
  }

  // type: row | column
  shift(type, index, n, cbWithin = () => {}) {
    if (n === 0) return;
    if (n > 0) {
      this._.forEach((range) => {
        if (type === 'row') {
          if (range.sri >= index) {
            range.sri += n;
            range.eri += n;
          } else if (range.sri < index && index <= range.eri) {
            range.eri += n;
            cbWithin(range.sri, range.sci, n, 0);
          }
        } else if (type === 'column') {
          if (range.sci >= index) {
            range.sci += n;
            range.eci += n;
          } else if (range.sci < index && index <= range.eci) {
            range.eci += n;
            cbWithin(range.sri, range.sci, 0, n);
          }
        }
      });
      return;
    }

    const delCount = -n;
    const delEnd = index + delCount - 1;
    const kept = [];
    this._.forEach((range) => {
      if (type === 'row') {
        const {
          sri, eri, sci,
        } = range;
        if (sri > delEnd) {
          range.sri -= delCount;
          range.eri -= delCount;
          kept.push(range);
        } else if (eri < index) {
          kept.push(range);
        } else if (sri >= index && eri <= delEnd) {
          // fully deleted merge
        } else {
          // partial overlap
          const newSri = sri < index ? sri : index;
          const newEri = eri > delEnd ? eri - delCount : index - 1;
          const overlapBeforeEnd = Math.min(eri, delEnd) - Math.max(sri, index) + 1;
          if (newEri >= newSri) {
            range.sri = newSri;
            range.eri = newEri;
            cbWithin(newSri, sci, -overlapBeforeEnd, 0);
            if (range.multiple()) {
              kept.push(range);
            }
          }
        }
      } else if (type === 'column') {
        const {
          sri, sci, eci,
        } = range;
        if (sci > delEnd) {
          range.sci -= delCount;
          range.eci -= delCount;
          kept.push(range);
        } else if (eci < index) {
          kept.push(range);
        } else if (sci >= index && eci <= delEnd) {
          // fully deleted merge
        } else {
          const newSci = sci < index ? sci : index;
          const newEci = eci > delEnd ? eci - delCount : index - 1;
          const overlapBeforeEnd = Math.min(eci, delEnd) - Math.max(sci, index) + 1;
          if (newEci >= newSci) {
            range.sci = newSci;
            range.eci = newEci;
            cbWithin(sri, newSci, 0, -overlapBeforeEnd);
            if (range.multiple()) {
              kept.push(range);
            }
          }
        }
      } else {
        kept.push(range);
      }
    });
    this._ = kept;
  }

  move(cellRange, rn, cn) {
    this._.forEach((it1) => {
      const it = it1;
      if (it.within(cellRange)) {
        it.eri += rn;
        it.sri += rn;
        it.sci += cn;
        it.eci += cn;
      }
    });
  }

  setData(merges) {
    this._ = Array.isArray(merges) ? merges.map(merge => CellRange.valueOf(merge)) : [];
    return this;
  }

  getData() {
    return this._.map(merge => merge.toString());
  }
}

export default {};
export {
  Merges,
};
