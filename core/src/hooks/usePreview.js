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
    let activeReader = null;

    function cancelRead() {
        readSeq += 1;
        if (activeReader && activeReader.readyState === 1 && typeof activeReader.abort === 'function') {
            try {
                activeReader.abort();
            } catch (e) {
                // ignore
            }
        }
        activeReader = null;
    }

    function beforeUpload(file) {
        if (!file) {
            return false;
        }
        cancelRead();
        const currentSeq = readSeq;
        const fileName = file.name;
        const reader = new FileReader();
        activeReader = reader;
        reader.onload = (loadEvent) => {
            if (activeReader === reader) {
                activeReader = null;
            }
            if (currentSeq !== readSeq) {
                return;
            }
            xls.value = isXlsName(fileName);
            src.value = loadEvent.target.result;
        };
        reader.onerror = (err) => {
            if (activeReader === reader) {
                activeReader = null;
            }
            if (currentSeq !== readSeq) {
                return;
            }
            console.warn(err);
        };
        reader.onabort = () => {
            if (activeReader === reader) {
                activeReader = null;
            }
        };
        reader.readAsArrayBuffer(file);
        return false;
    }

    return {
        type,
        inputSrc,
        src,
        xls,
        beforeUpload,
        cancelRead
    };
}
