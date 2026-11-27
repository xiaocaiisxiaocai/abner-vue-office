import { t } from '../locale/locale';
import helper from './helper';

const rules = {
  phone: /^[1-9]\d{10}$/,
  email: /^\w+([-+.]\w+)*@\w+([-.]\w+)*\.\w+([-.]\w+)*$/,
};

function returnMessage(flag, key, ...arg) {
  let message = '';
  if (!flag) {
    message = t(`validation.${key}`, ...arg);
  }
  return [flag, message];
}

export default class Validator {
  // operator: be|nbe|eq|neq|lt|lte|gt|gte
  // type: date|number|list|phone|email
  constructor(type, required, value, operator) {
    this.required = required;
    this.value = value;
    this.type = type;
    this.operator = operator;
    this.message = '';
  }

  parseValue(v) {
    const { type } = this;
    if (v === '' || v == null) {
      return NaN;
    }
    if (type === 'date') {
      if (v instanceof Date) return v.getTime();
      const s = String(v).trim();
      if (!s) return NaN;
      const isoDateOnly = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (isoDateOnly) {
        return new Date(Number(isoDateOnly[1]), Number(isoDateOnly[2]) - 1, Number(isoDateOnly[3])).getTime();
      }
      const slashDateOnly = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
      if (slashDateOnly) {
        return new Date(Number(slashDateOnly[1]), Number(slashDateOnly[2]) - 1, Number(slashDateOnly[3])).getTime();
      }
      return new Date(s).getTime();
    }
    if (type === 'number') {
      const s = String(v).trim();
      if (!s) return NaN;
      return Number(s);
    }
    return v;
  }

  equals(other) {
    if (!other) return false;
    let flag = this.type === other.type
      && this.required === other.required
      && this.operator === other.operator;
    if (flag) {
      if (Array.isArray(this.value)) {
        flag = helper.arrayEquals(this.value, other.value);
      } else {
        flag = this.value === other.value;
      }
    }
    return flag;
  }

  values() {
    if (Array.isArray(this.value)) {
      return this.value.map(v => String(v));
    }
    return typeof this.value === 'string' ? this.value.split(',') : [];
  }

  validate(v) {
    const {
      required, operator, value, type,
    } = this;
    const str = v == null ? '' : String(v);
    if (required && /^\s*$/.test(str)) {
      return returnMessage(false, 'required');
    }
    if (/^\s*$/.test(str)) return [true];
    if (Object.prototype.hasOwnProperty.call(rules, type) && !rules[type].test(str)) {
      return returnMessage(false, 'notMatch');
    }
    if (type === 'list') {
      return returnMessage(this.values().includes(str), 'notIn');
    }
    if (type === 'number' || type === 'date') {
      const v1 = this.parseValue(str);
      if (Number.isNaN(v1)) {
        return returnMessage(false, 'notMatch');
      }
      if (!operator) {
        return [true];
      }
      if (operator === 'be') {
        if (!Array.isArray(value) || value.length < 2) return [false, ''];
        const [min, max] = value;
        const pMin = this.parseValue(min);
        const pMax = this.parseValue(max);
        if (Number.isNaN(pMin) || Number.isNaN(pMax)) return returnMessage(false, 'notMatch');
        return returnMessage(
          v1 >= pMin && v1 <= pMax,
          'between',
          min,
          max,
        );
      }
      if (operator === 'nbe') {
        if (!Array.isArray(value) || value.length < 2) return [false, ''];
        const [min, max] = value;
        const pMin = this.parseValue(min);
        const pMax = this.parseValue(max);
        if (Number.isNaN(pMin) || Number.isNaN(pMax)) return returnMessage(false, 'notMatch');
        return returnMessage(
          v1 < pMin || v1 > pMax,
          'notBetween',
          min,
          max,
        );
      }
      const pVal = this.parseValue(value);
      if (Number.isNaN(pVal)) {
        return returnMessage(false, 'notMatch');
      }
      if (operator === 'eq') {
        return returnMessage(v1 === pVal, 'equal', value);
      }
      if (operator === 'neq') {
        return returnMessage(v1 !== pVal, 'notEqual', value);
      }
      if (operator === 'lt') {
        return returnMessage(v1 < pVal, 'lessThan', value);
      }
      if (operator === 'lte') {
        return returnMessage(v1 <= pVal, 'lessThanEqual', value);
      }
      if (operator === 'gt') {
        return returnMessage(v1 > pVal, 'greaterThan', value);
      }
      if (operator === 'gte') {
        return returnMessage(v1 >= pVal, 'greaterThanEqual', value);
      }
      return returnMessage(false, 'notMatch');
    }
    if (operator) {
      return returnMessage(false, 'notMatch');
    }
    return [true];
  }
}
