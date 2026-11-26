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

    constructor(container, options = {}, requestOptions = {}) {
        if (!container) {
            throw new Error('container is required');
        }
        this.container = container;
        this.options = options;
        this.requestOptions = requestOptions;
        this.createWrapper();
    }

    createWrapper() {
        this.wrapper = document.createElement('div');
        this.wrapper.className = 'abner-vue-office-docx';
        this.wrapperMain = document.createElement('div');
        this.wrapperMain.className = 'abner-vue-office-docx-main';
        this.wrapper.appendChild(this.wrapperMain);
        this.container.appendChild(this.wrapper);
    }

    setOptions(options) {
        this.options = options;
    }

    setRequestOptions(requestOptions) {
        this.requestOptions = requestOptions;
    }

    async preview(src) {
        const currentId = ++this.renderId;
        try {
            const res = await docx.getData(src, this.requestOptions);
            if (this.isDestroyed || currentId !== this.renderId || !this.wrapperMain) {
                return;
            }
            const blob = await docx.getBlob(res);
            if (this.isDestroyed || currentId !== this.renderId || !this.wrapperMain) {
                return;
            }
            this.fileData = blob || null;
            await docx.render(this.fileData, this.wrapperMain, this.options);
        } catch (err) {
            if (!this.isDestroyed && currentId === this.renderId) {
                this.fileData = null;
                if (this.wrapperMain) {
                    await docx.render('', this.wrapperMain, this.options).catch(() => {});
                }
                throw err;
            }
        }
    }

    save(fileName) {
        downloadFile(fileName || `abner-vue-office-js-docx-${new Date().getTime()}.docx`, this.fileData);
    }

    destroy() {
        this.isDestroyed = true;
        ++this.renderId;
        if (this.wrapper && this.wrapper.parentNode) {
            this.wrapper.parentNode.removeChild(this.wrapper);
        }
        this.container = null;
        this.wrapper = null;
        this.wrapperMain = null;
        this.options = null;
        this.requestOptions = null;
        this.fileData = null;
    }
}

export function init(container, options, requestOptions) {
    return new AbnerJsDocxPreview(container, options, requestOptions);
}
