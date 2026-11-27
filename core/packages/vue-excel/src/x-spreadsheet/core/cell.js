import { expr2xy, xy2expr } from './alphabet';
import { numberCalc } from './helper';

const MAX_RANGE_CELLS = 100000;

const OP_PRECEDENCE = {
  '=': 1,
  '<>': 1,
  '>': 1,
  '>=': 1,
  '<': 1,
  '<=': 1,
  '+': 2,
  '-': 2,
  '*': 3,
  '/': 3,
  'u-': 4,
  'u+': 4,
};

function expandRange(startRef, endRef, stack) {
  const [sx0, sy0] = expr2xy(startRef);
  const [ex0, ey0] = expr2xy(endRef);
  if (Number.isNaN(sx0) || Number.isNaN(sy0) || Number.isNaN(ex0) || Number.isNaN(ey0)
    || sx0 < 0 || sy0 < 0 || ex0 < 0 || ey0 < 0) {
    throw new Error(`Invalid cell range: ${startRef}:${endRef}`);
  }
  const sx = Math.min(sx0, ex0);
  const ex = Math.max(sx0, ex0);
  const sy = Math.min(sy0, ey0);
  const ey = Math.max(sy0, ey0);
  const total = (ex - sx + 1) * (ey - sy + 1);
  if (total > MAX_RANGE_CELLS) {
    throw new Error(`Cell range too large: ${total}`);
  }
  let count = 0;
  for (let x = sx; x <= ex; x += 1) {
    for (let y = sy; y <= ey; y += 1) {
      stack.push(xy2expr(x, y));
      count += 1;
    }
  }
  return count;
}

const isBinaryOrCompareOp = tok => (
  typeof tok === 'string' && Object.prototype.hasOwnProperty.call(OP_PRECEDENCE, tok)
);

