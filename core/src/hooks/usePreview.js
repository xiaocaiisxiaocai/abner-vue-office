import { ref } from 'vue';

export function isXlsName(name) {
    return typeof name === 'string' && /\.xls(\?|#|$)/i.test(name.trim());
}

export function getStaticFileUrl(relativePath) {
    const cleanRel = String(relativePath || '').replace(/^\/+/, '');
    if (typeof location === 'undefined') {
        return cleanRel;
    }
    const pathname = typeof location.pathname === 'string' ? location.pathname : '/';
    const baseDir = /\/[^/]+\.[^/]+$/.test(pathname)
        ? pathname.replace(/[^/]+$/, '')
        : (pathname.endsWith('/') ? pathname : `${pathname}/`);
    const origin = location.origin && location.origin !== 'null' ? location.origin : '';
    return `${origin}${baseDir}${cleanRel}`;
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
        try {
            reader.readAsArrayBuffer(file);
        } catch (err) {
            if (activeReader === reader) {
                activeReader = null;
            }
            console.warn(err);
        }
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
