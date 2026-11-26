<script>
import { defineComponent, ref, onMounted, onBeforeUnmount, watch } from 'vue-demi';
import docx from './docx';
import { download as downloadFile } from '../../../utils/url';

export default defineComponent({
    name: 'AbnerVueOfficeDocx',
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
            docx.getData(props.src, props.requestOptions).then(async res => {
                if (isUnmounted || currentId !== renderId || !rootRef.value) {
                    return;
                }
                fileData = await docx.getBlob(res);
                if (isUnmounted || currentId !== renderId || !rootRef.value) {
                    return;
                }
                docx.render(fileData, container, props.options).then(() => {
                    if (!isUnmounted && currentId === renderId) {
                        emit('rendered');
                    }
                }).catch(e => {
                    if (isUnmounted || currentId !== renderId || !rootRef.value) {
                        return;
                    }
                    docx.render('', container, props.options);
                    emit('error', e);
                });
            }).catch(e => {
                if (isUnmounted || currentId !== renderId || !rootRef.value) {
                    return;
                }
                docx.render('', container, props.options);
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
            fileData = null;
        });

        watch(() => props.src, () => {
            if (props.src) {
                init();
            } else {
                const currentId = ++renderId;
                fileData = null;
                docx.render('', rootRef.value, props.options).then(() => {
                    if (!isUnmounted && currentId === renderId) {
                        emit('rendered');
                    }
                });
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
