<script>
import { defineComponent, ref, onMounted, onBeforeUnmount, watch } from 'vue-demi';
import { init as initPptxPreviewer } from 'pptx-preview';
import { download as downloadFile, normalizeFetchOptions } from '../../../utils/url';

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
        const rootRef = ref(null);

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

        function createViewer(targetEl) {
            const container = rootRef.value;
            const opts = props.options || {};
            const rect = container ? container.getBoundingClientRect() : { width: 960, height: 540 };
            const width = (typeof opts.width === 'number' && Number.isFinite(opts.width) && opts.width > 0)
                ? opts.width
                : (rect.width || 960);
            const height = (typeof opts.height === 'number' && Number.isFinite(opts.height) && opts.height > 0)
                ? opts.height
                : (rect.height || 540);
            return initPptxPreviewer(targetEl, {
                ...opts,
                width,
                height
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

        async function renderArrayBuffer(arrayBuffer, currentId, sourceRef) {
            if (isUnmounted || currentId !== renderId || !rootRef.value) {
                return;
            }
            const stageEl = document.createElement('div');
            let viewer = null;
            let didRender = false;
            let renderedPptx;
            try {
                viewer = createViewer(stageEl);
                const pptx = await viewer.preview(arrayBuffer);
                if (isUnmounted || currentId !== renderId || !rootRef.value) {
                    destroyViewer(viewer);
                    return;
                }
                destroyViewer(pptxViewer);
                rootRef.value.innerHTML = '';
                while (stageEl.firstChild) {
                    rootRef.value.appendChild(stageEl.firstChild);
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
                return renderArrayBuffer(arrayBuffer, currentId, currentSrc);
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
                return renderArrayBuffer(fileData, currentId, fileDataSrc);
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

        return {
            rootRef,
            save,
            rerender
        };
    }
});
</script>

<template>
    <div class="abner-vue-office-pptx" style="height: 100%;">
        <div class="abner-vue-office-pptx-main" ref="rootRef" style="width:100%; height: 100%;"></div>
    </div>
</template>
