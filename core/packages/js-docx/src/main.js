import './hack.js';
import docx from '../../vue-docx/src/docx';
import { download as downloadFile } from '../../../utils/url.js';

class AbnerJsDocxPreview {
    container = null;
    wrapper = null;
    wrapperMain = null;
    options = {};
    requestOptions = {};
    fileData = null;
    renderId = 0;
    isDestroyed = false;
    activeAbortController = null;
    activeUserSignal = null;
    activeUserSignalListener = null;

    constructor(container, options = {}, requestOptions = {}) {
        if (!container) {
            throw new Error('container is required');
        }
        this.container = container;
        this.options = { ...(options || {}) };
        this.requestOptions = { ...(requestOptions || {}) };
        this.createWrapper();
    }

    abortActiveRequest() {
        if (this.activeUserSignal && this.activeUserSignalListener) {
            this.activeUserSignal.removeEventListener('abort', this.activeUserSignalListener);
        }
        this.activeUserSignal = null;
        this.activeUserSignalListener = null;
        if (this.activeAbortController) {
            this.activeAbortController.abort();
            this.activeAbortController = null;
        }
    }

    buildFetchOptions() {
        const opts = { ...(this.requestOptions || {}) };
        if (typeof AbortController === 'undefined') {
            return opts;
        }
        const controller = new AbortController();
        this.activeAbortController = controller;
        const userSignal = opts.signal;
        if (userSignal && typeof userSignal.addEventListener === 'function') {
            if (userSignal.aborted) {
                controller.abort();
            } else {
                const onAbort = () => controller.abort();
                userSignal.addEventListener('abort', onAbort, { once: true });
                this.activeUserSignal = userSignal;
                this.activeUserSignalListener = onAbort;
            }
        }
        opts.signal = controller.signal;
        return opts;
    }

    createWrapper() {
        this.wrapper = document.createElement('div');
        this.wrapper.className = 'abner-vue-office-docx';
        this.wrapperMain = document.createElement('div');
        this.wrapperMain.className = 'abner-vue-office-docx-main';
        this.wrapper.appendChild(this.wrapperMain);
        this.container.appendChild(this.wrapper);
    }

    setOptions(options = {}) {
        this.options = {
            ...(this.options || {}),
            ...(options || {})
        };
    }

    setRequestOptions(requestOptions = {}) {
        this.requestOptions = { ...(requestOptions || {}) };
    }

    async preview(src) {
        if (this.isDestroyed) {
            return;
        }
        this.abortActiveRequest();
        const currentId = ++this.renderId;
        const shouldCommit = () => !this.isDestroyed && currentId === this.renderId && !!this.wrapperMain;
        if (!src) {
            this.fileData = null;
            if (this.wrapperMain) {
                await docx.render('', this.wrapperMain, this.options, shouldCommit).catch(() => {});
            }
            throw new Error('预览地址不能为空');
        }
        const fetchOptions = this.buildFetchOptions();
        try {
            const res = await docx.getData(src, fetchOptions);
            if (!shouldCommit()) {
                return;
            }
            const blob = await docx.getBlob(res);
            if (!shouldCommit()) {
                return;
            }
            if (!blob) {
                throw new Error('Unsupported docx data');
            }
            await docx.render(blob, this.wrapperMain, this.options, shouldCommit);
            if (shouldCommit()) {
                this.fileData = blob;
            }
        } catch (err) {
            if (!this.isDestroyed && currentId === this.renderId) {
                this.fileData = null;
                if (this.wrapperMain) {
                    await docx.render('', this.wrapperMain, this.options, shouldCommit).catch(() => {});
                }
                throw err;
            }
        }
    }

    save(fileName) {
        Promise.resolve(
            downloadFile(fileName || `abner-vue-office-js-docx-${new Date().getTime()}.docx`, this.fileData)
        ).catch(() => {});
    }

    destroy() {
        this.isDestroyed = true;
        ++this.renderId;
        this.abortActiveRequest();
        if (this.wrapperMain && typeof docx.revokeContainerBlobUrls === 'function') {
            docx.revokeContainerBlobUrls(this.wrapperMain);
        }
        if (this.wrapper && this.wrapper.parentNode) {
            this.wrapper.parentNode.removeChild(this.wrapper);
        }
        this.container = null;
        this.wrapper = null;
        this.wrapperMain = null;
        this.options = {};
        this.requestOptions = {};
        this.fileData = null;
    }
}

export function init(container, options, requestOptions) {
    return new AbnerJsDocxPreview(container, options, requestOptions);
}
