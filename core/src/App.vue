<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';

const router = useRouter();
const route = useRoute();
const current = ref([]);

const MENU_KEYS = ['js-docx', 'js-excel', 'js-pdf', 'docx', 'excel', 'pdf', 'pptx'];

function syncMenu(pathOrHash) {
    const cleanPath = String(pathOrHash || '').split('?')[0].replace(/^#/, '').replace(/^\/+/, '');
    let currentRoute = 'docx';
    for (let i = 0; i < MENU_KEYS.length; i += 1) {
        const key = MENU_KEYS[i];
        if (cleanPath === key || cleanPath.startsWith(`${key}/`)) {
            currentRoute = key;
            break;
        }
    }
    current.value = [currentRoute];
}

function getEffectivePath(pathVal) {
    const hash = typeof location !== 'undefined' ? location.hash : '';
    if ((!pathVal || pathVal === '/') && hash && hash !== '#' && hash !== '#/') {
        return hash;
    }
    return pathVal || hash || '';
}

onMounted(() => {
    syncMenu(getEffectivePath(route.path));
});

watch(() => route.path, (newPath) => {
    syncMenu(getEffectivePath(newPath));
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
          <a-menu-item key="js-docx">
              js-docx预览
          </a-menu-item>
          <a-menu-item key="js-excel">
              js-excel预览
          </a-menu-item>
          <a-menu-item key="js-pdf">
              js-pdf预览
          </a-menu-item>
      </a-menu>
      <router-view/>
  </div>
</template>

<style scoped>
</style>
