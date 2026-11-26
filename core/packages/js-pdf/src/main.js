import { workerStr } from './worker.js';
import { pdfLibJsStr } from './pdf.js';
import { download as downloadFile, getUrlAsync, revokeUrl, loadScript } from '../../../utils/url';
import omit from 'lodash/omit';
import debounce from 'lodash/debounce';

let pdfLibLoadPromise = null;
let pdfJsLibUrl = null;
let pdfJsWorkerUrl = null;

function ensureWorkerSrc() {
    if (window.pdfjsLib && !window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
        if (!pdfJsWorkerUrl) {
            pdfJsWorkerUrl = `data:text/javascript;base64,${workerStr}`;
        }
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = pdfJsWorkerUrl;
    }
}

class AbnerJsPdfPreview {
    container = null;
    wrapper = null;
    wrapperMain = null;
    options = {};
    requestOptions = {};
    pdfDocument = null;
    loadingTask = null;
    currentObjectUrl = null;
    renderId = 0;
    isDestroyed = false;
    totalItems = 0; //pdf总页数
    pageWidth = 0; //每个canvas dom宽度
    pageHeight = 0; //每个canvas dom高度
    containerHeight = 0; //外层容器高度
    visibleItems = 6; //可视区域内的页面数量，根据pdf高度重新计算
    canvasWidth = 0; //画布的尺寸-宽
    canvasHeight = 0; //画布的尺寸-高
    getViewportScale = 2; //缩放比例

    onScroll = debounce((e) => {
        if (this.isDestroyed || !this.wrapperMain || !this.pdfDocument || this.pageHeight <= 0) {
            return;
        }
        const { scrollTop } = e.target;
        const paddingTop = parseInt(getComputedStyle(this.wrapperMain).paddingTop, 10) || 0;
        const gap = this.options.gap || 10;
        const startIndex = Math.max(
            Math.floor(Math.max((scrollTop - paddingTop), 0) / (this.pageHeight + gap)) - 1,
            1
        );
        const endIndex = Math.min(startIndex + this.visibleItems - 1, this.totalItems); // 计算结束索引

        this.renderList(startIndex, endIndex, false); // 渲染列表项
    }, 60);

    constructor(container, options = {}, requestOptions = {}) {
        this.container = container;
        this.options = {
            staticFileUrl: 'https://unpkg.com/pdfjs-dist@3.1.81/',
            ...options
        };
        this.requestOptions = requestOptions;
        this.createWrapper();
        this.createWrapperMain();
    }

    createWrapper() {
        this.wrapper = document.createElement('div');
        this.wrapper.className = 'abner-vue-office-pdf';
        this.wrapper.setAttribute('style', 'text-align: center;overflow: auto;position: relative;height:100%');
        this.container.appendChild(this.wrapper);
        this.wrapper.addEventListener('scroll', this.onScroll);
    }

    createWrapperMain() {
        this.wrapperMain = document.createElement('div');
        this.wrapperMain.className = 'abner-vue-office-pdf-wrapper';
        this.wrapperMain.setAttribute('style', 'background: gray; padding: 30px 0;position: relative;box-sizing: content-box');
        this.wrapper.appendChild(this.wrapperMain);
    }

    checkPdfLib() {
        if (window.pdfjsLib) {
            ensureWorkerSrc();
            return Promise.resolve();
        }
        if (!pdfLibLoadPromise) {
            if (!pdfJsLibUrl) {
                pdfJsLibUrl = `data:text/javascript;base64,${pdfLibJsStr}`;
            }
            pdfLibLoadPromise = loadScript(pdfJsLibUrl)
                .then(() => {
                    if (window.pdfjsLib) {
                        ensureWorkerSrc();
                    } else {
                        throw new Error('window.pdfjsLib未找到');
                    }
                })
                .catch(err => {
                    pdfLibLoadPromise = null;
                    return Promise.reject(err);
                });
        }
        return pdfLibLoadPromise;
    }

    cleanupPdfResources() {
        if (this.loadingTask) {
            try {
                this.loadingTask.destroy();
            } catch (e) {
                // ignore
            }
            this.loadingTask = null;
        }
        if (this.pdfDocument) {
            try {
                this.pdfDocument.destroy();
            } catch (e) {
                // ignore
            }
            this.pdfDocument = null;
        }
        if (this.currentObjectUrl) {
            revokeUrl(this.currentObjectUrl);
            this.currentObjectUrl = null;
        }
    }

