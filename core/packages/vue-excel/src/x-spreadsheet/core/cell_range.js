import { xy2expr, expr2xy } from './alphabet';

class CellRange {
  constructor(sri, sci, eri, eci, w = 0, h = 0) {
    this.sri = sri;
    this.sci = sci;
    this.eri = eri;
    this.eci = eci;
    this.w = w;
    this.h = h;
  }

  set(sri, sci, eri, eci) {
    this.sri = sri;
    this.sci = sci;
    this.eri = eri;
    this.eci = eci;
  }

  multiple() {
    return this.eri - this.sri > 0 || this.eci - this.sci > 0;
  }

  // cell-index: ri, ci
  // cell-ref: A10
  includes(...args) {
    if (args.length === 0) return false;
    let [ri, ci] = [0, 0];
    if (args.length === 1) {
      [ci, ri] = expr2xy(args[0]);
      if (Number.isNaN(ri) || Number.isNaN(ci)) return false;
    } else if (args.length >= 2) {
      [ri, ci] = args;
    }
    const {
      sri, sci, eri, eci,
    } = this;
    return sri <= ri && ri <= eri && sci <= ci && ci <= eci;
  }

  each(cb, rowFilter = () => true) {
    const {
      sri, sci, eri, eci,
    } = this;
    for (let i = sri; i <= eri; i += 1) {
      if (rowFilter(i)) {
        for (let j = sci; j <= eci; j += 1) {
          cb(i, j);
        }
      }
    }
  }

  contains(other) {
    return this.sri <= other.sri
      && this.sci <= other.sci
      && this.eri >= other.eri
      && this.eci >= other.eci;
  }

  // within
  within(other) {
    return this.sri >= other.sri
      && this.sci >= other.sci
      && this.eri <= other.eri
      && this.eci <= other.eci;
  }

  // disjoint
  disjoint(other) {
    return this.sri > other.eri
      || this.sci > other.eci
      || other.sri > this.eri
      || other.sci > this.eci;
  }

  // intersects
  intersects(other) {
    return this.sri <= other.eri
      && this.sci <= other.eci
      && other.sri <= this.eri
      && other.sci <= this.eci;
  }

  // union
  union(other) {
    const {
      sri, sci, eri, eci,
    } = this;
    return new CellRange(
      other.sri < sri ? other.sri : sri,
      other.sci < sci ? other.sci : sci,
      other.eri > eri ? other.eri : eri,
      other.eci > eci ? other.eci : eci,
    );
  }

  // intersection
  // intersection(other) {}

  // Returns Array<CellRange> that represents that part of this that does not intersect with other
  // difference
  difference(other) {
    const ret = [];
    if (this.disjoint(other)) {
      ret.push(this.clone());
      return ret;
    }
    const {
      sri, sci, eri, eci,
    } = this;
    const isr = Math.max(sri, other.sri);
    const isc = Math.max(sci, other.sci);
    const ier = Math.min(eri, other.eri);
    const iec = Math.min(eci, other.eci);
    if (isr > sri) ret.push(new CellRange(sri, sci, isr - 1, eci));
    if (ier < eri) ret.push(new CellRange(ier + 1, sci, eri, eci));
    if (isc > sci) ret.push(new CellRange(isr, sci, ier, isc - 1));
    if (iec < eci) ret.push(new CellRange(isr, iec + 1, ier, eci));
    return ret;
  }

  size() {
    return [
      this.eri - this.sri + 1,
      this.eci - this.sci + 1,
    ];
  }

  toString() {
    const {
      sri, sci, eri, eci,
    } = this;
    let ref = xy2expr(sci, sri);
    if (this.multiple()) {
      ref = `${ref}:${xy2expr(eci, eri)}`;
    }
    return ref;
  }

  clone() {
    const {
      sri, sci, eri, eci, w, h,
    } = this;
    return new CellRange(sri, sci, eri, eci, w, h);
  }

  /*
  toJSON() {
    return this.toString();
  }
  */

  equals(other) {
    return this.eri === other.eri
      && this.eci === other.eci
      && this.sri === other.sri
      && this.sci === other.sci;
  }

  static isValidRef(ref) {
    if (typeof ref !== 'string') return false;
    const refs = ref.split(':');
    if (refs.length === 0 || refs.length > 2) return false;
    const [sci, sri] = expr2xy(refs[0]);
    if (Number.isNaN(sri) || Number.isNaN(sci) || sri < 0 || sci < 0) return false;
    if (refs.length === 2) {
      const [eci, eri] = expr2xy(refs[1]);
      if (Number.isNaN(eri) || Number.isNaN(eci) || eri < 0 || eci < 0) return false;
    }
    return true;
  }

  static valueOf(ref) {
    // B1:B8, B1 => 1 x 1 cell range
    if (!CellRange.isValidRef(ref)) {
      return new CellRange(0, 0, 0, 0);
    }
    const refs = ref.split(':');
    const [sci, sri] = expr2xy(refs[0]);
    let [eri, eci] = [sri, sci];
    if (refs.length > 1) {
      [eci, eri] = expr2xy(refs[1]);
    }
    return new CellRange(
      Math.min(sri, eri),
      Math.min(sci, eci),
      Math.max(sri, eri),
      Math.max(sci, eci),
    );
  }
}

export default CellRange;

export {
  CellRange,
};
