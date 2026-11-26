<template>
<div ref="dom" style="height: calc(100vh - 50px)">

</div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue';
import jsExcel from '../../packages/js-excel/index';
import '../../packages/js-excel/index.css';

const dom = ref(null);
const baseUrl = location.origin + (location.pathname + '/').replace('//', '/');

onMounted(() => {
    window.myExcelPreview = jsExcel.init(dom.value, {
        transformData: function (workBook) {
            console.log('transformData', workBook);
            return workBook;
        },
        cellSelected(event) {
            console.log(event);
        }
    });
    window.myExcelPreview.preview(`${baseUrl}static/test-files/test.xlsx`).then(() => {
        console.log('excel preview done', window.myExcelPreview);
    }).catch(err => {
        console.log('err', err);
    });
});

onBeforeUnmount(() => {
    if (window.myExcelPreview && typeof window.myExcelPreview.destroy === 'function') {
        window.myExcelPreview.destroy();
        window.myExcelPreview = null;
    }
});
</script>

<style scoped>

</style>