    async getDocument(src, currentId) {
        const url = await getUrlAsync(src, { type: 'application/pdf' });
        if (this.isDestroyed || currentId !== this.renderId) {
            if (url !== src) {
                revokeUrl(url);
            }
            return null;
        }
        this.cleanupPdfResources();
        if (url !== src && typeof url === 'string' && url.startsWith('blob:')) {
            this.currentObjectUrl = url;
        }
        const httpHeaders = (this.requestOptions && this.requestOptions.headers) || this.options.httpHeaders;
        this.loadingTask = window.pdfjsLib.getDocument({
            url,
            ...(httpHeaders ? { httpHeaders } : {}),
            withCredentials: this.requestOptions && this.requestOptions.withCredentials,
            cMapUrl: `${this.options.staticFileUrl.endsWith('/') ? this.options.staticFileUrl : this.options.staticFileUrl + '/'}cmaps/`,
            cMapPacked: true,
            enableXfa: true,
            ...omit(this.options, ['width', 'staticFileUrl', 'gap', 'httpHeaders'])
        });
        return this.loadingTask.promise;
    }

    renderSinglePage(num, canvas) {
        if (this.isDestroyed || !this.pdfDocument) {
            return Promise.resolve();
        }
        return this.pdfDocument.getPage(num).then((pdfPage) => {
            if (this.isDestroyed || !this.pdfDocument) {
                return;
            }
            const viewport = pdfPage.getViewport({ scale: this.getViewportScale });
            let outputScale = window.devicePixelRatio > 2 ? 1.5 : 2;
            if (this.canvasWidth * viewport.height !== this.canvasHeight * viewport.width) {
                const width = Math.floor(viewport.width * outputScale);
                const height = Math.floor(viewport.height * outputScale);
                const scale = this.canvasHeight / height;
                outputScale = outputScale * scale;
                canvas.width = Math.floor(width * scale);
                canvas.style.width = Math.floor(viewport.width * scale) + 'px';
            }
            const ctx = canvas.getContext('2d');
            const transform = outputScale !== 1
                ? [outputScale, 0, 0, outputScale, 0, 0]
                : null;

            const renderTask = pdfPage.render({
                canvasContext: ctx,
                transform,
                viewport
            });
            return renderTask.promise;
        });
    }

    getPageSize(pdfDocument) {
        return pdfDocument.getPage(1).then((pdfPage) => {
            const maxWidth = this.options.width || this.wrapper.getBoundingClientRect().width - 20;
            let viewport = pdfPage.getViewport({ scale: 1 });
            if (viewport.width > maxWidth * 1.5) {
                this.getViewportScale = 0.5;
            } else if (viewport.width > maxWidth) {
                this.getViewportScale = 1;
            } else {
                this.getViewportScale = 2;
            }
            viewport = pdfPage.getViewport({ scale: this.getViewportScale });

            const outputScale = window.devicePixelRatio > 2 ? 1.5 : 2;
            const canvasWidth = Math.floor(viewport.width * outputScale);
            const canvasHeight = Math.floor(viewport.height * outputScale);
            let domWidth = Math.floor(viewport.width);
            let domHeight = Math.floor(viewport.height);
            if (this.options.width) {
                const scale = this.options.width / domWidth;
                domWidth = Math.floor(this.options.width);
                domHeight = Math.floor(domHeight * scale);
            }
            const wrapperWidth = this.wrapper.getBoundingClientRect().width - 20;
            if (domWidth > wrapperWidth && wrapperWidth > 0) {
                const scale = wrapperWidth / domWidth;
                domWidth = Math.floor(wrapperWidth);
                domHeight = Math.floor(domHeight * scale);
            }

            return {
                width: domWidth,
                height: domHeight,
                canvasWidth,
                canvasHeight
            };
        });
    }

    createCanvas(index) {
        const paddingTop = parseInt(getComputedStyle(this.wrapperMain).paddingTop, 10) || 0;
        const gap = this.options.gap || 10;
        const canvas = document.createElement('canvas');
        canvas.style.position = 'absolute';
        canvas.style.top = (index - 1) * (this.pageHeight + gap) + paddingTop + 'px';
        canvas.style.left = '50%';
        canvas.style.transform = 'translate(-50%)';
        canvas.style.backgroundColor = '#fff';
        canvas.setAttribute('data-id', index);
        canvas.width = this.canvasWidth;
        canvas.height = this.canvasHeight;
        canvas.style.width = `${this.pageWidth}px`;
        canvas.style.height = `${this.pageHeight}px`;
        return canvas;
    }

    clearAllCanvas() {
        this.wrapperMain && (this.wrapperMain.innerHTML = '');
    }

    setOptions(options) {
        this.options = {
            staticFileUrl: 'https://unpkg.com/pdfjs-dist@3.1.81/',
            ...options
        };
    }

    setRequestOptions(requestOptions) {
        this.requestOptions = requestOptions;
    }

