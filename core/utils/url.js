export function revokeUrl(url) {
    if (typeof url === 'string' && url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
    }
}

export function getUrl(src, options) {
    if (typeof src === 'string') {
        return src;
    } else if (src instanceof Blob) {
        return URL.createObjectURL(src);
    } else if (src instanceof ArrayBuffer || ArrayBuffer.isView(src)) {
        return URL.createObjectURL(new Blob([src], options));
    } else {
        return src;
    }
}

export async function getUrlAsync(src, options) {
    if (typeof src === 'string') {
        return src;
    } else if (src instanceof Blob) {
        return URL.createObjectURL(src);
    } else if (src instanceof ArrayBuffer || ArrayBuffer.isView(src)) {
        return URL.createObjectURL(new Blob([src], options));
    } else if (typeof Response !== 'undefined' && src instanceof Response) {
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
    if ((!fetchOptions.method || /^(get|head)$/i.test(fetchOptions.method)) && fetchOptions.body == null) {
        delete fetchOptions.body;
    }
    return fetchOptions;
}

export function loadScript(src) {
    return new Promise((resolve, reject) => {
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
        document.body.append(script);
    });
}

export async function download(filename, data) {
    if (!data) {
        return;
    }
    const blob = (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) ? new Blob([data]) : data;
    const objectUrl = URL.createObjectURL(blob);
    downloadFile(filename, objectUrl);
    setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
    }, 1000);
}

export function downloadFile(filename, href) {
    const eleLink = document.createElement('a');
    eleLink.download = filename;
    eleLink.style.display = 'none';
    eleLink.href = href;
    document.body.appendChild(eleLink);
    eleLink.click();
    document.body.removeChild(eleLink);
}
