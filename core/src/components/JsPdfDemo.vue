<template>
<div ref="dom" style="height: calc(100vh - 50px);">
    
</div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue';
import jsPdf from '../../packages/js-pdf/index';

const dom = ref(null);
onMounted(() => {
    window.myPdfPreview = jsPdf.init(dom.value, {
        onError: (e) => {
            console.log('发生错误', e);
        },
        onRendered: () => {
            console.log('渲染完成');
        }
    });
    window.myPdfPreview.preview('/abner-vue-office/examples/dist/static/test-files/test.pdf');
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
