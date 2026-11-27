import { tf } from '../locale/locale';

const formatStringRender = v => v;

const isNumericText = (v) => {
  if (v === '' || v === null || v === undefined || typeof v === 'boolean') return false;
  const s = String(v).trim();
  if (s === '') return false;
  return Number.isFinite(Number(s));
};

const addThousands = (intPart) => {
  const neg = intPart.startsWith('-');
  const absInt = neg ? intPart.slice(1) : intPart;
  return `${neg ? '-' : ''}${absInt.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,')}`;
};

const normalizeNegZero = (formatted) => (
  typeof formatted === 'string' && /^-[0]+(?:\.[0]+)?$/.test(formatted)
    ? formatted.slice(1)
    : formatted
);

const formatNumberRender = (v) => {
  if (v == null) return '';
  if (isNumericText(v)) {
    const str = String(v).trim();
    const num = Number(str);
    if (Math.abs(num) >= 1e15) {
      if (/^[+-]?\d+(?:\.\d*)?$/.test(str)) {
        const cleanStr = str.startsWith('+') ? str.slice(1) : str;
        const [intPart, decPart = ''] = cleanStr.split('.');
        return normalizeNegZero(`${addThousands(intPart)}.${decPart.slice(0, 2).padEnd(2, '0')}`);
      }
      const fixed = num.toLocaleString('en-US', { useGrouping: false, minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const [intPart, decPart = '00'] = fixed.split('.');
      return normalizeNegZero(`${addThousands(intPart)}.${decPart.padEnd(2, '0')}`);
    }
    const v1 = normalizeNegZero(num.toFixed(2));
    const [first, ...parts] = v1.split('.');
    return [addThousands(first), ...parts].join('.');
  }
  return v;
};

const formatCurrencyRender = (symbol, v) => {
  if (!isNumericText(v)) return v == null ? '' : v;
  const formatted = formatNumberRender(v);
  return String(formatted).startsWith('-')
    ? `-${symbol}${String(formatted).slice(1)}`
    : `${symbol}${formatted}`;
};

const baseFormats = [
  {
    key: 'normal',
    title: tf('format.normal'),
    type: 'string',
    render: formatStringRender,
  },
  {
    key: 'text',
    title: tf('format.text'),
    type: 'string',
    render: formatStringRender,
  },
  {
    key: 'number',
    title: tf('format.number'),
    type: 'number',
    label: '1,000.12',
    render: formatNumberRender,
  },
  {
    key: 'percent',
    title: tf('format.percent'),
    type: 'number',
    label: '10.12%',
    render: v => (isNumericText(v) ? `${String(v).trim()}%` : (v == null ? '' : v)),
  },
  {
    key: 'rmb',
    title: tf('format.rmb'),
    type: 'number',
    label: '￥10.00',
    render: v => formatCurrencyRender('￥', v),
  },
  {
    key: 'usd',
    title: tf('format.usd'),
    type: 'number',
    label: '$10.00',
    render: v => formatCurrencyRender('$', v),
  },
  {
    key: 'eur',
    title: tf('format.eur'),
    type: 'number',
    label: '€10.00',
    render: v => formatCurrencyRender('€', v),
  },
  {
    key: 'date',
    title: tf('format.date'),
    type: 'date',
    label: '26/09/2008',
    render: formatStringRender,
  },
  {
    key: 'time',
    title: tf('format.time'),
    type: 'date',
    label: '15:59:00',
    render: formatStringRender,
  },
  {
    key: 'datetime',
    title: tf('format.datetime'),
    type: 'date',
    label: '26/09/2008 15:59:00',
    render: formatStringRender,
  },
  {
    key: 'duration',
    title: tf('format.duration'),
    type: 'date',
    label: '24:01:00',
    render: formatStringRender,
  },
];

// const formats = (ary = []) => {
//   const map = {};
//   baseFormats.concat(ary).forEach((f) => {
//     map[f.key] = f;
//   });
//   return map;
// };
const formatm = {};
baseFormats.forEach((f) => {
  formatm[f.key] = f;
});

export default {
};
export {
  formatm,
  baseFormats,
};
