<script>
import { defineComponent, ref, onMounted, onBeforeUnmount, watch } from 'vue-demi';
import { init as initPptxPreviewer } from 'pptx-preview';
import { download as downloadFile, normalizeFetchOptions } from '../../../utils/url';

const DEFAULT_MAX_WIDTH = 1200;
const DEFAULT_BACKGROUND = '#f2f3f5';
const SCROLLBAR_RESERVE = 18;

function isPositiveFinite(val) {
    return typeof val === 'number' && Number.isFinite(val) && val > 0;
}

function resolveBackground(opts) {
    const bg = opts && opts.background;
    return typeof bg === 'string' && bg.trim() ? bg.trim() : DEFAULT_BACKGROUND;
}

function createDebounced(fn, wait) {
    let timer = null;
    const debounced = (...args) => {
        if (timer) {
            clearTimeout(timer);
        }
        timer = setTimeout(() => {
            timer = null;
            fn(...args);
        }, wait);
    };
    debounced.cancel = () => {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
    };
    return debounced;
}

function readElementWidth(el) {
    if (!el) {
        return 0;
    }
    if (typeof el.offsetWidth === 'number' && Number.isFinite(el.offsetWidth) && el.offsetWidth > 0) {
        return Math.round(el.offsetWidth);
    }
    if (typeof el.getBoundingClientRect === 'function') {
        const rect = el.getBoundingClientRect();
        if (rect && typeof rect.width === 'number' && Number.isFinite(rect.width) && rect.width > 0) {
            return Math.round(rect.width);
        }
    }
    if (typeof el.clientWidth === 'number' && Number.isFinite(el.clientWidth) && el.clientWidth > 0) {
        return Math.round(el.clientWidth);
    }
    return 0;
}

