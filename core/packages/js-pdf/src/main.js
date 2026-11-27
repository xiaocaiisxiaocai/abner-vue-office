import { workerStr } from './worker.js';
import { pdfLibJsStr } from './pdf.js';
import { download as downloadFile, getUrlAsync, revokeUrl, loadScript } from '../../../utils/url';
import omit from 'lodash/omit';
import debounce from 'lodash/debounce';

const BUNDLED_PDFJS_VERSION = '4.7.76';
const MAX_CANVAS_PIXELS = 16777216;

let pdfLibLoadPromise = null;
let pdfJsWorkerUrl = null;

function base64ToBlobUrl(b64) {
    if (
        typeof atob === 'function' &&
        typeof Uint8Array !== 'undefined' &&
        typeof Blob !== 'undefined' &&
        typeof URL !== 'undefined' &&
        typeof URL.createObjectURL === 'function'
    ) {
        try {
            const binary = atob(b64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }
            return URL.createObjectURL(new Blob([bytes], { type: 'text/javascript' }));
        } catch (e) {
            // fall through to data URI fallback
        }
    }
    return `data:text/javascript;base64,${b64}`;
}

function ensureWorkerSrc() {
    if (
        typeof window !== 'undefined' &&
        window.pdfjsLib &&
        window.pdfjsLib.GlobalWorkerOptions &&
        !window.pdfjsLib.GlobalWorkerOptions.workerSrc &&
        (!window.pdfjsLib.version || window.pdfjsLib.version === BUNDLED_PDFJS_VERSION)
    ) {
        if (!pdfJsWorkerUrl) {
            pdfJsWorkerUrl = base64ToBlobUrl(workerStr);
        }
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = pdfJsWorkerUrl;
    }
}

function safeDestroy(target) {
    if (!target || typeof target.destroy !== 'function') {
        return;
    }
    try {
        const result = target.destroy();
        if (result && typeof result.catch === 'function') {
            result.catch(() => {});
        }
    } catch (e) {
        // ignore
    }
}

