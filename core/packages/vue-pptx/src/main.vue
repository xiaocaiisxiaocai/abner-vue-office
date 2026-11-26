<script>
import { defineComponent, ref, onMounted, onBeforeUnmount, watch } from 'vue-demi';
import { init as initPptxPreviewer } from 'pptx-preview';
import { download as downloadFile, normalizeFetchOptions } from '../../../utils/url';

export default defineComponent({
    name: 'AbnerVueOfficePptx',
    props: {
        src: [String, ArrayBuffer, Blob],
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

        function init() {
            const container = rootRef.value;
            if (!container) {
                return;
            }
            const width = props.options.width || container.getBoundingClientRect().width || 960;
            const height = props.options.height || container.getBoundingClientRect().height || 540;
            pptxViewer = initPptxPreviewer(container, {
                ...props.options,
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
            if (src instanceof Blob) {
                return src.arrayBuffer();
            }
            return Promise.reject(new Error('不支持的 src 格式'));
        }

        function preview() {
            if (!props.src) {
                ++renderId;
                fileData = null;
                if (rootRef.value) {
                    rootRef.value.innerHTML = '';
                }
                if (pptxViewer && typeof pptxViewer.destroy === 'function') {
                    pptxViewer.destroy();
                }
                pptxViewer = null;
                return;
            }
            if (!pptxViewer) {
                init();
            }
            const currentId = ++renderId;
            getPptxData(props.src).then(arrayBuffer => {
                if (isUnmounted || currentId !== renderId || !pptxViewer) {
                    return;
                }
                fileData = arrayBuffer;
                pptxViewer.preview(arrayBuffer).then((pptx) => {
                    if (!isUnmounted && currentId === renderId) {
                        emit('rendered', pptx);
                    }
                }).catch(e => {
                    if (!isUnmounted && currentId === renderId) {
                        fileData = null;
                        if (rootRef.value) {
                            rootRef.value.innerHTML = '';
                        }
                        pptxViewer = null;
                        emit('error', e);
                    }
                });
            }).catch(e => {
                if (!isUnmounted && currentId === renderId) {
                    fileData = null;
                    if (rootRef.value) {
                        rootRef.value.innerHTML = '';
                    }
                    pptxViewer = null;
                    emit('error', e);
                }
            });
        }

        function rerender() {
            if (isUnmounted || !rootRef.value) {
                return Promise.resolve();
            }
            if (pptxViewer && typeof pptxViewer.destroy === 'function') {
                pptxViewer.destroy();
            }
            pptxViewer = null;
            rootRef.value.innerHTML = '';
            if (!props.src) {
                return Promise.resolve();
            }
            init();
            if (fileData) {
                const currentId = ++renderId;
                return pptxViewer.preview(fileData).then((pptx) => {
                    if (!isUnmounted && currentId === renderId) {
                        emit('rendered', pptx);
                    }
                }).catch(e => {
                    if (!isUnmounted && currentId === renderId) {
                        fileData = null;
                        if (rootRef.value) {
                            rootRef.value.innerHTML = '';
                        }
                        pptxViewer = null;
                        emit('error', e);
                    }
                });
            }
            preview();
            return Promise.resolve();
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
            if (pptxViewer && typeof pptxViewer.destroy === 'function') {
                pptxViewer.destroy();
            }
            if (rootRef.value) {
                rootRef.value.innerHTML = '';
            }
            pptxViewer = null;
            fileData = null;
        });

        watch(() => props.src, () => {
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
