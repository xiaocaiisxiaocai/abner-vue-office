export function revokeUrl(url) {
    if (typeof url === 'string' && url.startsWith('blob:') && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(url);
    }
}

export function getUrl(src, options) {
    const canCreateObjectUrl = typeof Blob !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function';
    if (typeof src === 'string') {
        return src;
    } else if (canCreateObjectUrl && src instanceof Blob) {
        return URL.createObjectURL(src);
    } else if (canCreateObjectUrl && (src instanceof ArrayBuffer || ArrayBuffer.isView(src))) {
        return URL.createObjectURL(new Blob([src], options));
    } else {
        return src;
    }
}

export async function getUrlAsync(src, options) {
    const canCreateObjectUrl = typeof Blob !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function';
    if (typeof src === 'string') {
        return src;
    } else if (canCreateObjectUrl && src instanceof Blob) {
        return URL.createObjectURL(src);
    } else if (canCreateObjectUrl && (src instanceof ArrayBuffer || ArrayBuffer.isView(src))) {
        return URL.createObjectURL(new Blob([src], options));
    } else if (canCreateObjectUrl && typeof Response !== 'undefined' && src instanceof Response) {
        return URL.createObjectURL(await src.blob());
    } else {
        return src;
    }
}

export function normalizeFetchOptions(options) {
    if (!options || typeof options !== 'object') {
        return {};
    }
    const fetchOptions = { ...options };
    if (fetchOptions.withCredentials && !fetchOptions.credentials) {
        fetchOptions.credentials = 'include';
    }
    delete fetchOptions.withCredentials;
    delete fetchOptions.responseType;
    if (!fetchOptions.method || (typeof fetchOptions.method === 'string' && /^(get|head)$/i.test(fetchOptions.method.trim()))) {
        delete fetchOptions.body;
    }
    return fetchOptions;
}

export function loadScript(src) {
    return new Promise((resolve, reject) => {
        if (typeof document === 'undefined') {
            reject(new Error(`Failed to load script: ${src}`));
            return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.onload = function () {
            resolve();
        };
        script.onerror = function () {
            if (script.parentNode) {
                script.parentNode.removeChild(script);
            }
            reject(new Error(`Failed to load script: ${src}`));
        };
        const target = document.body || document.head || document.documentElement;
        if (!target) {
            reject(new Error(`Failed to load script: ${src}`));
            return;
        }
        target.appendChild(script);
    });
}

export async function download(filename, data) {
    if (!data || typeof document === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
        return;
    }
    const blob = (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) ? new Blob([data]) : data;
    if (!(blob instanceof Blob)) {
        return;
    }
    const objectUrl = URL.createObjectURL(blob);
    downloadFile(filename, objectUrl);
    setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
    }, 10000);
}

export function downloadFile(filename, href) {
    if (typeof document === 'undefined') {
        return;
    }
    const target = document.body || document.documentElement;
    if (!target) {
        return;
    }
    const eleLink = document.createElement('a');
    eleLink.download = filename;
    eleLink.style.display = 'none';
    eleLink.href = href;
    target.appendChild(eleLink);
    try {
        eleLink.click();
    } finally {
        if (eleLink.parentNode) {
            eleLink.parentNode.removeChild(eleLink);
        }
    }
}
