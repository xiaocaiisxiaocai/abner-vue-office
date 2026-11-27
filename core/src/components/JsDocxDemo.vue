<template>
<div ref="dom" style="height: calc(100vh - 50px);"></div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue';
import jsDocx from '../../packages/js-docx/index';
import '../../packages/js-docx/index.css';
import { getStaticFileUrl } from '../hooks/usePreview.js';

const dom = ref(null);
let myDocxPreview = null;
let switchTimer = null;

onMounted(() => {
    if (!dom.value) {
        return;
    }
    myDocxPreview = jsDocx.init(dom.value);
    myDocxPreview.preview(getStaticFileUrl('static/test-files/test.docx')).then(() => {
        if (!myDocxPreview) {
            return;
        }
        switchTimer = setTimeout(() => {
            switchTimer = null;
            if (myDocxPreview) {
                myDocxPreview.preview(getStaticFileUrl('static/test-files/test2.docx')).catch(err => {
                    console.log('err', err);
                });
            }
        }, 3000);
    }).catch(err => {
        console.log('err', err);
    });
});

onBeforeUnmount(() => {
    if (switchTimer) {
        clearTimeout(switchTimer);
        switchTimer = null;
    }
    if (myDocxPreview && typeof myDocxPreview.destroy === 'function') {
        myDocxPreview.destroy();
    }
    myDocxPreview = null;
});
</script>

<style scoped>
</style>
