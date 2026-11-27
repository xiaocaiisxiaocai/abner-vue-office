<script>
import { defineComponent, ref, onMounted, onBeforeUnmount, watch } from 'vue-demi';
import docx from './docx';
import { download as downloadFile } from '../../../utils/url';

export default defineComponent({
    name: 'AbnerVueOfficeDocx',
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
        const rootRef = ref(null);
        let fileData = null;
        let isUnmounted = false;
        let renderId = 0;
        let activeAbortController = null;
        let activeUserSignal = null;
        let activeUserSignalListener = null;

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

        function buildFetchOptions(reqOptions) {
            const opts = { ...(reqOptions || {}) };
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

        function init() {
            const container = rootRef.value;
            if (!container) {
                return;
            }
            abortActiveRequest();
            const currentId = ++renderId;
            const shouldCommit = () => !isUnmounted && currentId === renderId && !!rootRef.value;
            const fetchOptions = buildFetchOptions(props.requestOptions);
            docx.getData(props.src, fetchOptions).then(async res => {
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
                await docx.render(blob, container, props.options, shouldCommit);
                if (shouldCommit()) {
                    fileData = blob;
                }
                return true;
            }).then((rendered) => {
                if (rendered && shouldCommit()) {
                    emit('rendered');
                }
            }, e => {
                if (!shouldCommit()) {
                    return;
                }
                fileData = null;
                docx.render('', container, props.options, shouldCommit).catch(() => {}).then(() => {
                    if (shouldCommit()) {
                        emit('error', e);
                    }
                });
            });
        }

        onMounted(() => {
            if (props.src) {
                init();
            }
        });

        onBeforeUnmount(() => {
            isUnmounted = true;
            ++renderId;
            abortActiveRequest();
            if (rootRef.value && typeof docx.revokeContainerBlobUrls === 'function') {
                docx.revokeContainerBlobUrls(rootRef.value);
            }
            fileData = null;
        });

        watch(() => props.src, () => {
            if (!rootRef.value) {
                return;
            }
            if (props.src) {
                init();
            } else {
                abortActiveRequest();
                const currentId = ++renderId;
                const shouldCommit = () => !isUnmounted && currentId === renderId && !!rootRef.value;
                fileData = null;
                docx.render('', rootRef.value, props.options, shouldCommit).then(() => {
                    if (shouldCommit()) {
                        emit('rendered');
                    }
                }, () => {});
            }
        });

        function save(fileName) {
            Promise.resolve(
                downloadFile(fileName || `abner-vue-office-docx-${new Date().getTime()}.docx`, fileData)
            ).catch(e => {
                if (!isUnmounted) {
                    emit('error', e);
                }
            });
        }

        return {
            rootRef,
            save
        };
    }
});
</script>

<template>
    <div class="abner-vue-office-docx">
        <div class="abner-vue-office-docx-main" ref="rootRef"></div>
    </div>
</template>

<style lang="less">
.abner-vue-office-docx {
    height: 100%;
    overflow-y: auto;
    .docx-wrapper > section.docx,
    .abner-vue-office-docx-main > div > section {
        margin-bottom: 5px;
    }
}

@media screen and (max-width: 800px) {
    .abner-vue-office-docx {
        .docx-wrapper,
        .abner-vue-office-docx-main > div {
            padding: 10px;
        }
        .docx-wrapper > section.docx,
        .abner-vue-office-docx-main > div > section {
            padding: 10px !important;
            width: 100% !important;
        }
    }
}

</style>
