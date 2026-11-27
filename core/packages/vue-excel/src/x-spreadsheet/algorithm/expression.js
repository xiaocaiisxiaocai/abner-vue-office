// src: include chars: [0-9], +, -, *, /, (, )
// 9+(3-1)*3+10/2 => 9 3 1-3*+ 10 2/+
const OP_PREC = {
  '+': 1,
  '-': 1,
  '*': 2,
  '/': 2,
  'u-': 3,
};

const infix2suffix = (src) => {
  if (typeof src !== 'string') return [];
  const operatorStack = [];
  const stack = [];
  let numBuf = '';
  let expectUnary = true;
  const flushNum = () => {
    if (numBuf.length > 0) {
      stack.push(numBuf);
      numBuf = '';
    }
  };
  const pushOpToStack = (op) => {
    stack.push(op === 'u-' ? '-' : op);
  };
  for (let i = 0; i < src.length; i += 1) {
    const c = src.charAt(i);
    if (/\s/.test(c)) {
      flushNum();
      continue;
    }
    if ((c >= '0' && c <= '9') || c === '.') {
      numBuf += c;
      expectUnary = false;
    } else if (c === '(') {
      flushNum();
      operatorStack.push(c);
      expectUnary = true;
    } else if (c === ')') {
      flushNum();
      while (operatorStack.length > 0) {
        const c1 = operatorStack.pop();
        if (c1 === '(') break;
        pushOpToStack(c1);
      }
      expectUnary = false;
    } else if (OP_PREC[c]) {
      if (expectUnary && (c === '-' || c === '+')) {
        if (c === '-') {
          const nextImmediate = src.charAt(i + 1);
          if (numBuf.length === 0 && ((nextImmediate >= '0' && nextImmediate <= '9') || nextImmediate === '.')) {
            numBuf = '-';
          } else {
            let look = i + 1;
            while (look < src.length && /\s/.test(src.charAt(look))) look += 1;
            const ahead = src.charAt(look);
            if (ahead && ((ahead >= '0' && ahead <= '9') || ahead === '.' || ahead === '(' || ahead === '-' || ahead === '+')) {
              stack.push('0');
              operatorStack.push('u-');
            }
          }
        }
        continue;
      }
      flushNum();
      while (operatorStack.length > 0) {
        const last = operatorStack[operatorStack.length - 1];
        if (last === '(' || !OP_PREC[last] || OP_PREC[last] < OP_PREC[c]) {
          break;
        }
        pushOpToStack(operatorStack.pop());
      }
      operatorStack.push(c);
      expectUnary = true;
    } else {
      flushNum();
    }
  }
  flushNum();
  while (operatorStack.length > 0) {
    const op = operatorStack.pop();
    if (op !== '(') pushOpToStack(op);
  }
  return stack;
};

export default {
  infix2suffix,
};
