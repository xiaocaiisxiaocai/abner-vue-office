<script setup>
import { ref } from 'vue';
import AbnerVueOfficeExcel from '../../packages/vue-excel/index';
import '../../packages/vue-excel/src/index.css';
import PreviewWrapper from '../common/PreviewWrapper.vue';
import useLoading from '../hooks/useLoading.js';
import { getStaticFileUrl } from '../hooks/usePreview.js';

function onRendered() {
    useLoading.hideLoading();
}
function onError(e) {
    console.log('出错', e);
    useLoading.hideLoading();
}

function transformData(data) {
    return data;
}

const defaultSrc = getStaticFileUrl('static/test-files/test.xlsx');
const excelRef = ref();

function beforeTransformData(data) {
    return data;
}

function switchSheet(sheetIndex) {
    console.log('当前sheet', sheetIndex);
}

function cellSelected(event) {
    console.log('点击了单元格', event);
}

function cellsSelected(event) {
    console.log('选择了单元格', event);
}
</script>

<template>
  <PreviewWrapper
      accept=".xlsx,.xls"
      placeholder="请输入xlsx/xls文件地址"
      :default-src="defaultSrc"
  >
    <template v-slot="slotProps">
      <AbnerVueOfficeExcel
          ref="excelRef"
          :src="slotProps.src"
          :options="{beforeTransformData, transformData, xls: slotProps.xls}"
          style="flex: 1;height: 0"
          @rendered="onRendered"
          @error="onError"
          @switchSheet="switchSheet"
          @cellSelected="cellSelected"
          @cellsSelected="cellsSelected"
      />
    </template>
  </PreviewWrapper>
</template>

<style scoped>
</style>
