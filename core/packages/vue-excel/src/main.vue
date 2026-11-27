<script>
import { defineComponent, ref, onMounted, onBeforeUnmount, watch } from 'vue-demi';
import Spreadsheet from './x-spreadsheet/index';
import { getData, readExcelData, transferExcelToSpreadSheet } from './excel';
import { renderImage, clearCache } from './media';
import { readOnlyInput } from './hack';
import debounce from 'lodash/debounce';
import { download as downloadFile } from '../../../utils/url';

const defaultOptions = {
    xls: false,
    minColLength: 20
};

function mergeExcelOptions(base, override) {
    const merged = { ...base };
    if (override && typeof override === 'object') {
        Object.keys(override).forEach(k => {
            if (override[k] !== undefined) {
                merged[k] = override[k];
            }
        });
    }
    return merged;
}

export default defineComponent({
    name: 'AbnerVueOfficeExcel',
    props: {
        src: {
            validator(val) {
                if (val == null || typeof val === 'string') {
                    return true;
                }
                if (val instanceof ArrayBuffer || ArrayBuffer.isView(val)) {
                    return true;
                }
                if (typeof Blob !== 'undefined' && val instanceof Blob) {
                    return true;
                }
                if (typeof Response !== 'undefined' && val instanceof Response) {
                    return true;
                }
                return false;
            }
        },
        requestOptions: {
            type: Object,
            default: () => ({})
        },
        options: {
            type: Object,
            default: () => ({
                ...defaultOptions
            })
        }
    },
    emits: ['rendered', 'error', 'switchSheet', 'cellSelected', 'cellsSelected'],
    setup(props, { emit }) {
        const wrapperRef = ref(null);
        const rootRef = ref(null);
        let workbookDataSource = {
            _worksheets: []
        };
        let mediasSource = [];
        let sheetIndex = 0;
        let ctx = null;
        let xs = null;
        let offset = null;
        let fileData = null;
        let isUnmounted = false;
        let isInternalLoad = false;
        let renderId = 0;
        let tableRenderVersion = 0;
        let activeAbortController = null;
        let renderImageDebounce = null;
        let swapTimer = null;
        let renderedOptions = { ...defaultOptions };
        let observer = null;
        let observerCallback = null;
        let resizeObserver = null;
        let resizeReloadDebounce = null;
        let lastObservedWidth = 0;
        let lastObservedHeight = 0;

        function abortActiveRequest() {
            if (activeAbortController) {
                try {
                    activeAbortController.abort();
                } catch (e) {
                    // ignore
                }
                activeAbortController = null;
            }
        }

        function clearSwapTimer() {
            if (swapTimer) {
                clearTimeout(swapTimer);
                swapTimer = null;
            }
        }

        function loadDataInternal(data) {
            if (!xs) {
                return;
            }
            isInternalLoad = true;
            try {
                xs.loadData(data);
            } finally {
                isInternalLoad = false;
            }
        }

        function resetEmptyState() {
            clearSwapTimer();
            mediasSource = [];
            workbookDataSource = {
                _worksheets: []
            };
            renderImageDebounce && renderImageDebounce.cancel();
            clearCache(ctx);
            loadDataInternal({});
        }

        function hasValidWorksheets(wb) {
            if (!wb) {
                return false;
            }
            if (Array.isArray(wb.worksheets)) {
                return wb.worksheets.length > 0;
            }
            return Array.isArray(wb._worksheets) && wb._worksheets.some(Boolean);
        }

        function renderExcel(buffer, currentId) {
            if (isUnmounted || currentId !== renderId || !xs) {
                return;
            }
            const opts = mergeExcelOptions(defaultOptions, props.options);
            readExcelData(buffer, opts.xls).then(workbook => {
                if (isUnmounted || currentId !== renderId || !xs) {
                    return false;
                }
                if (!hasValidWorksheets(workbook)) {
                    throw new Error('未获取到数据，可能文件格式不正确或文件已损坏');
                }
                if (opts.beforeTransformData && typeof opts.beforeTransformData === 'function') {
                    const nextWb = opts.beforeTransformData(workbook);
                    if (nextWb !== undefined) {
                        workbook = nextWb;
                    }
                    if (!hasValidWorksheets(workbook)) {
                        throw new Error('未获取到数据，可能文件格式不正确或文件已损坏');
                    }
                }
                let { workbookData, medias, workbookSource } = transferExcelToSpreadSheet(workbook, opts);
                if (opts.transformData && typeof opts.transformData === 'function') {
                    const nextData = opts.transformData(workbookData);
                    if (nextData !== undefined) {
                        workbookData = nextData;
                    }
                }
                clearSwapTimer();
                fileData = buffer;
                renderedOptions = { ...opts };
                mediasSource = medias;
                workbookDataSource = workbookSource;
                offset = null;
                sheetIndex = 0;
                clearCache(ctx);
                renderImageDebounce && renderImageDebounce.cancel();
                loadDataInternal(workbookData);
                return true;
            }).then((didRender) => {
                if (didRender && !isUnmounted && currentId === renderId) {
                    emit('rendered');
                    emit('switchSheet', 0);
                }
            }, e => {
                if (isUnmounted || currentId !== renderId) {
                    return;
                }
                console.warn(e);
                fileData = null;
                resetEmptyState();
                emit('error', e);
            });
        }

        function loadExcelFromSrc() {
            const currentId = ++renderId;
            abortActiveRequest();
            fileData = null;
            if (!props.src) {
                resetEmptyState();
                emit('error', new Error('src属性不能为空'));
                return;
            }
            const reqOpts = props.requestOptions || {};
            let fetchOpts = reqOpts;
            if (!reqOpts.signal && typeof AbortController !== 'undefined') {
                activeAbortController = new AbortController();
                fetchOpts = { ...reqOpts, signal: activeAbortController.signal };
            }
            getData(props.src, fetchOpts).then(buffer => {
                if (currentId === renderId) {
                    activeAbortController = null;
                }
                renderExcel(buffer, currentId);
            }).catch(e => {
                if (currentId === renderId) {
                    activeAbortController = null;
                }
                if (isUnmounted || currentId !== renderId) {
                    return;
                }
                fileData = null;
                resetEmptyState();
                emit('error', e);
            });
        }

        onMounted(() => {
            if (isUnmounted || !rootRef.value) {
                return;
            }
            const opts = props.options || {};
            xs = new Spreadsheet(rootRef.value, {
                mode: 'read',
                evalPaused: true,
                showToolbar: false,
                showContextmenu: opts.showContextmenu || false,
                view: {
                    height: () => wrapperRef.value && wrapperRef.value.clientHeight || 300,
                    width: () => wrapperRef.value && wrapperRef.value.clientWidth || 1200,
                },
                row: {
                    height: 24,
                    len: 100
                },
                col: {
                    len: 26,
                    width: 80,
                    indexWidth: 60,
                    minWidth: 60,
                },
                autoFocus: false
            }).loadData({});

            xs.on('cell-selected', (cell, ri, ci) => {
                emit('cellSelected', {
                    cell,
                    rowIndex: ri,
                    columnIndex: ci
                });
            });
            xs.on('cells-selected', (cell, { sri, sci, eri, eci }) => {
                emit('cellsSelected', {
                    cell,
                    startRowIndex: sri,
                    startColumnIndex: sci,
                    endRowIndex: eri,
                    endColumnIndex: eci
                });
            });

            const swapFunc = xs.bottombar.swapFunc;
            xs.bottombar.swapFunc = function (index) {
                if (!xs || !xs.datas || !xs.datas[index]) {
                    return;
                }
                sheetIndex = index;
                offset = xs.datas[index].getSelectedRect();
                renderImageDebounce && renderImageDebounce.cancel();
                swapFunc.call(xs.bottombar, index);
                offset = xs.sheet.data.getSelectedRect();
                if (isInternalLoad) {
                    return;
                }
                clearSwapTimer();
                swapTimer = setTimeout(() => {
                    swapTimer = null;
                    if (isUnmounted || !xs) {
                        return;
                    }
                    emit('switchSheet', index);
                });
            };

            renderImageDebounce = debounce(() => {
                if (isUnmounted || !ctx || !workbookDataSource._worksheets[sheetIndex]) {
                    return;
                }
                const targetRenderId = renderId;
                const targetSheetIndex = sheetIndex;
                const targetTableVersion = tableRenderVersion;
                renderImage(
                    ctx,
                    mediasSource,
                    workbookDataSource._worksheets[targetSheetIndex],
                    offset,
                    renderedOptions,
                    () => !isUnmounted && targetRenderId === renderId && targetSheetIndex === sheetIndex && targetTableVersion === tableRenderVersion
                );
            }, 200, {
                leading: true
            });
            const tableRender = xs.sheet.table.render;
            xs.sheet.table.render = function (...args) {
                tableRenderVersion += 1;
                xs && xs.sheet && tableRender.apply(xs.sheet.table, args);
                renderImageDebounce && renderImageDebounce();
            };

            const setOffset = xs.sheet.editor.setOffset;
            xs.sheet.editor.setOffset = function (...args) {
                setOffset.apply(xs.sheet.editor, args);
                offset = args[0];
            };
            const canvas = rootRef.value.querySelector('canvas');
            ctx = canvas ? canvas.getContext('2d') : null;

            if (typeof MutationObserver !== 'undefined') {
                observerCallback = debounce(() => {
                    if (!isUnmounted && rootRef.value) {
                        readOnlyInput(rootRef.value);
                    }
                }, 200);
                observer = new MutationObserver(observerCallback);
                observer.observe(rootRef.value, { childList: true, subtree: true });
            }
            readOnlyInput(rootRef.value);

            if (typeof ResizeObserver !== 'undefined' && wrapperRef.value) {
                lastObservedWidth = wrapperRef.value.clientWidth || 0;
                lastObservedHeight = wrapperRef.value.clientHeight || 0;
                resizeReloadDebounce = debounce(() => {
                    if (isUnmounted || !xs || !xs.sheet || typeof xs.sheet.reload !== 'function') {
                        return;
                    }
                    xs.sheet.reload();
                }, 100);
                resizeObserver = new ResizeObserver(() => {
                    if (isUnmounted || !wrapperRef.value) {
                        return;
                    }
                    const nextW = wrapperRef.value.clientWidth || 0;
                    const nextH = wrapperRef.value.clientHeight || 0;
                    if (nextW > 0 && nextH > 0 && (nextW !== lastObservedWidth || nextH !== lastObservedHeight)) {
                        lastObservedWidth = nextW;
                        lastObservedHeight = nextH;
                        resizeReloadDebounce && resizeReloadDebounce();
                    }
                });
                resizeObserver.observe(wrapperRef.value);
            }

            if (props.src) {
                loadExcelFromSrc();
            }
        });

        onBeforeUnmount(() => {
            isUnmounted = true;
            ++renderId;
            abortActiveRequest();
            clearSwapTimer();
            renderImageDebounce && renderImageDebounce.cancel();
            renderImageDebounce = null;
            observerCallback && observerCallback.cancel();
            observerCallback = null;
            if (observer) {
                observer.disconnect();
                observer = null;
            }
            resizeReloadDebounce && resizeReloadDebounce.cancel();
            resizeReloadDebounce = null;
            if (resizeObserver) {
                resizeObserver.disconnect();
                resizeObserver = null;
            }
            clearCache(ctx);
            if (xs && typeof xs.destroy === 'function') {
                xs.destroy();
            }
            xs = null;
            ctx = null;
            fileData = null;
            mediasSource = [];
            workbookDataSource = {
                _worksheets: []
            };
            offset = null;
        });

        watch(() => props.src, () => {
            if (!xs) {
                return;
            }
            loadExcelFromSrc();
        });

        watch(() => props.options && props.options.showContextmenu, (showContextmenu) => {
            if (xs && xs.sheet && xs.sheet.contextMenu) {
                xs.sheet.contextMenu.isHide = !showContextmenu;
            }
        });

        function save(fileName) {
            const ext = props.options && props.options.xls ? 'xls' : 'xlsx';
            Promise.resolve(
                downloadFile(fileName || `abner-vue-office-excel-${new Date().getTime()}.${ext}`, fileData)
            ).catch(e => {
                if (!isUnmounted) {
                    emit('error', e);
                }
            });
        }

        return {
            wrapperRef,
            rootRef,
            save
        };
    }
});
</script>

<template>
    <div class="abner-vue-office-excel" ref="wrapperRef">
        <div class="abner-vue-office-excel-main" ref="rootRef"></div>
    </div>
</template>
