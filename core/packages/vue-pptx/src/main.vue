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
        let isUnmounted = false;
        let renderId = 0;
        const rootRef = ref(null);

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
                return fetch(src, normalizeFetchOptions(props.requestOptions)).then(response => {
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

        function renderArrayBuffer(arrayBuffer, currentId) {
            if (isUnmounted || currentId !== renderId || !rootRef.value) {
                return Promise.resolve();
            }
            const stageEl = document.createElement('div');
            const viewer = createViewer(stageEl);
            return viewer.preview(arrayBuffer).then((pptx) => {
                if (isUnmounted || currentId !== renderId || !rootRef.value) {
                    destroyViewer(viewer);
                    return;
                }
                destroyViewer(pptxViewer);
                rootRef.value.innerHTML = '';
                while (stageEl.firstChild) {
                    rootRef.value.appendChild(stageEl.firstChild);
                }
                pptxViewer = viewer;
                fileData = arrayBuffer;
                emit('rendered', pptx);
            }).catch(e => {
                destroyViewer(viewer);
                if (!isUnmounted && currentId === renderId) {
                    destroyViewer(pptxViewer);
                    pptxViewer = null;
                    fileData = null;
                    if (rootRef.value) {
                        rootRef.value.innerHTML = '';
                    }
                    emit('error', e);
                }
            });
        }

        function preview() {
            if (!props.src) {
                ++renderId;
                fileData = null;
                destroyViewer(pptxViewer);
                pptxViewer = null;
                if (rootRef.value) {
                    rootRef.value.innerHTML = '';
                }
                return Promise.resolve();
            }
            const currentId = ++renderId;
            return getPptxData(props.src).then(arrayBuffer => {
                if (isUnmounted || currentId !== renderId || !rootRef.value) {
                    return;
                }
                return renderArrayBuffer(arrayBuffer, currentId);
            }).catch(e => {
                if (!isUnmounted && currentId === renderId) {
                    destroyViewer(pptxViewer);
                    pptxViewer = null;
                    fileData = null;
                    if (rootRef.value) {
                        rootRef.value.innerHTML = '';
                    }
                    emit('error', e);
                }
            });
        }

        function rerender() {
            if (isUnmounted || !rootRef.value) {
                return Promise.resolve();
            }
            if (!props.src) {
                return preview();
            }
            if (fileData) {
                const currentId = ++renderId;
                return renderArrayBuffer(fileData, currentId);
            }
            return preview();
        }

        function save(fileName) {
            downloadFile(fileName || `abner-vue-office-pptx-${new Date().getTime()}.pptx`, fileData);
        }

        onMounted(() => {
            if (props.src) {
                preview();
            }
        });

        onBeforeUnmount(() => {
            isUnmounted = true;
            ++renderId;
            destroyViewer(pptxViewer);
            if (rootRef.value) {
                rootRef.value.innerHTML = '';
            }
            pptxViewer = null;
            fileData = null;
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
    <div class="abner-vue-office-pptx">
        <div class="abner-vue-office-pptx-main" ref="rootRef" style="width:100%; height: 100%;"></div>
    </div>
</template>
<style lang="less">
</style>
