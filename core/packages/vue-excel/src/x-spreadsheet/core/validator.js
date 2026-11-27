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
    if (type === 'date') {
      return new Date(v).getTime();
    }
    if (type === 'number') {
      return Number(v);
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
    if (rules[type] && !rules[type].test(str)) {
      return returnMessage(false, 'notMatch');
    }
    if (type === 'list') {
      return returnMessage(this.values().includes(str), 'notIn');
    }
    if (operator) {
      const v1 = this.parseValue(str);
      if ((type === 'number' || type === 'date') && Number.isNaN(v1)) {
        return returnMessage(false, 'notMatch');
      }
      if (operator === 'be') {
        if (!Array.isArray(value) || value.length < 2) return [false, ''];
        const [min, max] = value;
        return returnMessage(
          v1 >= this.parseValue(min) && v1 <= this.parseValue(max),
          'between',
          min,
          max,
        );
      }
      if (operator === 'nbe') {
        if (!Array.isArray(value) || value.length < 2) return [false, ''];
        const [min, max] = value;
        return returnMessage(
          v1 < this.parseValue(min) || v1 > this.parseValue(max),
          'notBetween',
          min,
          max,
        );
      }
      if (operator === 'eq') {
        return returnMessage(
          v1 === this.parseValue(value),
          'equal',
          value,
        );
      }
      if (operator === 'neq') {
        return returnMessage(
          v1 !== this.parseValue(value),
          'notEqual',
          value,
        );
      }
      if (operator === 'lt') {
        return returnMessage(
          v1 < this.parseValue(value),
          'lessThan',
          value,
        );
      }
      if (operator === 'lte') {
        return returnMessage(
          v1 <= this.parseValue(value),
          'lessThanEqual',
          value,
        );
      }
      if (operator === 'gt') {
        return returnMessage(
          v1 > this.parseValue(value),
          'greaterThan',
          value,
        );
      }
      if (operator === 'gte') {
        return returnMessage(
          v1 >= this.parseValue(value),
          'greaterThanEqual',
          value,
        );
      }
    }
    return [true];
  }
}
