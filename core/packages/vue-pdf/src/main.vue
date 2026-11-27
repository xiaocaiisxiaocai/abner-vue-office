<script>
import { defineComponent, ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue-demi';
import workerStr from './worker?raw';
import pdfjsLib from './pdf?raw';
import { download as downloadFile, getUrlAsync, revokeUrl, loadScript } from '../../../utils/url';
import omit from 'lodash/omit';
import debounce from 'lodash/debounce';

const BUNDLED_PDFJS_VERSION = '4.7.0';
const MAX_CANVAS_PIXELS = 16777216;

let pdfJsLibBlobUrl = null;
let pdfJsWorkerBlobUrl = null;
let pdfLibLoadPromise = null;

function getPdfJsLibUrl() {
    if (!pdfJsLibBlobUrl) {
        pdfJsLibBlobUrl = URL.createObjectURL(new Blob([pdfjsLib], { type: 'text/javascript' }));
    }
    return pdfJsLibBlobUrl;
}

function getPdfJsWorkerUrl() {
    if (!pdfJsWorkerBlobUrl) {
        pdfJsWorkerBlobUrl = URL.createObjectURL(new Blob([workerStr], { type: 'text/javascript' }));
    }
    return pdfJsWorkerBlobUrl;
}

function assignWorkerSrcIfCompatible(lib) {
    if (
        lib &&
        lib.GlobalWorkerOptions &&
        !lib.GlobalWorkerOptions.workerSrc &&
        (!lib.version || lib.version === BUNDLED_PDFJS_VERSION)
    ) {
        lib.GlobalWorkerOptions.workerSrc = getPdfJsWorkerUrl();
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

export default defineComponent({
    name: 'AbnerVueOfficePdf',
    props: {
        src: {
            validator(val) {
                if (val == null || typeof val === 'string') {
                    return true;
                }
                if (val instanceof ArrayBuffer || ArrayBuffer.isView(val)) {
                    return true;
                }
                if (typeof Blob !== 'undefined' && val instanceof Blob) {
                    return true;
                }
                if (typeof Response !== 'undefined' && val instanceof Response) {
                    return true;
                }
                return false;
            }
        },
        requestOptions: {
            type: Object,
            default: () => ({})
        },
        staticFileUrl: {
            type: String,
            default: 'https://unpkg.com/pdfjs-dist@3.1.81/'
        },
        options: {
            type: Object,
            default: () => ({})
        },
        defaultScale: {
            type: Number,
            default: 1
        }
    },
    emits: ['rendered', 'error'],
    setup(props, { emit }) {
        let pdfDocument = null;
        let loadingTask = null;
        let currentObjectUrl = null;
        let isUnmounted = false;
        let isLoading = false;
        let loadId = 0;
        let renderId = 0;
        let libRequestId = 0;
        let currentMinWidth = 0;
        const activeRenderTasks = new Set();
        const canvasRenderTasks = new WeakMap();
        const cancelledRenderTasks = new WeakSet();

        const containerRef = ref(null); //最外层容器
        const wrapperRef = ref(null); //canvas渲染外层容器

        let totalItems = 0; //pdf总页数
        let pageWidth = 0; //每个canvas dom宽度
        let pageHeight = 0; //每个canvas dom高度
        let containerHeight = 0; //外层容器高度
        let visibleItems = 6; //可视区域内的页面数量，根据pdf高度重新计算
        let canvasWidth = 0; //画布的尺寸-宽
        let canvasHeight = 0; //画布的尺寸-高

        let getViewportScale = 2;

        function getOptions() {
            return props.options || {};
        }

        function getGap() {
            const g = getOptions().gap;
            return typeof g === 'number' && Number.isFinite(g) && g >= 0 ? g : 10;
        }

        function isValidScale(val) {
            return typeof val === 'number' && Number.isFinite(val) && val > 0;
        }

        function resolveDefaultScale() {
            const optScale = getOptions().defaultScale;
            if (isValidScale(optScale)) {
                return optScale;
            }
            if (isValidScale(props.defaultScale)) {
                return props.defaultScale;
            }
            return 1;
        }

        const userScale = ref(resolveDefaultScale());

        function cancelRenderTasks() {
            activeRenderTasks.forEach(task => {
                if (task && typeof task.cancel === 'function') {
                    cancelledRenderTasks.add(task);
                    try {
                        task.cancel();
                    } catch (e) {
                        // ignore
                    }
                }
            });
            activeRenderTasks.clear();
        }

        function cleanupPdfResources() {
            cancelRenderTasks();
            const task = loadingTask;
            const doc = pdfDocument;
            loadingTask = null;
            pdfDocument = null;
            if (doc) {
                safeDestroy(doc);
            } else if (task) {
                safeDestroy(task);
            }
            if (currentObjectUrl) {
                revokeUrl(currentObjectUrl);
                currentObjectUrl = null;
            }
        }

        onBeforeUnmount(() => {
            isUnmounted = true;
            isLoading = false;
            ++loadId;
            ++renderId;
            ++libRequestId;
            onScrollPdf.cancel();
            cleanupPdfResources();
        });

        function getScale() {
            return userScale.value;
        }

        function scheduleInit() {
            const currentLibReqId = ++libRequestId;
            const currentLoadId = ++loadId;
            ++renderId;
            isLoading = true;
            onScrollPdf.cancel();
            cleanupPdfResources();
            return checkPdfLib().then(() => {
                if (isUnmounted || currentLibReqId !== libRequestId) {
                    return;
                }
                return init(currentLoadId);
            }).catch(e => {
                if (!isUnmounted && currentLibReqId === libRequestId) {
                    isLoading = false;
                    emit('error', e);
                }
            });
        }

        function setScale(scale) {
            if (!isValidScale(scale)) {
                return;
            }
            userScale.value = scale;
            if (pdfDocument && !isLoading) {
                const currentId = ++renderId;
                nextTick(() => {
                    layoutAndRender(currentId).catch(e => {
                        if (!isUnmounted && currentId === renderId) {
                            emit('error', e);
                        }
                    });
                });
            } else if (props.src && containerRef.value && !isLoading) {
                scheduleInit();
            }
        }

        function checkPdfLib() {
            if (typeof window === 'undefined') {
                return Promise.reject(new Error('window is not defined'));
            }
            if (window.pdfjsLib) {
                assignWorkerSrcIfCompatible(window.pdfjsLib);
                return Promise.resolve();
            }
            if (!pdfLibLoadPromise) {
                const libUrl = getPdfJsLibUrl();
                pdfLibLoadPromise = loadScript(libUrl)
                    .then(() => {
                        revokeUrl(libUrl);
                        pdfJsLibBlobUrl = null;
                        if (window.pdfjsLib) {
                            assignWorkerSrcIfCompatible(window.pdfjsLib);
                        } else {
                            throw new Error('window.pdfjsLib未找到');
                        }
                    })
                    .catch(err => {
                        revokeUrl(libUrl);
                        pdfJsLibBlobUrl = null;
                        return Promise.reject(err);
                    })
                    .finally(() => {
                        pdfLibLoadPromise = null;
                    });
            }
            return pdfLibLoadPromise;
        }

        function clearCanvas(resetStyle = false) {
            cancelRenderTasks();
            if (wrapperRef.value) {
                wrapperRef.value.innerHTML = '';
                if (resetStyle) {
                    wrapperRef.value.style.height = '';
                    wrapperRef.value.style.minWidth = '';
                    currentMinWidth = 0;
                }
            }
        }

        function updateMinWidth(requiredWidth) {
            if (!wrapperRef.value || !(requiredWidth > 0)) {
                return;
            }
            const nextMinWidth = Math.ceil(requiredWidth + 20);
            if (nextMinWidth > currentMinWidth) {
                currentMinWidth = nextMinWidth;
                wrapperRef.value.style.minWidth = `${currentMinWidth}px`;
            }
        }

        function layoutAndRender(currentId, rethrow = false) {
            if (isUnmounted || currentId !== renderId || !pdfDocument || !wrapperRef.value || !containerRef.value) {
                return Promise.resolve();
            }
            onScrollPdf.cancel();
            return getPageSize(pdfDocument).then(res => {
                if (!res || isUnmounted || currentId !== renderId || !pdfDocument || !wrapperRef.value || !containerRef.value) {
                    return;
                }
                totalItems = pdfDocument.numPages;
                containerHeight = containerRef.value.getBoundingClientRect().height;
                pageWidth = res.width;
                pageHeight = res.height;
                canvasWidth = res.canvasWidth;
                canvasHeight = res.canvasHeight;

                const gap = getGap();
                visibleItems = Math.ceil(containerHeight / Math.max(pageHeight + gap, 1)) + 4; //多渲染4个
                const height = Math.max((pageHeight + gap) * totalItems - gap, 0);
                wrapperRef.value.style.height = height + 'px';
                currentMinWidth = pageWidth > 0 ? Math.ceil(pageWidth + 20) : 0;
                wrapperRef.value.style.minWidth = currentMinWidth > 0 ? `${currentMinWidth}px` : '';

                clearCanvas();
                const scrollTop = containerRef.value.scrollTop || 0;
                const paddingTop = parseInt(getComputedStyle(wrapperRef.value).paddingTop, 10) || 0;
                const startIndex = Math.min(
                    Math.max(Math.floor(Math.max(scrollTop - paddingTop, 0) / Math.max(pageHeight + gap, 1)), 1),
                    Math.max(totalItems, 1)
                );
                const endIndex = Math.min(startIndex + visibleItems - 1, totalItems);
                return renderList(startIndex, endIndex, true, currentId, rethrow);
            });
        }

        async function init(currentLoadId = ++loadId) {
            const currentId = ++renderId;
            isLoading = true;
            onScrollPdf.cancel();
            if (!props.src) {
                if (currentLoadId === loadId) {
                    isLoading = false;
                }
                clearCanvas(true);
                cleanupPdfResources();
                emit('error', new Error('src不能为空'));
                return;
            }
            let rendered = false;
            try {
                const url = await getUrlAsync(props.src, { type: 'application/pdf' });
                if (isUnmounted || currentId !== renderId || currentLoadId !== loadId) {
                    if (url !== props.src) {
                        revokeUrl(url);
                    }
                    return;
                }
                if (typeof url !== 'string' || !url) {
                    throw new Error('不支持的 src 格式');
                }
                cleanupPdfResources();
                if (url !== props.src && url.startsWith('blob:')) {
                    currentObjectUrl = url;
                }

                const reqOpts = props.requestOptions || {};
                const opts = getOptions();
                const httpHeaders = reqOpts.headers || opts.httpHeaders;
                const withCredentials = reqOpts.withCredentials !== undefined
                    ? Boolean(reqOpts.withCredentials)
                    : (reqOpts.credentials !== undefined
                        ? reqOpts.credentials === 'include'
                        : Boolean(opts.withCredentials));
                const staticBase = typeof props.staticFileUrl === 'string' && props.staticFileUrl
                    ? props.staticFileUrl
                    : 'https://unpkg.com/pdfjs-dist@3.1.81/';
                const task = window.pdfjsLib.getDocument({
                    url,
                    ...(httpHeaders ? { httpHeaders } : {}),
                    withCredentials,
                    cMapUrl: `${staticBase.endsWith('/') ? staticBase : staticBase + '/'}cmaps/`,
                    cMapPacked: true,
                    enableXfa: true,
                    ...omit(opts, ['url', 'data', 'width', 'gap', 'defaultScale', 'httpHeaders', 'withCredentials'])
                });
                loadingTask = task;
                const pdf = await task.promise;
                if (loadingTask === task) {
                    loadingTask = null;
                }
                if (isUnmounted || currentId !== renderId || currentLoadId !== loadId) {
                    safeDestroy(pdf);
                    return;
                }
                pdfDocument = pdf;
                if (containerRef.value) {
                    containerRef.value.scrollTop = 0;
                }
                if (currentLoadId === loadId) {
                    isLoading = false;
                }
                rendered = Boolean(await layoutAndRender(currentId, true));
            } catch (e) {
                if (!isUnmounted && currentId === renderId && currentLoadId === loadId) {
                    clearCanvas(true);
                    cleanupPdfResources();
                    emit('error', e);
                }
                return;
            } finally {
                if (currentLoadId === loadId) {
                    isLoading = false;
                }
            }
            if (rendered && !isUnmounted && currentId === renderId && currentLoadId === loadId) {
                emit('rendered');
            }
        }

        function getPageSize(doc) {
            return doc.getPage(1).then((pdfPage) => {
                if (isUnmounted || !wrapperRef.value || !containerRef.value) {
                    return null;
                }
                const opts = getOptions();
                const baseContainerWidth = Math.max((containerRef.value.clientWidth || wrapperRef.value.getBoundingClientRect().width || 820) - 20, 100);
                const optWidth = typeof opts.width === 'number' && Number.isFinite(opts.width) && opts.width > 0 ? opts.width : 0;
                const baseWidth = optWidth || baseContainerWidth;
                const targetWidth = baseWidth * userScale.value;
                const baseViewport = pdfPage.getViewport({ scale: 1 });
                const baseViewportWidth = baseViewport.width > 0 ? baseViewport.width : 1;
                getViewportScale = Math.max(0.1, targetWidth / baseViewportWidth);

                const viewport = pdfPage.getViewport({ scale: getViewportScale });
                const baseOutputScale = window.devicePixelRatio > 2 ? 1.5 : 2;
                const outputScale = clampOutputScale(viewport.width, viewport.height, baseOutputScale);
                const cWidth = Math.max(1, Math.floor(viewport.width * outputScale));
                const cHeight = Math.max(1, Math.floor(viewport.height * outputScale));

                const domWidth = Math.max(1, Math.floor(viewport.width));
                const domHeight = Math.max(1, Math.floor(viewport.height));

                return {
                    width: domWidth,
                    height: domHeight,
                    canvasWidth: cWidth,
                    canvasHeight: cHeight
                };
            });
        }

        const onScrollPdf = debounce(function (e) {
            if (isUnmounted || !wrapperRef.value || !pdfDocument || pageHeight <= 0 || totalItems <= 0) {
                return;
            }
            const { scrollTop } = e.target;
            const paddingTop = parseInt(getComputedStyle(wrapperRef.value).paddingTop, 10) || 0;
            const gap = getGap();
            const startIndex = Math.min(
                Math.max(Math.floor(Math.max((scrollTop - paddingTop), 0) / Math.max(pageHeight + gap, 1)), 1),
                totalItems
            );
            const endIndex = Math.min(startIndex + visibleItems - 1, totalItems); // 计算结束索引

            renderList(startIndex, endIndex, false, renderId); // 渲染列表项
        }, 60, { maxWait: 120 });

        function createCanvas(index) {
            const paddingTop = parseInt(getComputedStyle(wrapperRef.value).paddingTop, 10) || 0;
            const gap = getGap();
            const canvas = document.createElement('canvas');
            canvas.style.position = 'absolute';
            canvas.style.top = (index - 1) * (pageHeight + gap) + paddingTop + 'px';
            canvas.style.left = '50%';
            canvas.style.transform = 'translate(-50%)';
            canvas.style.backgroundColor = '#fff';
            canvas.setAttribute('data-id', index);
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            canvas.style.width = `${pageWidth}px`;
            canvas.style.height = `${pageHeight}px`;
            return canvas;
        }

        function renderList(startIndex, endIndex, emitRendered = false, currentId = renderId, rethrow = false) {
            const list = wrapperRef.value;
            if (!list || !pdfDocument || isUnmounted || currentId !== renderId) {
                return Promise.resolve();
            }
            const originNodes = [...list.children];
            const tasks = [];
            if (originNodes.length === 0) {
                for (let i = startIndex; i <= endIndex; i++) {
                    const canvas = createCanvas(i);
                    list.appendChild(canvas);
                    tasks.push(renderPage(i, canvas, currentId));
                }
            } else {
                const min = +originNodes[0].getAttribute('data-id');
                const max = +originNodes[originNodes.length - 1].getAttribute('data-id');
                if (endIndex < min || startIndex > max) {
                    for (let i = startIndex; i <= endIndex; i++) {
                        const canvas = createCanvas(i);
                        list.appendChild(canvas);
                        tasks.push(renderPage(i, canvas, currentId));
                    }
                }

                if (startIndex < min && endIndex >= min) {
                    let firstChildNode = originNodes[0];
                    for (let i = min - 1; i >= startIndex; i--) {
                        const canvas = createCanvas(i);
                        list.insertBefore(canvas, firstChildNode);
                        firstChildNode = canvas;
                        tasks.push(renderPage(i, canvas, currentId));
                    }
                }

                originNodes.forEach(node => {
                    const id = +node.getAttribute('data-id');
                    if (id < startIndex || id > endIndex) {
                        const pendingTask = canvasRenderTasks.get(node);
                        if (pendingTask) {
                            cancelledRenderTasks.add(pendingTask);
                            canvasRenderTasks.delete(node);
                            activeRenderTasks.delete(pendingTask);
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
                        const canvas = createCanvas(i);
                        list.appendChild(canvas);
                        tasks.push(renderPage(i, canvas, currentId));
                    }
                }
            }
            return Promise.all(tasks).then(() => {
                if (emitRendered && !isUnmounted && currentId === renderId) {
                    if (rethrow) {
                        return true;
                    }
                    emit('rendered');
                }
                return false;
            }, e => {
                if (rethrow) {
                    return Promise.reject(e);
                }
                if (!isUnmounted && currentId === renderId) {
                    emit('error', e);
                }
            });
        }

        function renderPage(num, canvas, currentId = renderId) {
            if (!pdfDocument || isUnmounted || currentId !== renderId || !canvas || canvas.parentNode !== wrapperRef.value) {
                return Promise.resolve();
            }
            return pdfDocument.getPage(num).then((pdfPage) => {
                if (!pdfDocument || isUnmounted || currentId !== renderId || canvas.parentNode !== wrapperRef.value) {
                    if (pdfPage && typeof pdfPage.cleanup === 'function') {
                        pdfPage.cleanup();
                    }
                    return;
                }
                const viewport = pdfPage.getViewport({ scale: getViewportScale });
                const baseOutputScale = window.devicePixelRatio > 2 ? 1.5 : 2;
                let outputScale = clampOutputScale(viewport.width, viewport.height, baseOutputScale);
                const scaledWidth = Math.max(1, Math.floor(viewport.width * outputScale));
                const scaledHeight = Math.max(1, Math.floor(viewport.height * outputScale));
                if (scaledHeight !== canvasHeight || scaledWidth !== canvasWidth) {
                    if (scaledHeight > 0 && viewport.height > 0 && pageHeight > 0) {
                        const scale = canvasHeight / scaledHeight;
                        outputScale = clampOutputScale(viewport.width, viewport.height, outputScale * scale);
                        canvas.width = Math.max(1, Math.floor(viewport.width * outputScale));
                        canvas.height = Math.max(1, Math.floor(viewport.height * outputScale));
                        const pageDomWidth = Math.max(1, Math.floor(pageHeight * (viewport.width / viewport.height)));
                        canvas.style.width = `${pageDomWidth}px`;
                        updateMinWidth(pageDomWidth);
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
                activeRenderTasks.add(renderTask);
                canvasRenderTasks.set(canvas, renderTask);
                return renderTask.promise.catch(err => {
                    if (isUnmounted || currentId !== renderId || cancelledRenderTasks.has(renderTask)) {
                        return;
                    }
                    return Promise.reject(err);
                }).finally(() => {
                    activeRenderTasks.delete(renderTask);
                    if (canvasRenderTasks.get(canvas) === renderTask) {
                        canvasRenderTasks.delete(canvas);
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
                if (isUnmounted || currentId !== renderId || !canvas || canvas.parentNode !== wrapperRef.value) {
                    return;
                }
                return Promise.reject(err);
            });
        }

        function rerender() {
            if (isUnmounted || !pdfDocument || isLoading) {
                return Promise.resolve();
            }
            const currentId = ++renderId;
            return layoutAndRender(currentId).catch(e => {
                if (!isUnmounted && currentId === renderId) {
                    emit('error', e);
                }
            });
        }

        onMounted(() => {
            if (props.src) {
                scheduleInit();
            }
        });

        watch(() => props.src, () => {
            if (!containerRef.value) {
                return;
            }
            if (!props.src) {
                isLoading = false;
                ++loadId;
                ++renderId;
                ++libRequestId;
                onScrollPdf.cancel();
                clearCanvas(true);
                cleanupPdfResources();
                emit('error', new Error('src不能为空'));
                return;
            }
            scheduleInit();
        });

        watch(resolveDefaultScale, (resolved) => {
            if (resolved !== userScale.value) {
                setScale(resolved);
            }
        });

        function save(fileName) {
            const doc = pdfDocument;
            if (!doc || typeof doc.getData !== 'function') {
                return;
            }
            doc.getData().then(fileData => {
                if (isUnmounted || doc !== pdfDocument || typeof Blob === 'undefined') {
                    return;
                }
                return downloadFile(
                    fileName || `abner-vue-office-pdf-${new Date().getTime()}.pdf`,
                    new Blob([fileData], { type: 'application/pdf' })
                );
            }).catch(e => {
                if (!isUnmounted && doc === pdfDocument) {
                    emit('error', e);
                }
            });
        }

        return {
            containerRef,
            wrapperRef,
            save,
            onScrollPdf,
            rerender,
            userScale,
            getScale,
            setScale
        };
    }
});
</script>

<template>
    <div class="abner-vue-office-pdf" ref="containerRef" style="text-align: center;overflow: auto;position: relative;height: 100%;" @scroll="onScrollPdf">
        <div ref="wrapperRef"
             class="abner-vue-office-pdf-wrapper"
             style="background: gray; padding: 30px 0;position: relative;box-sizing: content-box"
             :style="{width: `${100 * (userScale < 1 ? 1 : userScale)}%`}"
        ></div>
        <slot></slot>
    </div>
</template>
