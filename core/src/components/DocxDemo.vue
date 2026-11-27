<script setup>
import { ref } from 'vue';
import AbnerVueOfficeDocx from '../../packages/vue-docx/index';
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

const defaultSrc = getStaticFileUrl('static/test-files/test.docx');
const docxRef = ref();
const requestOptions = {
    headers: {
        'component-name': 'AbnerVueOfficeDocx'
    }
};
</script>

<template>
  <PreviewWrapper
      accept=".docx"
      placeholder="请输入docx文件地址"
      :default-src="defaultSrc"
  >
    <template v-slot="slotProps">
      <AbnerVueOfficeDocx
          ref="docxRef"
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