const infixExprToSuffixExpr = (src) => {
  const operatorStack = [];
  const stack = [];
  const callStack = [];
  let expectUnary = true;
  let i = 0;
  const len = src.length;

  const isTopOpFn = () => {
    for (let k = operatorStack.length - 1; k >= 0; k -= 1) {
      const top = operatorStack[k];
      if (top === '(') return false;
      if (typeof top === 'object' && top.type === 'fn') return true;
    }
    return false;
  };

  const markArgStarted = () => {
    if (callStack.length > 0 && isTopOpFn()) {
      const frame = callStack[callStack.length - 1];
      if (frame.expectFirstArg) {
        frame.expectFirstArg = false;
        frame.argCount = 1;
      }
      frame.expectArg = false;
    }
  };

  const flushRange = () => {
    if (operatorStack.length > 0 && operatorStack[operatorStack.length - 1] === ':') {
      operatorStack.pop();
      const endRef = stack.pop();
      const startRef = stack.pop();
      const rangeCount = expandRange(startRef, endRef, stack);
      if (callStack.length > 0 && isTopOpFn()) {
        const frame = callStack[callStack.length - 1];
        frame.argCount += rangeCount - 1;
      }
    }
  };

  while (i < len) {
    const c = src.charAt(i);
    if (c === ' ' || c === '\t' || c === '\r' || c === '\n') {
      i += 1;
    } else if (c === '"') {
      i += 1;
      let str = '';
      let closed = false;
      while (i < len) {
        const ch = src.charAt(i);
        if (ch === '"') {
          if (src.charAt(i + 1) === '"') {
            str += '"';
            i += 2;
            continue;
          }
          i += 1;
          closed = true;
          break;
        }
        str += ch;
        i += 1;
      }
      if (!closed) {
        throw new Error('Unclosed string literal');
      }
      stack.push(`"${str}`);
      markArgStarted();
      expectUnary = false;
    } else if ((c >= '0' && c <= '9') || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '.' || c === '$') {
      let token = '';
      while (i < len) {
        const ch = src.charAt(i);
        if ((ch >= '0' && ch <= '9') || (ch >= 'A' && ch <= 'Z') || ch === '.' || ch === '$') {
          token += ch;
          i += 1;
        } else if (ch >= 'a' && ch <= 'z') {
          token += ch.toUpperCase();
          i += 1;
        } else if ((ch === '+' || ch === '-')
          && /^(?:\d+(?:\.\d*)?|\.\d+)E$/.test(token)
          && src.charAt(i + 1) >= '0' && src.charAt(i + 1) <= '9') {
          token += ch;
          i += 1;
        } else {
          break;
        }
      }
      let look = i;
      while (look < len && (src.charAt(look) === ' ' || src.charAt(look) === '\t' || src.charAt(look) === '\r' || src.charAt(look) === '\n')) {
        look += 1;
      }
      if (look < len && src.charAt(look) === '(') {
        i = look;
        markArgStarted();
        operatorStack.push({ type: 'fn', name: token });
        callStack.push({ name: token, argCount: 0, expectFirstArg: true, expectArg: true });
        i += 1;
        expectUnary = true;
      } else {
        stack.push(token);
        markArgStarted();
        expectUnary = false;
      }
    } else if (c === '(') {
      markArgStarted();
      operatorStack.push('(');
      i += 1;
      expectUnary = true;
    } else if (c === ')') {
      const directFnOpener = operatorStack.length > 0
        && typeof operatorStack[operatorStack.length - 1] === 'object'
        && operatorStack[operatorStack.length - 1].type === 'fn';
      if (directFnOpener && callStack.length > 0) {
        const frame = callStack[callStack.length - 1];
        if (!frame.expectFirstArg && frame.expectArg) {
          stack.push('"');
          frame.expectArg = false;
        }
      } else if (expectUnary) {
        throw new Error('Unexpected closing parenthesis');
      }
      while (operatorStack.length > 0) {
        const top = operatorStack[operatorStack.length - 1];
        if (top === ':') {
          flushRange();
        } else if (top === '(' || (typeof top === 'object' && top.type === 'fn')) {
          break;
        } else {
          stack.push(operatorStack.pop());
        }
      }
      if (operatorStack.length === 0) {
        throw new Error('Unexpected closing parenthesis');
      }
      const opener = operatorStack.pop();
      if (typeof opener === 'object' && opener.type === 'fn') {
        const frame = callStack.pop();
        stack.push([opener.name, frame ? frame.argCount : 0]);
      }
      i += 1;
      expectUnary = false;
    } else if (c === ',') {
      if (!isTopOpFn() || callStack.length === 0) {
        throw new Error('Unexpected comma');
      }
      const frame = callStack[callStack.length - 1];
      if (frame.expectArg) {
        stack.push('"');
        if (frame.expectFirstArg) {
          frame.expectFirstArg = false;
          frame.argCount = 1;
        }
      } else if (expectUnary) {
        throw new Error('Unexpected comma');
      }
      while (operatorStack.length > 0) {
        const top = operatorStack[operatorStack.length - 1];
        if (top === ':') {
          flushRange();
        } else if (top === '(' || (typeof top === 'object' && top.type === 'fn')) {
          break;
        } else {
          stack.push(operatorStack.pop());
        }
      }
      frame.argCount += 1;
      frame.expectFirstArg = false;
      frame.expectArg = true;
      i += 1;
      expectUnary = true;
    } else if (c === ':') {
      if (expectUnary || (operatorStack.length > 0 && operatorStack[operatorStack.length - 1] === ':')) {
        throw new Error('Unexpected range operator');
      }
      operatorStack.push(':');
      i += 1;
      expectUnary = true;
    } else if ((c === '-' || c === '+') && expectUnary) {
      markArgStarted();
      operatorStack.push(c === '-' ? 'u-' : 'u+');
      i += 1;
      expectUnary = true;
    } else {
      markArgStarted();
      let op = c;
      if (c === '>' || c === '<' || c === '=') {
        const nc = src.charAt(i + 1);
        if ((c === '>' && nc === '=') || (c === '<' && (nc === '=' || nc === '>'))) {
          op = c + nc;
          i += 2;
        } else {
          i += 1;
        }
      } else {
        i += 1;
      }
      if (op === ':' || isBinaryOrCompareOp(op)) {
        const prec = OP_PRECEDENCE[op];
        while (operatorStack.length > 0) {
          const top = operatorStack[operatorStack.length - 1];
          if (top === ':') {
            flushRange();
          } else if (isBinaryOrCompareOp(top) && OP_PRECEDENCE[top] >= prec) {
            stack.push(operatorStack.pop());
          } else {
            break;
          }
        }
        operatorStack.push(op);
      } else {
        throw new Error(`Unsupported token: ${op}`);
      }
      expectUnary = true;
    }
  }

  while (operatorStack.length > 0) {
    const top = operatorStack[operatorStack.length - 1];
    if (top === ':') {
      flushRange();
    } else if (top === '(' || (typeof top === 'object' && top.type === 'fn')) {
      throw new Error('Unclosed parenthesis');
    } else {
      stack.push(operatorStack.pop());
    }
  }
  return stack;
};

const evalSubExpr = (subExpr, cellRender, unarySign = 1) => {
  const [fl] = subExpr;
  if (fl === '"') {
    const strVal = subExpr.substring(1);
    return unarySign === -1 ? -Number(strVal) : strVal;
  }
  let expr = subExpr;
  let sign = unarySign;
  if (fl === '-') {
    expr = subExpr.substring(1);
    sign = -sign;
  }
  if (expr === 'TRUE' || expr === 'FALSE') {
    const boolVal = expr === 'TRUE';
    return sign === -1 ? (boolVal ? -1 : 0) : boolVal;
  }
  if ((expr[0] >= '0' && expr[0] <= '9') || expr[0] === '.') {
    const numVal = Number(expr);
    if (Number.isNaN(numVal)) {
      throw new Error(`Invalid number literal: ${expr}`);
    }
    return sign === -1 ? -numVal : numVal;
  }
  const [x, y] = expr2xy(expr);
  if (Number.isNaN(x) || Number.isNaN(y) || x < 0 || y < 0) {
    throw new Error(`Invalid cell reference: ${expr}`);
  }
  const rendered = cellRender(x, y);
  if (sign === -1) {
    const neg = -Number(rendered);
    return neg === 0 ? 0 : neg;
  }
  return rendered;
};