function clampOutputScale(viewportWidth, viewportHeight, baseScale) {
    const w = Math.max(viewportWidth, 1);
    const h = Math.max(viewportHeight, 1);
    const area = w * h * baseScale * baseScale;
    if (area > MAX_CANVAS_PIXELS) {
        return Math.max(0.1, Math.sqrt(MAX_CANVAS_PIXELS / (w * h)));
    }
    return baseScale;
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
    currentMinWidth = 0;
    activeRenderTasks = new Set();
    canvasRenderTasks = new WeakMap();
    cancelledRenderTasks = new WeakSet();
    totalItems = 0; //pdf总页数
    pageWidth = 0; //每个canvas dom宽度
    pageHeight = 0; //每个canvas dom高度
    containerHeight = 0; //外层容器高度
    visibleItems = 6; //可视区域内的页面数量，根据pdf高度重新计算
    canvasWidth = 0; //画布的尺寸-宽
    canvasHeight = 0; //画布的尺寸-高
    getViewportScale = 2; //缩放比例

    getGap() {
        const g = this.options && this.options.gap;
        return typeof g === 'number' && Number.isFinite(g) && g >= 0 ? g : 10;
    }

    onScroll = debounce((e) => {
        if (this.isDestroyed || !this.wrapperMain || !this.pdfDocument || this.pageHeight <= 0 || this.totalItems <= 0) {
            return;
        }
        const { scrollTop } = e.target;
        const paddingTop = parseInt(getComputedStyle(this.wrapperMain).paddingTop, 10) || 0;
        const gap = this.getGap();
        const startIndex = Math.min(
            Math.max(Math.floor(Math.max((scrollTop - paddingTop), 0) / Math.max(this.pageHeight + gap, 1)), 1),
            this.totalItems
        );
        const endIndex = Math.min(startIndex + this.visibleItems - 1, this.totalItems); // 计算结束索引

        this.renderList(startIndex, endIndex, false, this.renderId, false); // 渲染列表项
    }, 60, { maxWait: 120 });

    constructor(container, options = {}, requestOptions = {}) {
        if (!container) {
            throw new Error('container is required');
        }
        this.container = container;
        this.options = {
            staticFileUrl: 'https://unpkg.com/pdfjs-dist@3.1.81/',
            ...(options || {})
        };
        if (!this.options.staticFileUrl || typeof this.options.staticFileUrl !== 'string') {
            this.options.staticFileUrl = 'https://unpkg.com/pdfjs-dist@3.1.81/';
        }
        this.requestOptions = { ...(requestOptions || {}) };
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
        if (typeof window === 'undefined') {
            return Promise.reject(new Error('window is not defined'));
        }
        if (window.pdfjsLib) {
            ensureWorkerSrc();
            return Promise.resolve();
        }
        if (!pdfLibLoadPromise) {
            const libUrl = base64ToBlobUrl(pdfLibJsStr);
            pdfLibLoadPromise = loadScript(libUrl)
                .then(() => {
                    if (window.pdfjsLib) {
                        ensureWorkerSrc();
                    } else {
                        throw new Error('window.pdfjsLib未找到');
                    }
                })
                .finally(() => {
                    revokeUrl(libUrl);
                    pdfLibLoadPromise = null;
                });
        }
        return pdfLibLoadPromise;
    }

    cancelRenderTasks() {
        this.activeRenderTasks.forEach(task => {
            if (task && typeof task.cancel === 'function') {
                this.cancelledRenderTasks.add(task);
                try {
                    task.cancel();
                } catch (e) {
                    // ignore
                }
            }
        });
        this.activeRenderTasks.clear();
    }

    cleanupPdfResources() {
        this.cancelRenderTasks();
        const task = this.loadingTask;
        const doc = this.pdfDocument;
        this.loadingTask = null;
        this.pdfDocument = null;
        if (doc) {
            safeDestroy(doc);
        } else if (task) {
            safeDestroy(task);
        }
        if (this.currentObjectUrl) {
            revokeUrl(this.currentObjectUrl);
            this.currentObjectUrl = null;
        }
    }

    updateMinWidth(requiredWidth) {
        if (!this.wrapperMain || !(requiredWidth > 0)) {
            return;
        }
        const nextMinWidth = Math.ceil(requiredWidth + 20);
        if (nextMinWidth > this.currentMinWidth) {
            this.currentMinWidth = nextMinWidth;
            this.wrapperMain.style.minWidth = `${this.currentMinWidth}px`;
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
        if (typeof url !== 'string' || !url) {
            throw new Error('不支持的 src 格式');
        }
        this.cleanupPdfResources();
        if (url !== src && url.startsWith('blob:')) {
            this.currentObjectUrl = url;
        }
        const reqOpts = this.requestOptions || {};
        const httpHeaders = reqOpts.headers || this.options.httpHeaders;
        const withCredentials = reqOpts.withCredentials !== undefined
            ? Boolean(reqOpts.withCredentials)
            : (reqOpts.credentials !== undefined
                ? reqOpts.credentials === 'include'
                : Boolean(this.options.withCredentials));
        const staticBase = typeof this.options.staticFileUrl === 'string' && this.options.staticFileUrl
            ? this.options.staticFileUrl
            : 'https://unpkg.com/pdfjs-dist@3.1.81/';
        const task = window.pdfjsLib.getDocument({
            url,
            ...(httpHeaders ? { httpHeaders } : {}),
            withCredentials,
            cMapUrl: `${staticBase.endsWith('/') ? staticBase : staticBase + '/'}cmaps/`,
            cMapPacked: true,
            enableXfa: true,
            ...omit(this.options, ['url', 'data', 'width', 'staticFileUrl', 'gap', 'httpHeaders', 'withCredentials', 'onError', 'onRendered'])
        });
        this.loadingTask = task;
        try {
            return await task.promise;
        } finally {
            if (this.loadingTask === task) {
                this.loadingTask = null;
            }
        }
    }

    renderSinglePage(num, canvas, currentId = this.renderId) {
        if (this.isDestroyed || !this.pdfDocument || currentId !== this.renderId || !canvas || canvas.parentNode !== this.wrapperMain) {
            return Promise.resolve();
        }
        return this.pdfDocument.getPage(num).then((pdfPage) => {
            if (this.isDestroyed || !this.pdfDocument || currentId !== this.renderId || canvas.parentNode !== this.wrapperMain) {
                if (pdfPage && typeof pdfPage.cleanup === 'function') {
                    pdfPage.cleanup();
                }
                return;
            }
            const viewport = pdfPage.getViewport({ scale: this.getViewportScale });
            const baseOutputScale = window.devicePixelRatio > 2 ? 1.5 : 2;
            let outputScale = clampOutputScale(viewport.width, viewport.height, baseOutputScale);
            const scaledWidth = Math.max(1, Math.floor(viewport.width * outputScale));
            const scaledHeight = Math.max(1, Math.floor(viewport.height * outputScale));
            if (scaledHeight !== this.canvasHeight || scaledWidth !== this.canvasWidth) {
                if (scaledHeight > 0 && viewport.height > 0 && this.pageHeight > 0) {
                    const scale = this.canvasHeight / scaledHeight;
                    outputScale = clampOutputScale(viewport.width, viewport.height, outputScale * scale);
                    canvas.width = Math.max(1, Math.floor(viewport.width * outputScale));
                    canvas.height = Math.max(1, Math.floor(viewport.height * outputScale));
                    const pageDomWidth = Math.max(1, Math.floor(this.pageHeight * (viewport.width / viewport.height)));
                    canvas.style.width = `${pageDomWidth}px`;
                    this.updateMinWidth(pageDomWidth);
                }
            }
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                if (typeof pdfPage.cleanup === 'function') {
                    pdfPage.cleanup();
                }
                return;
            }
            const transform = outputScale !== 1
                ? [outputScale, 0, 0, outputScale, 0, 0]
                : null;

            const renderTask = pdfPage.render({
                canvasContext: ctx,
                transform,
                viewport
            });
            this.activeRenderTasks.add(renderTask);
            this.canvasRenderTasks.set(canvas, renderTask);
            return renderTask.promise.catch(err => {
                if (this.isDestroyed || currentId !== this.renderId || this.cancelledRenderTasks.has(renderTask)) {
                    return;
                }
                return Promise.reject(err);
            }).finally(() => {
                this.activeRenderTasks.delete(renderTask);
                if (this.canvasRenderTasks.get(canvas) === renderTask) {
                    this.canvasRenderTasks.delete(canvas);
                }
                if (typeof pdfPage.cleanup === 'function') {
                    try {
                        pdfPage.cleanup();
                    } catch (e) {
                        // ignore
                    }
                }
            });
        }, err => {
            if (this.isDestroyed || currentId !== this.renderId || !canvas || canvas.parentNode !== this.wrapperMain) {
                return;
            }
            return Promise.reject(err);
        });
    }

    getPageSize(pdfDocument) {
        return pdfDocument.getPage(1).then((pdfPage) => {
            if (this.isDestroyed || !this.wrapper) {
                return null;
            }
            const rawWidth = this.wrapper.getBoundingClientRect().width || 820;
            const optWidth = typeof this.options.width === 'number' && Number.isFinite(this.options.width) && this.options.width > 0
                ? this.options.width
                : 0;
            const maxWidth = optWidth || Math.max(rawWidth - 20, 100);
            let viewport = pdfPage.getViewport({ scale: 1 });
            if (viewport.width > maxWidth * 1.5) {
                this.getViewportScale = 0.5;
            } else if (viewport.width > maxWidth) {
                this.getViewportScale = 1;
            } else {
                this.getViewportScale = 2;
            }
            viewport = pdfPage.getViewport({ scale: this.getViewportScale });

            const baseOutputScale = window.devicePixelRatio > 2 ? 1.5 : 2;
            const outputScale = clampOutputScale(viewport.width, viewport.height, baseOutputScale);
            const canvasWidth = Math.max(1, Math.floor(viewport.width * outputScale));
            const canvasHeight = Math.max(1, Math.floor(viewport.height * outputScale));
            let domWidth = Math.max(1, Math.floor(viewport.width));
            let domHeight = Math.max(1, Math.floor(viewport.height));
            if (optWidth && domWidth > 0) {
                const scale = optWidth / domWidth;
                domWidth = Math.max(1, Math.floor(optWidth));
                domHeight = Math.max(1, Math.floor(domHeight * scale));
            } else {
                const wrapperWidth = this.wrapper.getBoundingClientRect().width - 20;
                if (domWidth > wrapperWidth && wrapperWidth > 0 && domWidth > 0) {
                    const scale = wrapperWidth / domWidth;
                    domWidth = Math.max(1, Math.floor(wrapperWidth));
                    domHeight = Math.max(1, Math.floor(domHeight * scale));
                }
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
        const gap = this.getGap();
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

    clearAllCanvas(resetStyle = false) {
        this.cancelRenderTasks();
        if (this.wrapperMain) {
            this.wrapperMain.innerHTML = '';
            if (resetStyle) {
                this.wrapperMain.style.height = '';
                this.wrapperMain.style.minWidth = '';
                this.currentMinWidth = 0;
            }
        }
    }

    setOptions(options = {}) {
        this.options = {
            ...this.options,
            ...(options || {})
        };
        if (!this.options.staticFileUrl || typeof this.options.staticFileUrl !== 'string') {
            this.options.staticFileUrl = 'https://unpkg.com/pdfjs-dist@3.1.81/';
        }
    }

    setRequestOptions(requestOptions = {}) {
        this.requestOptions = { ...(requestOptions || {}) };
    }

    layoutAndRender(currentId, rethrow = false) {
        if (this.isDestroyed || currentId !== this.renderId || !this.pdfDocument || !this.wrapper || !this.wrapperMain) {
            return Promise.resolve();
        }
        this.onScroll.cancel();
        return this.getPageSize(this.pdfDocument).then(res => {
            if (!res || this.isDestroyed || currentId !== this.renderId || !this.pdfDocument || !this.wrapper || !this.wrapperMain) {
                return;
            }
            this.totalItems = this.pdfDocument.numPages;
            this.containerHeight = this.wrapper.getBoundingClientRect().height;
            this.pageWidth = res.width;
            this.pageHeight = res.height;
            this.canvasWidth = res.canvasWidth;
            this.canvasHeight = res.canvasHeight;

            const gap = this.getGap();
            this.visibleItems = Math.ceil(this.containerHeight / Math.max(this.pageHeight + gap, 1)) + 4; //多渲染4个
            const height = Math.max((this.pageHeight + gap) * this.totalItems - gap, 0);
            this.wrapperMain.style.height = height + 'px';
            this.currentMinWidth = this.pageWidth > 0 ? Math.ceil(this.pageWidth + 20) : 0;
            this.wrapperMain.style.minWidth = this.currentMinWidth > 0 ? `${this.currentMinWidth}px` : '';

            this.clearAllCanvas();
            const scrollTop = this.wrapper.scrollTop || 0;
            const paddingTop = parseInt(getComputedStyle(this.wrapperMain).paddingTop, 10) || 0;
            const startIndex = Math.min(
                Math.max(Math.floor(Math.max(scrollTop - paddingTop, 0) / Math.max(this.pageHeight + gap, 1)), 1),
                Math.max(this.totalItems, 1)
            );
            const endIndex = Math.min(startIndex + this.visibleItems - 1, this.totalItems);
            return this.renderList(startIndex, endIndex, true, currentId, rethrow);
        });
    }

    preview(src) {
        if (this.isDestroyed) {
            return Promise.resolve();
        }
        const currentId = ++this.renderId;
        this.onScroll.cancel();
        this.cleanupPdfResources();
        if (!src) {
            this.clearAllCanvas(true);
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
                    safeDestroy(pdfDocument);
                    return;
                }
                this.pdfDocument = pdfDocument;
                if (this.wrapper) {
                    this.wrapper.scrollTop = 0;
                }
                return this.layoutAndRender(currentId, true);
            });
        }).then((rendered) => {
            if (rendered && !this.isDestroyed && currentId === this.renderId) {
                this.options.onRendered && this.options.onRendered();
            }
        }, e => {
            if (!this.isDestroyed && currentId === this.renderId) {
                this.clearAllCanvas(true);
                this.cleanupPdfResources();
                this.options.onError && this.options.onError(e);
                return Promise.reject(e);
            }
        });
    }

    renderList(startIndex, endIndex, emitRendered = false, currentId = this.renderId, rethrow = false) {
        const list = this.wrapperMain;
        if (!list || !this.pdfDocument || this.isDestroyed || currentId !== this.renderId) {
            return Promise.resolve();
        }
        const originNodes = [...list.children];
        const tasks = [];
        if (originNodes.length === 0) {
            for (let i = startIndex; i <= endIndex; i++) {
                const canvas = this.createCanvas(i);
                list.appendChild(canvas);
                tasks.push(this.renderSinglePage(i, canvas, currentId));
            }
        } else {
            const min = +originNodes[0].getAttribute('data-id');
            const max = +originNodes[originNodes.length - 1].getAttribute('data-id');
            if (endIndex < min || startIndex > max) {
                for (let i = startIndex; i <= endIndex; i++) {
                    const canvas = this.createCanvas(i);
                    list.appendChild(canvas);
                    tasks.push(this.renderSinglePage(i, canvas, currentId));
                }
            }

            if (startIndex < min && endIndex >= min) {
                let firstChildNode = originNodes[0];
                for (let i = min - 1; i >= startIndex; i--) {
                    const canvas = this.createCanvas(i);
                    list.insertBefore(canvas, firstChildNode);
                    firstChildNode = canvas;
                    tasks.push(this.renderSinglePage(i, canvas, currentId));
                }
            }

            originNodes.forEach(node => {
                const id = +node.getAttribute('data-id');
                if (id < startIndex || id > endIndex) {
                    const pendingTask = this.canvasRenderTasks.get(node);
                    if (pendingTask) {
                        this.cancelledRenderTasks.add(pendingTask);
                        this.canvasRenderTasks.delete(node);
                        this.activeRenderTasks.delete(pendingTask);
                        if (typeof pendingTask.cancel === 'function') {
                            try {
                                pendingTask.cancel();
                            } catch (e) {
                                // ignore
                            }
                        }
                    }
                    list.removeChild(node);
                }
            });

            if (endIndex > max && startIndex <= max) {
                for (let i = max + 1; i <= endIndex; i++) {
                    const canvas = this.createCanvas(i);
                    list.appendChild(canvas);
                    tasks.push(this.renderSinglePage(i, canvas, currentId));
                }
            }
        }
        return Promise.all(tasks).then(() => {
            if (emitRendered && !this.isDestroyed && currentId === this.renderId) {
                if (rethrow) {
                    return true;
                }
                this.options.onRendered && this.options.onRendered();
            }
            return false;
        }, e => {
            if (rethrow) {
                return Promise.reject(e);
            }
            if (!this.isDestroyed && currentId === this.renderId) {
                this.options.onError && this.options.onError(e);
            }
        });
    }

    rerender() {
        if (this.isDestroyed || !this.pdfDocument) {
            return Promise.resolve();
        }
        const currentId = ++this.renderId;
        return this.layoutAndRender(currentId, true).then((rendered) => {
            if (rendered && !this.isDestroyed && currentId === this.renderId) {
                this.options.onRendered && this.options.onRendered();
            }
        }, e => {
            if (!this.isDestroyed && currentId === this.renderId) {
                this.options.onError && this.options.onError(e);
                return Promise.reject(e);
            }
        });
    }

    save(fileName) {
        const doc = this.pdfDocument;
        if (!doc || typeof doc.getData !== 'function') {
            return;
        }
        doc.getData().then(fileData => {
            if (this.isDestroyed || doc !== this.pdfDocument || typeof Blob === 'undefined') {
                return;
            }
            return downloadFile(
                fileName || `abner-vue-office-js-pdf-${new Date().getTime()}.pdf`,
                new Blob([fileData], { type: 'application/pdf' })
            );
        }).catch(e => {
            if (!this.isDestroyed && doc === this.pdfDocument && this.options && this.options.onError) {
                this.options.onError(e);
            }
        });
    }

    destroy() {
        this.isDestroyed = true;
        ++this.renderId;
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
