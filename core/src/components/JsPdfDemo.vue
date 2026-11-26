<template>
<div ref="dom" style="height: calc(100vh - 50px);">

</div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue';
import jsPdf from '../../packages/js-pdf/index';

const dom = ref(null);
const baseUrl = location.origin + (location.pathname + '/').replace('//', '/');

onMounted(() => {
    window.myPdfPreview = jsPdf.init(dom.value, {
        onError: (e) => {
            console.log('发生错误', e);
        },
        onRendered: () => {
            console.log('渲染完成');
        }
    });
    window.myPdfPreview.preview(`${baseUrl}static/test-files/test.pdf`).catch(err => {
        console.log('err', err);
    });
});

onBeforeUnmount(() => {
    if (window.myPdfPreview && typeof window.myPdfPreview.destroy === 'function') {
        window.myPdfPreview.destroy();
        window.myPdfPreview = null;
    }
});
</script>

<style scoped>

</style>
