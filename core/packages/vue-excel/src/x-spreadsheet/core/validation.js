import Validator from './validator';
import { CellRange } from './cell_range';

class Validation {
  constructor(mode, refs, validator) {
    this.refs = refs;
    this.mode = mode; // cell
    this.validator = validator;
  }

  includes(ri, ci) {
    const { refs } = this;
    for (let i = 0; i < refs.length; i += 1) {
      if (!CellRange.isValidRef(refs[i])) continue;
      const cr = CellRange.valueOf(refs[i]);
      if (cr.includes(ri, ci)) return true;
    }
    return false;
  }

  addRef(ref) {
    if (!CellRange.isValidRef(ref)) return;
    this.remove(CellRange.valueOf(ref));
    this.refs.push(ref);
  }

  remove(cellRange) {
    const nrefs = [];
    this.refs.forEach((it) => {
      if (!CellRange.isValidRef(it)) return;
      const cr = CellRange.valueOf(it);
      if (cr.intersects(cellRange)) {
        const crs = cr.difference(cellRange);
        crs.forEach(it1 => nrefs.push(it1.toString()));
      } else {
        nrefs.push(it);
      }
    });
    this.refs = nrefs;
  }

  getData() {
    const { refs, mode, validator } = this;
    const {
      type, required, operator, value,
    } = validator;
    return {
      refs: refs.slice(),
      mode,
      type,
      required,
      operator,
      value: Array.isArray(value) ? value.slice() : value,
    };
  }

  static valueOf(d) {
    if (!d || typeof d !== 'object') {
      return null;
    }
    const {
      refs, mode, type, required, operator, value,
    } = d;
    const clonedValue = Array.isArray(value) ? value.slice() : value;
    const validRefs = Array.isArray(refs) ? refs.filter(r => CellRange.isValidRef(r)) : [];
    return new Validation(mode, validRefs, new Validator(type, required, clonedValue, operator));
  }
}

class Validations {
  constructor() {
    this._ = [];
    // ri_ci: errMessage
    this.errors = new Map();
  }

  getError(ri, ci) {
    return this.errors.get(`${ri}_${ci}`);
  }

  validate(ri, ci, text) {
    const v = this.get(ri, ci);
    const key = `${ri}_${ci}`;
    const { errors } = this;
    if (v !== null) {
      const [flag, message] = v.validator.validate(text);
      if (!flag) {
        errors.set(key, message);
        return false;
      }
      errors.delete(key);
    } else {
      errors.delete(key);
    }
    return true;
  }

  // type: date|number|phone|email|list
  // validator: { required, value, operator }
  add(mode, ref, validatorOpts = {}) {
    if (!CellRange.isValidRef(ref) || !validatorOpts || typeof validatorOpts !== 'object') {
      return;
    }
    const {
      type, required, value, operator,
    } = validatorOpts;
    const clonedValue = Array.isArray(value) ? value.slice() : value;
    this.remove(CellRange.valueOf(ref));
    const validator = new Validator(
      type, required, clonedValue, operator,
    );
    const v = this.getByValidator(validator, mode);
    if (v !== null) {
      v.addRef(ref);
    } else {
      this._.push(new Validation(mode, [ref], validator));
    }
  }

  getByValidator(validator, mode) {
    for (let i = 0; i < this._.length; i += 1) {
      const v = this._[i];
      if ((mode === undefined || v.mode === mode) && v.validator.equals(validator)) {
        return v;
      }
    }
    return null;
  }

  get(ri, ci) {
    for (let i = 0; i < this._.length; i += 1) {
      const v = this._[i];
      if (v.includes(ri, ci)) return v;
    }
    return null;
  }

  remove(cellRange) {
    this.each((it) => {
      it.remove(cellRange);
    });
    this._ = this._.filter(it => it.refs.length > 0);
    for (const key of Array.from(this.errors.keys())) {
      const [riStr, ciStr] = key.split('_');
      if (cellRange.includes(parseInt(riStr, 10), parseInt(ciStr, 10))) {
        this.errors.delete(key);
      }
    }
  }

  each(cb) {
    this._.forEach(it => cb(it));
  }

  getData() {
    return this._.filter(it => it.refs.length > 0).map(it => it.getData());
  }

  setData(d) {
    this.errors.clear();
    this._ = Array.isArray(d) ? d.map(it => Validation.valueOf(it)).filter(Boolean) : [];
  }
}

export default {};
export {
  Validations,
};
