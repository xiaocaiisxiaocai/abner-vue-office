<template>
<div ref="dom" style="height: calc(100vh - 50px)"></div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue';
import jsExcel from '../../packages/js-excel/index';
import '../../packages/js-excel/index.css';
import { getStaticFileUrl } from '../hooks/usePreview.js';

const dom = ref(null);
let myExcelPreview = null;

onMounted(() => {
    if (!dom.value) {
        return;
    }
    myExcelPreview = jsExcel.init(dom.value, {
        transformData: function (workBook) {
            return workBook;
        },
        cellSelected(event) {
            console.log(event);
        }
    });
    myExcelPreview.preview(getStaticFileUrl('static/test-files/test.xlsx')).catch(err => {
        console.log('err', err);
    });
});

onBeforeUnmount(() => {
    if (myExcelPreview && typeof myExcelPreview.destroy === 'function') {
        myExcelPreview.destroy();
    }
    myExcelPreview = null;
});
</script>

<style scoped>
</style>
