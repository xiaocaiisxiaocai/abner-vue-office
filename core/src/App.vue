<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';

const router = useRouter();
const route = useRoute();
const current = ref([]);

function syncMenu(pathOrHash) {
    let currentRoute = 'docx';
    if (pathOrHash.includes('excel')) {
        currentRoute = 'excel';
    } else if (pathOrHash.includes('pdf')) {
        currentRoute = 'pdf';
    } else if (pathOrHash.includes('pptx')) {
        currentRoute = 'pptx';
    }
    current.value = [currentRoute];
}

onMounted(() => {
    syncMenu(location.hash || route.path || '');
});

watch(() => route.path, (newPath) => {
    syncMenu(newPath || location.hash || '');
});

function go({ key }) {
    router.push({
        path: key,
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
:deep(.ant-tabs-nav-wrap) {
  padding-left: 20px !important;
}
</style>
