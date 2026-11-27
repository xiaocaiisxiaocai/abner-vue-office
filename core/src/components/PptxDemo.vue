<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
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
const calcPptxWidth = () => (typeof window !== 'undefined' ? Math.min(960, window.innerWidth) : 960);
const pptxWidth = ref(calcPptxWidth());
const requestOptions = {
    headers: {}
};

function handleResize() {
    pptxWidth.value = calcPptxWidth();
}

onMounted(() => {
    if (typeof window !== 'undefined') {
        window.addEventListener('resize', handleResize);
    }
});

onBeforeUnmount(() => {
    if (typeof window !== 'undefined') {
        window.removeEventListener('resize', handleResize);
    }
});
</script>

<template>
  <PreviewWrapper
      accept=".pptx"
      placeholder="请输入pptx文件地址"
      :default-src="defaultSrc"
  >
    <template v-slot="slotProps">
       <div style="flex: 1;height: 0; background: black">
           <AbnerVueOfficePptx
               ref="pptxRef"
               :src="slotProps.src"
               :request-options="requestOptions"
               style="height: 100%"
               :options="{width: pptxWidth}"
               @rendered="onRendered"
               @error="onError"
           />
       </div>
    </template>
  </PreviewWrapper>
</template>

<style scoped>
</style>
