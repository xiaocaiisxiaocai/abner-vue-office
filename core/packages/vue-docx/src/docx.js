/*eslint-disable*/
import { renderAsync } from 'docx-preview';

const defaultOptions = {
    ignoreLastRenderedPageBreak: false
};

function getData(src, options = {}) {
    if (typeof src === 'string') {
        return fetchDocx(src, options);
    }
    return Promise.resolve(src);
}

function fetchDocx(src, options) {
    return fetch(src, options).then(res => {
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
    } else if (data instanceof ArrayBuffer) {
        blob = new Blob([data]);
    }
    return blob;
}

async function render(data, container, options = {}) {
    if (!container) {
        return;
    }
    if (!data) {
        container.innerHTML = '';
        return;
    }
    const blob = await getBlob(data);
    return renderAsync(blob, container, container, { ...defaultOptions, ...options });
}

export default {
    getData,
    render,
    getBlob
};
