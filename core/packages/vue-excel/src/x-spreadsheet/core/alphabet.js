import './_.prototypes';

const alphabets = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];

/** index number 2 letters
 * @example stringAt(26) ==> 'AA'
 * @date 2019-10-10
 * @export
 * @param {number} index
 * @returns {string}
 */
export function stringAt(index) {
  if (!Number.isInteger(index) || index < 0) return '';
  let str = '';
  let cindex = index;
  while (cindex >= 0) {
    str = alphabets[cindex % alphabets.length] + str;
    cindex = Math.floor(cindex / alphabets.length) - 1;
  }
  return str;
}

/** translate letter in A1-tag to number
 * @date 2019-10-10
 * @export
 * @param {string} str "AA" in A1-tag "AA1"
 * @returns {number}
 */
export function indexAt(str) {
  if (typeof str !== 'string') return NaN;
  const upper = str.toUpperCase();
  if (!/^[A-Z]+$/.test(upper)) return NaN;
  let ret = 0;
  for (let i = 0; i !== upper.length; i += 1) {
    ret = 26 * ret + upper.charCodeAt(i) - 64;
  }
  return ret - 1;
}

// B10 => x,y
/** translate A1-tag to XY-tag
 * @date 2019-10-10
 * @export
 * @param {tagA1} src
 * @returns {tagXY}
 */
export function expr2xy(src) {
  if (typeof src !== 'string') return [NaN, NaN];
  const match = src.trim().match(/^\$?([A-Za-z]+)\$?(\d+)$/);
  if (!match) return [NaN, NaN];
  const y = parseInt(match[2], 10) - 1;
  if (y < 0) return [NaN, NaN];
  return [indexAt(match[1]), y];
}

/** translate XY-tag to A1-tag
 * @example x,y => B10
 * @date 2019-10-10
 * @export
 * @param {number} x
 * @param {number} y
 * @returns {tagA1}
 */
export function xy2expr(x, y) {
  return `${stringAt(x)}${y + 1}`;
}

/** translate A1-tag src by (xn, yn)
 * @date 2019-10-10
 * @export
 * @param {tagA1} src
 * @param {number} xn
 * @param {number} yn
 * @returns {tagA1}
 */
export function expr2expr(src, xn, yn, condition = () => true, ignoreAbs = false) {
  if (xn === 0 && yn === 0) return src;
  if (typeof src !== 'string') return src;
  const match = src.trim().match(/^(\$?)([A-Za-z]+)(\$?)(\d+)$/);
  if (!match) return src;
  const [, absCol, colStr, absRow, rowStr] = match;
  const x = indexAt(colStr);
  const y = parseInt(rowStr, 10) - 1;
  if (Number.isNaN(x) || Number.isNaN(y) || x < 0 || y < 0) return src;
  if (!condition(x, y)) return src;
  const nx = (absCol && !ignoreAbs) ? x : x + xn;
  const ny = (absRow && !ignoreAbs) ? y : y + yn;
  if (nx < 0 || ny < 0) return src;
  return `${absCol}${stringAt(nx)}${absRow}${ny + 1}`;
}

export default {
  stringAt,
  indexAt,
  expr2xy,
  xy2expr,
  expr2expr,
};
