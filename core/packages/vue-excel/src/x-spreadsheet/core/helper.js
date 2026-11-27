/* eslint-disable no-param-reassign */
function cloneDeep(obj) {
  if (obj === undefined) return undefined;
  return JSON.parse(JSON.stringify(obj));
}

function isPlainObject(v) {
  return Object.prototype.toString.call(v) === '[object Object]';
}

const mergeDeep = (object = {}, ...sources) => {
  if (!object || typeof object !== 'object') object = {};
  sources.forEach((source) => {
    if (!source || typeof source !== 'object') return;
    Object.keys(source).forEach((key) => {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        return;
      }
      const v = source[key];
      if (isPlainObject(v)) {
        if (!isPlainObject(object[key])) {
          object[key] = {};
        }
        mergeDeep(object[key], v);
      } else if (Array.isArray(v)) {
        object[key] = v.slice();
      } else {
        object[key] = v;
      }
    });
  });
  return object;
};

function equals(obj1, obj2) {
  if (obj1 === obj2) return true;
  if (Number.isNaN(obj1) && Number.isNaN(obj2)) return true;
  if (!obj1 || !obj2 || typeof obj1 !== 'object' || typeof obj2 !== 'object') {
    return false;
  }
  if (obj1 instanceof Date || obj2 instanceof Date) {
    return obj1 instanceof Date && obj2 instanceof Date && obj1.getTime() === obj2.getTime();
  }
  if (obj1 instanceof RegExp || obj2 instanceof RegExp) {
    return obj1 instanceof RegExp && obj2 instanceof RegExp
      && obj1.source === obj2.source && obj1.flags === obj2.flags;
  }
  if (Array.isArray(obj1) || Array.isArray(obj2)) {
    if (!Array.isArray(obj1) || !Array.isArray(obj2) || obj1.length !== obj2.length) {
      return false;
    }
    for (let ai = 0; ai < obj1.length; ai += 1) {
      if (!equals(obj1[ai], obj2[ai])) return false;
    }
    return true;
  }
  const keys = Object.keys(obj1);
  if (keys.length !== Object.keys(obj2).length) return false;
  for (let i = 0; i < keys.length; i += 1) {
    const k = keys[i];
    if (!Object.prototype.hasOwnProperty.call(obj2, k)) return false;
    if (!equals(obj1[k], obj2[k])) return false;
  }
  return true;
}

/*
  objOrAry: obejct or Array
  cb: (value, index | key) => { return value }
*/
const sum = (objOrAry, cb = value => value) => {
  let total = 0;
  let size = 0;
  Object.keys(objOrAry).forEach((key) => {
    total += cb(objOrAry[key], key);
    size += 1;
  });
  return [total, size];
};

function deleteProperty(obj, property) {
  const oldv = obj[`${property}`];
  delete obj[`${property}`];
  return oldv;
}

function rangeReduceIf(min, max, inits, initv, ifv, getv) {
  let s = inits;
  let v = initv;
  let i = min;
  for (; i < max; i += 1) {
    if (s > ifv) break;
    v = getv(i);
    s += v;
  }
  return [i, s - v, v];
}

function rangeSum(min, max, getv) {
  let s = 0;
  for (let i = min; i < max; i += 1) {
    s += getv(i);
  }
  return s;
}

function rangeEach(min, max, cb) {
  for (let i = min; i < max; i += 1) {
    cb(i);
  }
}

function arrayEquals(a1, a2) {
  if (!Array.isArray(a1) || !Array.isArray(a2)) return false;
  if (a1.length === a2.length) {
    for (let i = 0; i < a1.length; i += 1) {
      if (a1[i] !== a2[i]) return false;
    }
  } else return false;
  return true;
}

function digits(a) {
  const v = `${a}`.trim();
  const match = v.match(/^[+-]?\d*(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/);
  if (!match) return 0;
  const fracLen = match[1] ? match[1].length : 0;
  const exp = match[2] ? parseInt(match[2], 10) : 0;
  return Math.max(0, fracLen - exp);
}

export function numberCalc(type, a1, a2) {
  const s1 = a1 == null ? '' : String(a1).trim();
  const s2 = a2 == null ? '' : String(a2).trim();
  const num1 = s1 === '' ? 0 : Number(s1);
  const num2 = s2 === '' ? 0 : Number(s2);
  if (Number.isNaN(num1) || Number.isNaN(num2)) {
    return `${a1}${type}${a2}`;
  }
  const al1 = digits(s1 || '0');
  const al2 = digits(s2 || '0');
  let ret = 0;
  let precision = Math.min(Math.max(al1, al2), 100);
  if (type === '-') {
    ret = num1 - num2;
  } else if (type === '+') {
    ret = num1 + num2;
  } else if (type === '*') {
    ret = num1 * num2;
    precision = Math.min(al1 + al2, 100);
  } else if (type === '/') {
    if (num2 === 0) return String(num1 / num2);
    ret = num1 / num2;
    if (!Number.isFinite(ret)) return String(ret);
    const cleanedDiv = Number(ret.toPrecision(15));
    return String(Object.is(cleanedDiv, -0) ? 0 : cleanedDiv);
  }
  if (!Number.isFinite(ret)) return String(ret);
  if (Object.is(ret, -0)) return '0';
  const rounded = ret.toFixed(precision);
  const stripped = rounded.includes('.')
    ? rounded.replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1')
    : rounded;
  return stripped === '-0' ? '0' : stripped;
}

export default {
  cloneDeep,
  merge: (...sources) => mergeDeep({}, ...sources),
  equals,
  arrayEquals,
  sum,
  rangeEach,
  rangeSum,
  rangeReduceIf,
  deleteProperty,
  numberCalc,
};
