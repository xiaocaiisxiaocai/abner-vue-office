<script setup>
import { ref, watch, onBeforeUnmount } from 'vue';
import { UploadOutlined } from '@ant-design/icons-vue';
import usePreview, { isXlsName } from '../hooks/usePreview.js';
import useLoading from '../hooks/useLoading.js';
import { isTest } from '../../utils/test.js';

const props = defineProps({
  accept: String,
  placeholder: String,
  defaultSrc: String
});

const { type, inputSrc, src, xls, beforeUpload, cancelRead } = usePreview(props.defaultSrc);
const retryKey = ref(0);

function handlePreview() {
    if (typeof cancelRead === 'function') {
        cancelRead();
    }
    const trimmed = typeof inputSrc.value === 'string' ? inputSrc.value.trim() : inputSrc.value;
    inputSrc.value = trimmed;
    xls.value = isXlsName(trimmed);
    if (src.value === trimmed) {
        retryKey.value += 1;
    } else {
        src.value = trimmed;
    }
}

watch(type, () => {
    if (typeof cancelRead === 'function') {
        cancelRead();
    }
});

watch([src, retryKey], ([val]) => {
    if (val) {
        useLoading.showLoading();
    } else {
        useLoading.hideLoading();
    }
}, {
    immediate: true
});

onBeforeUnmount(() => {
    if (typeof cancelRead === 'function') {
        cancelRead();
    }
    useLoading.hideLoading();
});
</script>

<template>
  <div class="preview-wrapper">
    <div class="operate-area" v-if="!isTest()">
      <a-radio-group v-model:value="type" button-style="solid">
        <a-radio-button value="url">远程文件地址</a-radio-button>
        <a-radio-button value="upload">上传本地文件</a-radio-button>
      </a-radio-group>
      <a-input
          v-if="type==='url'"
          v-model:value="inputSrc"
          :placeholder="props.placeholder"
          @pressEnter="handlePreview"
          style="width: 600px; max-width: 100%; margin-left:10px;"
      />
      <a-button
          v-if="type==='url'"
          type="primary"
          style="margin-left: 10px"
          @click="handlePreview"
      >
        预览
      </a-button>
      <a-upload
          v-if="type !== 'url'"
          :accept="props.accept"
          action=""
          :beforeUpload="beforeUpload"
          :file-list="[]"
      >
        <a-button style="margin-left: 10px">
          <upload-outlined></upload-outlined>
          选择文件
        </a-button>
      </a-upload>

    </div>
    <div :key="retryKey" style="display: contents">
      <slot :src="src" :xls="xls"></slot>
    </div>
  </div>
</template>

<style scoped>
.preview-wrapper{
  height: calc(100vh - 46px);
  display: flex;
  flex-direction: column;
}
.operate-area {
  display: flex;
  margin: 10px;
  align-items: center;
  flex-wrap: wrap;
}
</style>
