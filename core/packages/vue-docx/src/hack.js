//乾坤下不能渲染问题兼容
if (typeof window !== 'undefined' && typeof window.setImmediate === 'undefined') {
    window.setImmediate = function (func, ...args) {
        return setTimeout(() => func(...args));
    };
    if (typeof window.clearImmediate === 'undefined') {
        window.clearImmediate = clearTimeout;
    }
}

export default {};
