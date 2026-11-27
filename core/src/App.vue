<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';

const router = useRouter();
const route = useRoute();
const current = ref([]);

function syncMenu(pathOrHash) {
    const cleanPath = String(pathOrHash || '').split('?')[0].replace(/^#/, '');
    let currentRoute = 'docx';
    if (cleanPath.includes('excel')) {
        currentRoute = 'excel';
    } else if (cleanPath.includes('pdf')) {
        currentRoute = 'pdf';
    } else if (cleanPath.includes('pptx')) {
        currentRoute = 'pptx';
    }
    current.value = [currentRoute];
}

onMounted(() => {
    syncMenu(route.path || (typeof location !== 'undefined' ? location.hash : '') || '');
});

watch(() => route.path, (newPath) => {
    syncMenu(newPath || (typeof location !== 'undefined' ? location.hash : '') || '');
});

function go({ key }) {
    const targetPath = key.startsWith('/') ? key : `/${key}`;
    router.push({
        path: targetPath,
        query: { ...route.query }
    });
}
</script>

<template>
  <div>
      <a-menu v-model:selectedKeys="current" mode="horizontal" @click="go">
          <a-menu-item key="docx">
             docx文件预览
          </a-menu-item>
          <a-menu-item key="excel">
              excel文件预览
          </a-menu-item>
          <a-menu-item key="pdf">
              pdf文件预览
          </a-menu-item>
          <a-menu-item key="pptx">
              pptx文件预览
          </a-menu-item>
      </a-menu>
      <router-view/>
  </div>
</template>

<style scoped>
</style>
