<script setup>
import { ref } from 'vue';
import AbnerVueOfficePdf from '../../packages/vue-pdf/index';
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

const defaultSrc = getStaticFileUrl('static/test-files/test.pdf');
const pdfRef = ref();
const requestOptions = {
    headers: {
        'component-name': 'AbnerVueOfficePdf'
    }
};
</script>

<template>
  <PreviewWrapper
      accept=".pdf"
      placeholder="请输入pdf文件地址"
      :default-src="defaultSrc"
  >
    <template v-slot="slotProps">
      <AbnerVueOfficePdf
          ref="pdfRef"
          :src="slotProps.src"
          style="flex: 1;height: 0"
          :request-options="requestOptions"
          @rendered="onRendered"
          @error="onError"
      />
    </template>
  </PreviewWrapper>
</template>

<style scoped>
</style>
