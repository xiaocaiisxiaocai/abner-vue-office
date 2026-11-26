/*eslint-disable*/
import { parseAsync, renderDocument } from 'docx-preview';
import { normalizeFetchOptions } from '../../../utils/url';

const defaultOptions = {
    ignoreLastRenderedPageBreak: false
};
const containerRenderQueue = new WeakMap();

function getData(src, options = {}) {
    if (typeof src === 'string') {
        return fetchDocx(src, options);
    }
    return Promise.resolve(src);
}

function fetchDocx(src, options) {
    return fetch(src, normalizeFetchOptions(options)).then(res => {
        if (!res.ok) {
            return Promise.reject(res);
        }
        return res;
    });
}

async function getBlob(data) {
    let blob;
    if (data instanceof Blob) {
        blob = data;
    } else if (typeof Response !== 'undefined' && data instanceof Response) {
        blob = await data.blob();
    } else if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
        blob = new Blob([data]);
    }
    return blob;
}

function enqueueOnContainer(container, fn, shouldCommit) {
    const prev = containerRenderQueue.get(container) || Promise.resolve();
    const next = prev.catch(() => {}).then(() => {
        if (typeof shouldCommit === 'function' && !shouldCommit()) {
            return;
        }
        return fn();
    });
    const tracked = next.finally(() => {
        if (containerRenderQueue.get(container) === tracked) {
            containerRenderQueue.delete(container);
        }
    });
    containerRenderQueue.set(container, tracked);
    return next;
}

async function render(data, container, options = {}, shouldCommit) {
    if (!container) {
        return;
    }
    if (!data) {
        return enqueueOnContainer(container, () => {
            container.innerHTML = '';
        }, shouldCommit);
    }
    const blob = await getBlob(data);
    if (!blob) {
        await enqueueOnContainer(container, () => {
            container.innerHTML = '';
        }, shouldCommit);
        return Promise.reject(new Error('Unsupported docx data'));
    }
    const mergedOptions = { ...defaultOptions, ...(options || {}) };
    const doc = await parseAsync(blob, mergedOptions);
    if (typeof shouldCommit === 'function' && !shouldCommit()) {
        return;
    }
    return enqueueOnContainer(
        container,
        () => renderDocument(doc, container, container, mergedOptions),
        shouldCommit
    );
}

export default {
    getData,
    render,
    getBlob
};
