// src: include chars: [0-9], +, -, *, /, (, )
// 9+(3-1)*3+10/2 => 9 3 1-3*+ 10 2/+
const OP_PREC = {
  '+': 1,
  '-': 1,
  '*': 2,
  '/': 2,
};

const infix2suffix = (src) => {
  const operatorStack = [];
  const stack = [];
  let numBuf = '';
  const flushNum = () => {
    if (numBuf.length > 0) {
      stack.push(numBuf);
      numBuf = '';
    }
  };
  for (let i = 0; i < src.length; i += 1) {
    const c = src.charAt(i);
    if (c === ' ') {
      flushNum();
      continue;
    }
    if ((c >= '0' && c <= '9') || c === '.') {
      numBuf += c;
    } else if (c === '(') {
      flushNum();
      operatorStack.push(c);
    } else if (c === ')') {
      flushNum();
      while (operatorStack.length > 0) {
        const c1 = operatorStack.pop();
        if (c1 === '(') break;
        stack.push(c1);
      }
    } else if (OP_PREC[c]) {
      flushNum();
      while (operatorStack.length > 0) {
        const last = operatorStack[operatorStack.length - 1];
        if (last === '(' || !OP_PREC[last] || OP_PREC[last] < OP_PREC[c]) {
          break;
        }
        stack.push(operatorStack.pop());
      }
      operatorStack.push(c);
    }
  }
  flushNum();
  while (operatorStack.length > 0) {
    const op = operatorStack.pop();
    if (op !== '(') stack.push(op);
  }
  return stack;
};

export default {
  infix2suffix,
};
