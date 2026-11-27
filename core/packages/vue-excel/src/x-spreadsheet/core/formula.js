/**
  formula:
    key
    title
    render
*/
/**
 * @typedef {object} Formula
 * @property {string} key
 * @property {function} title
 * @property {function} render
 */
import { tf } from '../locale/locale';
import { numberCalc } from './helper';

function toNumericValues(ary) {
  const nums = [];
  for (let i = 0; i < ary.length; i += 1) {
    const v = ary[i];
    if (typeof v === 'number') {
      if (Number.isFinite(v)) nums.push(v);
    } else if (typeof v === 'string') {
      const trimmed = v.trim();
      if (trimmed !== '') {
        const n = Number(trimmed);
        if (Number.isFinite(n)) nums.push(n);
      }
    }
  }
  return nums;
}

/** @type {Formula[]} */
const baseFormulas = [
  {
    key: 'SUM',
    title: tf('formula.sum'),
    render: (ary) => {
      const nums = toNumericValues(ary);
      if (nums.length === 0) return '0';
      return nums.reduce((a, b) => numberCalc('+', a, b), 0);
    },
  },
  {
    key: 'AVERAGE',
    title: tf('formula.average'),
    render: (ary) => {
      const nums = toNumericValues(ary);
      if (nums.length === 0) return 0;
      const total = nums.reduce((a, b) => a + b, 0);
      return total / nums.length;
    },
  },
  {
    key: 'MAX',
    title: tf('formula.max'),
    render: (ary) => {
      const nums = toNumericValues(ary);
      if (nums.length === 0) return 0;
      let maxVal = nums[0];
      for (let i = 1; i < nums.length; i += 1) {
        if (nums[i] > maxVal) maxVal = nums[i];
      }
      return maxVal;
    },
  },
  {
    key: 'MIN',
    title: tf('formula.min'),
    render: (ary) => {
      const nums = toNumericValues(ary);
      if (nums.length === 0) return 0;
      let minVal = nums[0];
      for (let i = 1; i < nums.length; i += 1) {
        if (nums[i] < minVal) minVal = nums[i];
      }
      return minVal;
    },
  },
  {
    key: 'IF',
    title: tf('formula._if'),
    render: ([b, t = true, f = false]) => (b ? t : f),
  },
  {
    key: 'AND',
    title: tf('formula.and'),
    render: ary => ary.every(it => it),
  },
  {
    key: 'OR',
    title: tf('formula.or'),
    render: ary => ary.some(it => it),
  },
  {
    key: 'CONCAT',
    title: tf('formula.concat'),
    render: ary => ary.map(v => (v == null ? '' : String(v))).join(''),
  },
];

const formulas = baseFormulas;

const formulam = {};
baseFormulas.forEach((f) => {
  formulam[f.key] = f;
});

export default {
};

export {
  formulam,
  formulas,
  baseFormulas,
};
