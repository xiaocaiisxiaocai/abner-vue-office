const cacheMap = new WeakMap();

function getCache(ctx) {
    let cache = cacheMap.get(ctx);
    if (!cache) {
        cache = [];
        cacheMap.set(ctx, cache);
    }
    return cache;
}

export function renderImage(ctx, medias, sheet, offset, options = {}, shouldDraw) {
    if (!ctx || !sheet || !sheet._media || !sheet._media.length) {
        return;
    }
    const drawTasks = [];
    sheet._media.forEach(media => {
        if (!media) {
            return;
        }
        const { imageId, range, type } = media;
        if (type === 'image' && medias && medias[imageId]) {
            const position = calcPosition(sheet, range, offset, options);
            drawTasks.push(
                getImage(ctx, imageId, medias[imageId])
                    .then(image => ({ image, position }))
                    .catch(e => {
                        console.error(e);
                        return null;
                    })
            );
        }
    });
    if (drawTasks.length === 0) {
        return;
    }
    return Promise.all(drawTasks).then(items => {
        if (typeof shouldDraw === 'function' && !shouldDraw()) {
            return;
        }
        items.forEach(item => {
            if (item && item.image) {
                if (typeof shouldDraw === 'function' && !shouldDraw()) {
                    return;
                }
                drawImageBitmap(ctx, item.image, item.position);
            }
        });
    });
}

const clipWidth = 60; //左侧序号列宽
const clipHeight = 24; //顶部序号行高
const defaultColWidth = 80;
const defaultRowHeight = 24;

function getColWidth(sheet, index, widthOffset = 0) {
    const col = sheet?._columns?.[index];
    if (col?._hidden || col?.width === 0) {
        return 0;
    }
    const baseWidth = typeof col?.width === 'number' ? col.width * 6 : defaultColWidth;
    return Math.max(1, baseWidth + (widthOffset || 0));
}

function getRowHeight(sheet, index, heightOffset = 0) {
    const row = sheet?._rows?.[index];
    if (row?._hidden || row?.height === 0) {
        return 0;
    }
    const baseHeight = typeof row?.height === 'number' ? row.height : defaultRowHeight;
    return Math.max(1, baseHeight + (heightOffset || 0));
}

export function getImageMimeType(extension) {
    const ext = String(extension || '').toLowerCase();
    const mimeMap = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        bmp: 'image/bmp',
        webp: 'image/webp',
        svg: 'image/svg+xml',
        tif: 'image/tiff',
        tiff: 'image/tiff',
        ico: 'image/x-icon'
    };
    return mimeMap[ext] || (ext ? `image/${ext}` : 'image/png');
}

export function calcPosition(sheet, range, offset, options) {
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    const { widthOffset, heightOffset } = options || {};
    const { tl, br, ext } = range || {};
    const { nativeCol = 0, nativeColOff = 0, nativeRow = 0, nativeRowOff = 0 } = tl || {};

    let basicX = clipWidth;
    let basicY = clipHeight;
    for (let i = 0; i < nativeCol; i++) {
        basicX += getColWidth(sheet, i, widthOffset);
    }
    for (let i = 0; i < nativeRow; i++) {
        basicY += getRowHeight(sheet, i, heightOffset);
    }
    const x = basicX + nativeColOff / 12700;
    const y = basicY + nativeRowOff / 12700;

    const {
        nativeCol: nativeColEnd = 0,
        nativeColOff: nativeColOffEnd = 0,
        nativeRow: nativeRowEnd = 0,
        nativeRowOff: nativeRowOffEnd = 0
    } = br || {};
    let width = 0;
    if (nativeCol === nativeColEnd && br) {
        width = (nativeColOffEnd - nativeColOff) / 12700;
    } else if (br) {
        width = getColWidth(sheet, nativeCol, widthOffset) - nativeColOff / 12700;
        for (let i = nativeCol + 1; i < nativeColEnd; i++) {
            width += getColWidth(sheet, i, widthOffset);
        }
        width += nativeColOffEnd / 12700;
    } else if (ext?.width) {
        width = ext.width / 1.333333;
    }
    let height = 0;
    if (nativeRow === nativeRowEnd && br) {
        height = (nativeRowOffEnd - nativeRowOff) / 12700;
    } else if (br) {
        height = getRowHeight(sheet, nativeRow, heightOffset) - nativeRowOff / 12700;
        for (let i = nativeRow + 1; i < nativeRowEnd; i++) {
            height += getRowHeight(sheet, i, heightOffset);
        }
        height += nativeRowOffEnd / 12700;
    } else if (ext?.height) {
        height = ext.height / 1.333333;
    }

    const frozenView = Array.isArray(sheet && sheet.views)
        ? sheet.views.find(v => v && v.state === 'frozen')
        : null;
    const freezeCol = frozenView ? (frozenView.xSplit || 0) : 0;
    const freezeRow = frozenView ? (frozenView.ySplit || 0) : 0;
    const scrollX = nativeCol < freezeCol ? 0 : (offset?.scroll?.x || 0);
    const scrollY = nativeRow < freezeRow ? 0 : (offset?.scroll?.y || 0);

    return {
        x: (x - scrollX) * dpr,
        y: (y - scrollY) * dpr,
        width: width * dpr,
        height: height * dpr,
        dpr
    };
}

export function clearCache(ctx) {
    if (ctx) {
        cacheMap.delete(ctx);
    }
}

function drawImageBitmap(ctx, image, position) {
    if (!ctx || !image) {
        return;
    }
    const dpr = position.dpr || (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    let sx = 0;
    let sy = 0;
    let sWidth = image.width;
    let sHeight = image.height;
    let dx = position.x;
    let dy = position.y;
    let dWidth = position.width;
    let dHeight = position.height;
    if (!sWidth || !sHeight || dWidth <= 0 || dHeight <= 0) {
        return;
    }
    const scaleX = dWidth / sWidth;
    const scaleY = dHeight / sHeight;

    if (dx < clipWidth * dpr) {
        const diff = clipWidth * dpr - dx;
        dx = clipWidth * dpr;
        dWidth -= diff;
        sWidth -= diff / scaleX;
        sx += diff / scaleX;
    }
    if (dy < clipHeight * dpr) {
        const diff = clipHeight * dpr - dy;
        dy = clipHeight * dpr;
        dHeight -= diff;
        sHeight -= diff / scaleY;
        sy += diff / scaleY;
    }
    if (dWidth <= 0 || dHeight <= 0 || sWidth <= 0 || sHeight <= 0) {
        return;
    }
    ctx.drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
}

function getImage(ctx, index, data) {
    if (!data || !data.buffer) {
        return Promise.reject(new Error('Invalid image data'));
    }
    if (typeof Blob === 'undefined' || typeof Image === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
        return Promise.reject(new Error('Image API is unavailable'));
    }
    const cache = getCache(ctx);
    if (cache[index]) {
        return cache[index];
    }
    let failedSync = false;
    const promise = new Promise((resolve, reject) => {
        try {
            const blob = new Blob([data.buffer], { type: getImageMimeType(data.extension) });
            const url = URL.createObjectURL(blob);
            const image = new Image();
            image.onload = function () {
                typeof URL.revokeObjectURL === 'function' && URL.revokeObjectURL(url);
                resolve(image);
            };
            image.onerror = function (e) {
                typeof URL.revokeObjectURL === 'function' && URL.revokeObjectURL(url);
                delete cache[index];
                reject(e);
            };
            image.src = url;
        } catch (e) {
            failedSync = true;
            delete cache[index];
            reject(e);
        }
    });
    if (!failedSync) {
        cache[index] = promise;
    }
    return promise;
}
