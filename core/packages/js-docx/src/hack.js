if (typeof window !== 'undefined' && typeof window.setImmediate === 'undefined') {
    window.setImmediate = function (func, ...args) {
        return setTimeout(() => func(...args));
    };
}

export default {};
