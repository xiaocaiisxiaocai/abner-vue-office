if (typeof window !== 'undefined' && typeof window.setImmediate === 'undefined') {
    window.setImmediate = function (func, ...args) {
        return setTimeout(() => func(...args));
    };
    if (typeof window.clearImmediate === 'undefined') {
        window.clearImmediate = function (id) {
            return clearTimeout(id);
        };
    }
}

export default {};
