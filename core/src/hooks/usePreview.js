import { ref } from 'vue';

export function isXlsName(name) {
    return typeof name === 'string' && /\.xls(\?|#|$)/i.test(name.trim());
}

export function getStaticFileUrl(relativePath) {
    const cleanRel = String(relativePath || '').replace(/^\/+/, '');
    if (typeof location === 'undefined') {
        return cleanRel;
    }
    const baseDir = location.pathname.endsWith('.html')
        ? location.pathname.replace(/[^/]+$/, '')
        : (location.pathname.endsWith('/') ? location.pathname : `${location.pathname}/`);
    return `${location.origin}${baseDir}${cleanRel}`;
}

export default function (defaultSrc) {
    const type = ref('url');
    const inputSrc = ref(defaultSrc);
    const src = ref(defaultSrc);
    const xls = ref(isXlsName(defaultSrc));
    let readSeq = 0;

    function beforeUpload(file) {
        if (!file) {
            return false;
        }
        const currentSeq = ++readSeq;
        const fileName = file.name;
        const reader = new FileReader();
        reader.onload = (loadEvent) => {
            if (currentSeq !== readSeq) {
                return;
            }
            xls.value = isXlsName(fileName);
            src.value = loadEvent.target.result;
        };
        reader.onerror = (err) => {
            if (currentSeq !== readSeq) {
                return;
            }
            console.warn(err);
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
