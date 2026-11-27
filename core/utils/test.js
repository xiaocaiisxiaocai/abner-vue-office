function hasTruthyTestParam(query) {
    if (!query) {
        return false;
    }
    const params = new URLSearchParams(query);
    if (!params.has('test')) {
        return false;
    }
    const val = (params.get('test') || '').trim().toLowerCase();
    return val !== '0' && val !== 'false';
}

export function isTest() {
    if (typeof location === 'undefined') {
        return false;
    }
    if (typeof location.search === 'string' && location.search) {
        if (hasTruthyTestParam(location.search)) {
            return true;
        }
    }
    if (typeof location.hash === 'string') {
        const qIndex = location.hash.indexOf('?');
        if (qIndex !== -1 && hasTruthyTestParam(location.hash.slice(qIndex + 1))) {
            return true;
        }
    }
    if (!location.search && !location.hash && typeof location.href === 'string') {
        const qIndex = location.href.indexOf('?');
        if (qIndex !== -1 && hasTruthyTestParam(location.href.slice(qIndex + 1))) {
            return true;
        }
    }
    return false;
}