const toComparable = (v) => {
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) {
    return Number(v);
  }
  return v;
};

const evalSuffixExpr = (srcStack, formulaMap, cellRender, cellList) => {
  const stack = [];
  for (let i = 0; i < srcStack.length; i += 1) {
    const expr = srcStack[i];
    if (expr === '+' || expr === '-' || expr === '*' || expr === '/'
      || expr === '=' || expr === '<>' || expr === '>' || expr === '>=' || expr === '<' || expr === '<=') {
      if (stack.length < 2) {
        throw new Error(`Missing operand for operator: ${expr}`);
      }
      if (expr === '+' || expr === '-' || expr === '*' || expr === '/') {
        const right = stack.pop();
        stack.push(numberCalc(expr, stack.pop(), right));
      } else {
        const right = toComparable(stack.pop());
        const left = toComparable(stack.pop());
        let ret = false;
        if (expr === '=') ret = (left === right);
        else if (expr === '<>') ret = (left !== right);
        else if (expr === '>') ret = (left > right);
        else if (expr === '>=') ret = (left >= right);
        else if (expr === '<') ret = (left < right);
        else if (expr === '<=') ret = (left <= right);
        stack.push(ret);
      }
    } else if (expr === 'u-' || expr === 'u+') {
      if (stack.length < 1) {
        throw new Error(`Missing operand for unary operator: ${expr}`);
      }
      const top = stack.pop();
      if (expr === 'u-') {
        const n = Number(top);
        stack.push(Number.isNaN(n) ? NaN : (n === 0 ? 0 : -n));
      } else {
        stack.push(typeof top === 'string' && top.trim() !== '' && !Number.isNaN(Number(top)) ? Number(top) : top);
      }
    } else if (Array.isArray(expr)) {
      const [formula, len] = expr;
      if (stack.length < len) {
        throw new Error(`Missing arguments for formula: ${formula}`);
      }
      const params = [];
      for (let j = 0; j < len; j += 1) {
        params.push(stack.pop());
      }
      if (!formulaMap[formula] || typeof formulaMap[formula].render !== 'function') {
        throw new Error(`Unknown formula: ${formula}`);
      }
      stack.push(formulaMap[formula].render(params.reverse()));
    } else {
      const exprStr = String(expr);
      const fc = exprStr[0];
      const stripped = fc === '-' ? exprStr.substring(1) : exprStr;
      const sc = stripped[0];
      const rawNormalizedRef = stripped.replace(/\$/g, '').toUpperCase();
      const isCellRef = stripped !== '' && sc !== '"' && !((sc >= '0' && sc <= '9')) && sc !== '.'
        && rawNormalizedRef !== 'TRUE' && rawNormalizedRef !== 'FALSE'
        && ((sc >= 'A' && sc <= 'Z') || (sc >= 'a' && sc <= 'z') || sc === '$');
      let normalizedRef = rawNormalizedRef;
      if (isCellRef) {
        const [rx, ry] = expr2xy(stripped);
        if (!Number.isNaN(rx) && !Number.isNaN(ry) && rx >= 0 && ry >= 0) {
          normalizedRef = xy2expr(rx, ry);
        }
      }
      if (isCellRef && cellList.includes(normalizedRef)) {
        stack.push(0);
        continue;
      }
      if (isCellRef) {
        cellList.push(normalizedRef);
      }
      try {
        stack.push(evalSubExpr(exprStr, cellRender));
      } finally {
        if (isCellRef) {
          cellList.pop();
        }
      }
    }
  }
  if (stack.length !== 1) {
    throw new Error('Malformed formula expression');
  }
  return stack[0];
};

const cellRender = (src, formulaMap, getCellText, cellList = [], selfRef = null) => {
  if (typeof src === 'string' && src[0] === '=') {
    const normalizedSelf = typeof selfRef === 'string' && selfRef ? selfRef.replace(/\$/g, '').toUpperCase() : null;
    const pushedSelf = Boolean(normalizedSelf && cellList.length === 0);
    if (pushedSelf) {
      cellList.push(normalizedSelf);
    }
    try {
      const stack = infixExprToSuffixExpr(src.substring(1));
      if (stack.length <= 0) return src;
      const evaluated = evalSuffixExpr(
        stack,
        formulaMap,
        (x, y) => cellRender(getCellText(x, y), formulaMap, getCellText, cellList),
        cellList,
      );
      return evaluated === undefined ? src : evaluated;
    } catch (e) {
      return src;
    } finally {
      if (pushedSelf) {
        cellList.pop();
      }
    }
  }
  return src;
};

export default {
  render: cellRender,
};
export {
  infixExprToSuffixExpr,
};