    preview(src) {
        const currentId = ++this.renderId;
        if (!src) {
            this.clearAllCanvas();
            this.cleanupPdfResources();
            const err = new Error('预览地址不能为空');
            this.options.onError && this.options.onError(err);
            return Promise.reject(err);
        }
        return this.checkPdfLib().then(() => {
            if (this.isDestroyed || currentId !== this.renderId) {
                return;
            }
            return this.getDocument(src, currentId).then(pdfDocument => {
                if (!pdfDocument || this.isDestroyed || currentId !== this.renderId) {
                    pdfDocument && pdfDocument.destroy();
                    return;
                }
                this.pdfDocument = pdfDocument;
                return this.getPageSize(pdfDocument).then(res => {
                    if (this.isDestroyed || currentId !== this.renderId || !this.wrapper || !this.wrapperMain) {
                        return;
                    }
                    this.totalItems = pdfDocument.numPages;
                    this.containerHeight = this.wrapper.getBoundingClientRect().height;
                    this.pageWidth = res.width;
                    this.pageHeight = res.height;
                    this.canvasWidth = res.canvasWidth;
                    this.canvasHeight = res.canvasHeight;

                    const gap = this.options.gap || 10;
                    this.visibleItems = Math.ceil(this.containerHeight / Math.max(this.pageHeight + gap, 1)) + 4; //多渲染4个
                    const height = Math.max((this.pageHeight + gap) * this.totalItems - gap, 0);
                    this.wrapperMain.style.height = height + 'px';

                    this.clearAllCanvas();
                    return this.renderList(1, Math.min(this.totalItems, this.visibleItems), true);
                });
            });
        }).catch(e => {
            if (!this.isDestroyed && currentId === this.renderId) {
                this.clearAllCanvas();
                this.options.onError && this.options.onError(e);
            }
            return Promise.reject(e);
        });
    }

    renderList(startIndex, endIndex, emitRendered = false) {
        const list = this.wrapperMain;
        if (!list || !this.pdfDocument || this.isDestroyed) {
            return Promise.resolve();
        }
        const currentId = this.renderId;
        const originNodes = [...list.childNodes];
        const tasks = [];
        if (originNodes.length === 0) {
            for (let i = startIndex; i <= endIndex; i++) {
                const canvas = this.createCanvas(i);
                list.appendChild(canvas);
                tasks.push(this.renderSinglePage(i, canvas));
            }
        } else {
            const min = +originNodes[0].getAttribute('data-id');
            const max = +originNodes[originNodes.length - 1].getAttribute('data-id');
            if (endIndex < min || startIndex > max) {
                for (let i = startIndex; i <= endIndex; i++) {
                    const canvas = this.createCanvas(i);
                    list.appendChild(canvas);
                    tasks.push(this.renderSinglePage(i, canvas));
                }
            }

            if (startIndex < min && endIndex >= min) {
                let firstChildNode = originNodes[0];
                for (let i = min - 1; i >= startIndex; i--) {
                    const canvas = this.createCanvas(i);
                    list.insertBefore(canvas, firstChildNode);
                    firstChildNode = canvas;
                    tasks.push(this.renderSinglePage(i, canvas));
                }
            }

            originNodes.forEach(node => {
                const id = +node.getAttribute('data-id');
                if (id < startIndex || id > endIndex) {
                    list.removeChild(node);
                }
            });

            if (endIndex > max && startIndex <= max) {
                for (let i = max + 1; i <= endIndex; i++) {
                    const canvas = this.createCanvas(i);
                    list.appendChild(canvas);
                    tasks.push(this.renderSinglePage(i, canvas));
                }
            }
        }
        return Promise.all(tasks).then(() => {
            if (emitRendered && !this.isDestroyed && currentId === this.renderId) {
                this.options.onRendered && this.options.onRendered();
            }
        }).catch(e => {
            if (!this.isDestroyed && currentId === this.renderId) {
                this.options.onError && this.options.onError(e);
            }
        });
    }

    rerender() {
        return this.renderList(1, Math.min(this.totalItems, this.visibleItems), true);
    }

    save(fileName) {
        this.pdfDocument && this.pdfDocument._transport && this.pdfDocument._transport.getData().then(fileData => {
            downloadFile(fileName || `abner-vue-office-js-pdf-${new Date().getTime()}.pdf`, fileData.buffer);
        });
    }

    destroy() {
        this.isDestroyed = true;
        this.onScroll.cancel();
        if (this.wrapper) {
            this.wrapper.removeEventListener('scroll', this.onScroll);
            if (this.wrapper.parentNode) {
                this.wrapper.parentNode.removeChild(this.wrapper);
            }
        }
        this.cleanupPdfResources();
        this.container = null;
        this.wrapper = null;
        this.wrapperMain = null;
        this.options = {};
        this.requestOptions = {};
    }
}

export function init(container, options, requestOptions) {
    return new AbnerJsPdfPreview(container, options, requestOptions);
}
