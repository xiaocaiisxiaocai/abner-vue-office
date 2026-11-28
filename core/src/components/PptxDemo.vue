<script setup>
import { ref } from 'vue';
import AbnerVueOfficePptx from '../../packages/vue-pptx/index';
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

const defaultSrc = getStaticFileUrl('static/test-files/test.pptx');
const pptxRef = ref();
const requestOptions = {
    headers: {}
};
</script>

<template>
  <PreviewWrapper
      accept=".pptx"
      placeholder="请输入pptx文件地址"
      :default-src="defaultSrc"
  >
    <template v-slot="slotProps">
       <AbnerVueOfficePptx
           ref="pptxRef"
           :src="slotProps.src"
           :request-options="requestOptions"
           style="flex: 1;height: 0"
           @rendered="onRendered"
           @error="onError"
       />
    </template>
  </PreviewWrapper>
</template>

<style scoped>
</style>
