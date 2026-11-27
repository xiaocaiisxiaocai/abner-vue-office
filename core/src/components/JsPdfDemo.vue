<template>
<div ref="dom" style="height: calc(100vh - 50px);"></div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue';
import jsPdf from '../../packages/js-pdf/index';
import { getStaticFileUrl } from '../hooks/usePreview.js';

const dom = ref(null);
let myPdfPreview = null;

onMounted(() => {
    myPdfPreview = jsPdf.init(dom.value, {
        onError: (e) => {
            console.log('发生错误', e);
        },
        onRendered: () => {
            console.log('渲染完成');
        }
    });
    myPdfPreview.preview(getStaticFileUrl('static/test-files/test.pdf')).catch(err => {
        console.log('err', err);
    });
});

onBeforeUnmount(() => {
    if (myPdfPreview && typeof myPdfPreview.destroy === 'function') {
        myPdfPreview.destroy();
    }
    myPdfPreview = null;
});
</script>

<style scoped>
</style>
