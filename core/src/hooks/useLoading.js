import { message } from 'ant-design-vue';
import { ref } from 'vue';

const loading = ref(false);
let hide = null;

function showLoading(content) {
    if (typeof hide === 'function') {
        hide();
        hide = null;
    }
    hide = message.loading(content, 0);
    loading.value = true;
}

function hideLoading() {
    if (loading.value === true) {
        if (typeof hide === 'function') {
            hide();
            hide = null;
        }
        loading.value = false;
    }
}

export default {
    loading,
    showLoading,
    hideLoading
};
