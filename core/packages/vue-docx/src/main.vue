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

        function init() {
            const container = rootRef.value;
            if (!container) {
                return;
            }
            const currentId = ++renderId;
            const shouldCommit = () => !isUnmounted && currentId === renderId && !!rootRef.value;
            docx.getData(props.src, props.requestOptions).then(async res => {
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
                fileData = blob;
                docx.render(blob, container, props.options, shouldCommit).then(() => {
                    if (!isUnmounted && currentId === renderId) {
                        emit('rendered');
                    }
                }).catch(e => {
                    if (!shouldCommit()) {
                        return;
                    }
                    fileData = null;
                    docx.render('', container, props.options, shouldCommit).catch(() => {});
                    emit('error', e);
                });
            }).catch(e => {
                if (!shouldCommit()) {
                    return;
                }
                fileData = null;
                docx.render('', container, props.options, shouldCommit).catch(() => {});
                emit('error', e);
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
            fileData = null;
        });

        watch(() => props.src, () => {
            if (!rootRef.value) {
                return;
            }
            if (props.src) {
                init();
            } else {
                const currentId = ++renderId;
                const shouldCommit = () => !isUnmounted && currentId === renderId && !!rootRef.value;
                fileData = null;
                docx.render('', rootRef.value, props.options, shouldCommit).then(() => {
                    if (shouldCommit()) {
                        emit('rendered');
                    }
                }).catch(() => {});
            }
        });

        function save(fileName) {
            downloadFile(fileName || `abner-vue-office-docx-${new Date().getTime()}.docx`, fileData);
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
    .docx-wrapper {
        > section.docx {
           margin-bottom: 5px;
        }
    }
}

@media screen and (max-width: 800px) {
    .abner-vue-office-docx {
        .docx-wrapper {
            padding: 10px;

            > section.docx {
                padding: 10px !important;
                width: 100% !important;
            }
        }
    }
}

</style>
