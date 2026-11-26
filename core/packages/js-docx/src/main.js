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

    preview(src) {
        const currentId = ++this.renderId;
        return new Promise((resolve, reject) => {
            docx.getData(src, this.requestOptions).then(async res => {
                if (this.isDestroyed || currentId !== this.renderId || !this.wrapperMain) {
                    return;
                }
                this.fileData = await docx.getBlob(res);
                if (this.isDestroyed || currentId !== this.renderId || !this.wrapperMain) {
                    return;
                }
                docx.render(this.fileData, this.wrapperMain, this.options).then(() => {
                    if (!this.isDestroyed && currentId === this.renderId) {
                        resolve();
                    }
                }).catch(e => {
                    if (!this.isDestroyed && currentId === this.renderId && this.wrapperMain) {
                        docx.render('', this.wrapperMain, this.options);
                        reject(e);
                    }
                });
            }).catch(err => {
                if (!this.isDestroyed && currentId === this.renderId && this.wrapperMain) {
                    docx.render('', this.wrapperMain, this.options);
                    reject(err);
                }
            });
        });
    }

    save(fileName) {
        downloadFile(fileName || `abner-vue-office-js-docx-${new Date().getTime()}.docx`, this.fileData);
    }

    destroy() {
        this.isDestroyed = true;
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