export default defineComponent({
    name: 'AbnerVueOfficePptx',
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
        options: {
            type: Object,
            default: () => ({})
        }
    },
    emits: ['rendered', 'error'],
    setup(props, { emit }) {
        let pptxViewer = null;
        let fileData = null;
        let fileDataSrc = null;
        let isUnmounted = false;
        let isLoading = false;
        let activeLoadPromise = null;
        let activeAbortController = null;
        let activeUserSignal = null;
        let activeUserSignalListener = null;
        let renderId = 0;
        let resizeObserver = null;
        let resizeRerenderDebounced = null;
        let lastObservedWidth = 0;
        const containerRef = ref(null);
        const rootRef = ref(null);
        const resolvedBackground = ref(resolveBackground(props.options));

        function abortActiveRequest() {
            if (activeUserSignal && activeUserSignalListener) {
                activeUserSignal.removeEventListener('abort', activeUserSignalListener);
            }
            activeUserSignal = null;
            activeUserSignalListener = null;
            if (activeAbortController) {
                activeAbortController.abort();
                activeAbortController = null;
            }
        }

        function buildFetchOptions() {
            const opts = normalizeFetchOptions(props.requestOptions);
            if (typeof AbortController === 'undefined') {
                return opts;
            }
            const controller = new AbortController();
            activeAbortController = controller;
            const userSignal = opts.signal;
            if (userSignal && typeof userSignal.addEventListener === 'function') {
                if (userSignal.aborted) {
                    controller.abort();
                } else {
                    const onAbort = () => controller.abort();
                    userSignal.addEventListener('abort', onAbort, { once: true });
                    activeUserSignal = userSignal;
                    activeUserSignalListener = onAbort;
                }
            }
            opts.signal = controller.signal;
            return opts;
        }

        function destroyViewer(viewer) {
            if (viewer && typeof viewer.destroy === 'function') {
                viewer.destroy();
            }
        }

        function getLayoutContainer() {
            if (containerRef.value) {
                return containerRef.value;
            }
            if (rootRef.value && rootRef.value.parentNode && typeof rootRef.value.parentNode.getBoundingClientRect === 'function') {
                return rootRef.value.parentNode;
            }
            return rootRef.value;
        }

        function resolveLayoutMetrics() {
            const opts = props.options || {};
            const container = getLayoutContainer();
            const rect = container && typeof container.getBoundingClientRect === 'function'
                ? container.getBoundingClientRect()
                : { width: 0, height: 0 };
            const containerWidth = (container && container.offsetWidth > 0 ? container.offsetWidth : 0)
                || (container && container.clientWidth > 0 ? container.clientWidth : 0)
                || (rect && rect.width > 0 ? rect.width : 0)
                || 960;
            const containerHeight = (container && container.clientHeight > 0 ? container.clientHeight : 0)
                || (rect && rect.height > 0 ? rect.height : 0)
                || 540;
            const horizontalPadding = containerWidth <= 640 ? 12 : 20;
            const maxWidth = isPositiveFinite(opts.maxWidth)
                ? opts.maxWidth
                : (opts.maxWidth === 0 || opts.maxWidth === Infinity ? Infinity : DEFAULT_MAX_WIDTH);
            const availableWidth = Math.max(120, Math.floor(containerWidth - horizontalPadding * 2 - SCROLLBAR_RESERVE));
            const width = isPositiveFinite(opts.width) ? opts.width : Math.min(maxWidth, availableWidth);
            const height = isPositiveFinite(opts.height) ? opts.height : containerHeight;
            return {
                width,
                height,
                horizontalPadding
            };
        }

        function normalizePreviewLayout(stageEl, metrics) {
            if (!stageEl || typeof stageEl.querySelector !== 'function') {
                return;
            }
            const wrapper = stageEl.querySelector('.pptx-preview-wrapper');
            if (wrapper && wrapper.style) {
                wrapper.style.width = '100%';
                wrapper.style.minWidth = `${Math.ceil(metrics.width + metrics.horizontalPadding * 2)}px`;
                wrapper.style.height = 'auto';
                wrapper.style.minHeight = '100%';
                wrapper.style.margin = '0';
                wrapper.style.padding = `16px ${metrics.horizontalPadding}px`;
                wrapper.style.boxSizing = 'border-box';
                wrapper.style.overflowX = 'visible';
                wrapper.style.overflowY = 'visible';
                wrapper.style.background = 'transparent';
            }
            if (typeof stageEl.querySelectorAll === 'function') {
                const slides = stageEl.querySelectorAll('.pptx-preview-slide-wrapper');
                for (let i = 0; i < slides.length; i += 1) {
                    const slide = slides[i];
                    if (slide && slide.style) {
                        slide.style.margin = i === slides.length - 1 ? '0 auto' : '0 auto 16px';
                        slide.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.12)';
                        slide.style.borderRadius = '2px';
                    }
                }
            }
        }

        function createViewer(targetEl, metrics) {
            const opts = props.options || {};
            return initPptxPreviewer(targetEl, {
                ...opts,
                width: metrics.width,
                height: metrics.height
            });
        }

        function getPptxData(src) {
            if (typeof src === 'string') {
                return fetch(src, buildFetchOptions()).then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return response.arrayBuffer();
                });
            }
            if (src instanceof ArrayBuffer) {
                return Promise.resolve(src);
            }
            if (ArrayBuffer.isView(src)) {
                return Promise.resolve(src.buffer.slice(src.byteOffset, src.byteOffset + src.byteLength));
            }
            if (typeof Blob !== 'undefined' && src instanceof Blob) {
                return src.arrayBuffer();
            }
            if (typeof Response !== 'undefined' && src instanceof Response) {
                return src.arrayBuffer();
            }
            return Promise.reject(new Error('不支持的 src 格式'));
        }

        async function renderArrayBuffer(arrayBuffer, currentId, sourceRef, preserveScroll = false) {
            if (isUnmounted || currentId !== renderId || !rootRef.value) {
                return;
            }
            const metrics = resolveLayoutMetrics();
            const stageEl = document.createElement('div');
            let viewer = null;
            let didRender = false;
            let renderedPptx;
            try {
                viewer = createViewer(stageEl, metrics);
                const pptx = await viewer.preview(arrayBuffer);
                if (isUnmounted || currentId !== renderId || !rootRef.value) {
                    destroyViewer(viewer);
                    return;
                }
                normalizePreviewLayout(stageEl, metrics);
                const scrollEl = containerRef.value;
                let scrollRatio = 0;
                if (preserveScroll && scrollEl) {
                    const maxScroll = Math.max(0, (scrollEl.scrollHeight || 0) - (scrollEl.clientHeight || 0));
                    if (maxScroll > 0 && typeof scrollEl.scrollTop === 'number') {
                        scrollRatio = scrollEl.scrollTop / maxScroll;
                    }
                }
                destroyViewer(pptxViewer);
                rootRef.value.innerHTML = '';
                while (stageEl.firstChild) {
                    rootRef.value.appendChild(stageEl.firstChild);
                }
                if (scrollEl) {
                    if (preserveScroll && scrollRatio > 0) {
                        const nextMaxScroll = Math.max(0, (scrollEl.scrollHeight || 0) - (scrollEl.clientHeight || 0));
                        scrollEl.scrollTop = Math.round(scrollRatio * nextMaxScroll);
                    } else if (!preserveScroll) {
                        scrollEl.scrollTop = 0;
                        scrollEl.scrollLeft = 0;
                    }
                }
                if (viewer && typeof viewer === 'object') {
                    viewer.dom = rootRef.value;
                }
                pptxViewer = viewer;
                fileData = arrayBuffer;
                fileDataSrc = sourceRef;
                renderedPptx = pptx;
                didRender = true;
            } catch (e) {
                destroyViewer(viewer);
                if (!isUnmounted && currentId === renderId) {
                    destroyViewer(pptxViewer);
                    pptxViewer = null;
                    fileData = null;
                    fileDataSrc = null;
                    if (rootRef.value) {
                        rootRef.value.innerHTML = '';
                    }
                    emit('error', e);
                }
            }
            if (didRender && !isUnmounted && currentId === renderId) {
                emit('rendered', renderedPptx);
            }
        }

        function preview() {
            abortActiveRequest();
            resizeRerenderDebounced && resizeRerenderDebounced.cancel();
            if (!props.src) {
                ++renderId;
                isLoading = false;
                activeLoadPromise = null;
                fileData = null;
                fileDataSrc = null;
                destroyViewer(pptxViewer);
                pptxViewer = null;
                if (rootRef.value) {
                    rootRef.value.innerHTML = '';
                }
                return Promise.resolve();
            }
            const currentId = ++renderId;
            const currentSrc = props.src;
            isLoading = true;
            const loadPromise = getPptxData(currentSrc).then(arrayBuffer => {
                if (isUnmounted || currentId !== renderId || !rootRef.value) {
                    return;
                }
                return renderArrayBuffer(arrayBuffer, currentId, currentSrc, false);
            }).catch(e => {
                if (!isUnmounted && currentId === renderId) {
                    destroyViewer(pptxViewer);
                    pptxViewer = null;
                    fileData = null;
                    fileDataSrc = null;
                    if (rootRef.value) {
                        rootRef.value.innerHTML = '';
                    }
                    emit('error', e);
                }
            }).finally(() => {
                if (currentId === renderId) {
                    isLoading = false;
                    activeLoadPromise = null;
                }
            });
            activeLoadPromise = loadPromise;
            return loadPromise;
        }

        function rerender() {
            if (isUnmounted || !rootRef.value) {
                return Promise.resolve();
            }
            if (!props.src) {
                return preview();
            }
            if (isLoading && activeLoadPromise) {
                return activeLoadPromise;
            }
            if (fileData && fileDataSrc === props.src) {
                const currentId = ++renderId;
                return renderArrayBuffer(fileData, currentId, fileDataSrc, true);
            }
            return preview();
        }

        function save(fileName) {
            Promise.resolve(
                downloadFile(fileName || `abner-vue-office-pptx-${new Date().getTime()}.pptx`, fileData)
            ).catch(e => {
                if (!isUnmounted) {
                    emit('error', e);
                }
            });
        }

        onMounted(() => {
            resizeRerenderDebounced = createDebounced(() => {
                if (isUnmounted || isLoading || !fileData || fileDataSrc !== props.src) {
                    return;
                }
                const currentId = ++renderId;
                renderArrayBuffer(fileData, currentId, fileDataSrc, true);
            }, 150);

            const targetContainer = getLayoutContainer();
            if (typeof ResizeObserver !== 'undefined' && targetContainer) {
                lastObservedWidth = readElementWidth(targetContainer);
                resizeObserver = new ResizeObserver(() => {
                    if (isUnmounted) {
                        return;
                    }
                    const el = getLayoutContainer();
                    const nextW = readElementWidth(el);
                    if (nextW > 0 && Math.abs(nextW - lastObservedWidth) >= 2) {
                        lastObservedWidth = nextW;
                        if (!isPositiveFinite((props.options || {}).width) && fileData && !isLoading && fileDataSrc === props.src) {
                            resizeRerenderDebounced && resizeRerenderDebounced();
                        }
                    }
                });
                resizeObserver.observe(targetContainer);
            }

            if (props.src) {
                preview();
            }
        });

        onBeforeUnmount(() => {
            isUnmounted = true;
            isLoading = false;
            activeLoadPromise = null;
            ++renderId;
            abortActiveRequest();
            if (resizeRerenderDebounced) {
                resizeRerenderDebounced.cancel();
                resizeRerenderDebounced = null;
            }
            if (resizeObserver) {
                resizeObserver.disconnect();
                resizeObserver = null;
            }
            destroyViewer(pptxViewer);
            if (rootRef.value) {
                rootRef.value.innerHTML = '';
            }
            pptxViewer = null;
            fileData = null;
            fileDataSrc = null;
        });

        watch(() => props.src, () => {
            if (!rootRef.value) {
                return;
            }
            preview();
        });

        watch(() => resolveBackground(props.options), (nextBg) => {
            resolvedBackground.value = nextBg;
        });

        watch(
            () => {
                const o = props.options || {};
                return [o.width, o.height, o.maxWidth, o.renderer];
            },
            (nextVals, prevVals) => {
                if (!prevVals || nextVals.every((v, idx) => Object.is(v, prevVals[idx]))) {
                    return;
                }
                if (isUnmounted || !rootRef.value || isLoading || !fileData || fileDataSrc !== props.src) {
                    return;
                }
                resizeRerenderDebounced && resizeRerenderDebounced();
            }
        );

        return {
            containerRef,
            rootRef,
            resolvedBackground,
            save,
            rerender
        };
    }
});
</script>

<template>
    <div
        class="abner-vue-office-pptx"
        ref="containerRef"
        style="width: 100%; height: 100%; overflow: auto; box-sizing: border-box;"
        :style="{ background: resolvedBackground }"
    >
        <div
            class="abner-vue-office-pptx-main"
            ref="rootRef"
            style="width: 100%; min-height: 100%; box-sizing: border-box;"
        ></div>
    </div>
</template>
