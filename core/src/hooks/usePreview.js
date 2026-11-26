import { ref } from 'vue';

export function isXlsName(name) {
    return typeof name === 'string' && /\.xls(\?|#|$)/i.test(name);
}

export default function (defaultSrc) {
    const type = ref('url');
    const inputSrc = ref(defaultSrc);
    const src = ref(defaultSrc);
    const xls = ref(isXlsName(defaultSrc));

    function beforeUpload(file) {
        xls.value = isXlsName(file && file.name);
        const reader = new FileReader();
        reader.onload = (loadEvent) => {
            src.value = loadEvent.target.result;
        };
        reader.readAsArrayBuffer(file);
        return false;
    }

    return {
        type,
        inputSrc,
        src,
        xls,
        beforeUpload
    };
}
