<template>
<div ref="dom">

</div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue';
import jsDocx from '../../packages/js-docx/index';
import '../../packages/js-docx/index.css';

const dom = ref(null);
const baseUrl = location.origin + (location.pathname + '/').replace('//', '/');
let myDocxPreview = null;
let switchTimer = null;

onMounted(() => {
    myDocxPreview = jsDocx.init(dom.value);
    myDocxPreview.preview(`${baseUrl}static/test-files/test.docx`).then(() => {
        console.log('docx preview done');
        switchTimer = setTimeout(() => {
            if (myDocxPreview) {
                myDocxPreview.preview(`${baseUrl}static/test-files/test2.docx`).catch(err => {
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
        myDocxPreview = null;
    }
});
</script>

<style scoped>

</style>
