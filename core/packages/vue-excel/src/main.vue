<script>
import { defineComponent, ref, onMounted, onBeforeUnmount, watch } from 'vue-demi';
import Spreadsheet from './x-spreadsheet/index';
import { getData, readExcelData, transferExcelToSpreadSheet } from './excel';
import { renderImage, clearCache } from './media';
import debounce from 'lodash/debounce';
import { download as downloadFile } from '../../../utils/url';

const defaultOptions = {
    xls: false,
    minColLength: 20
};

export default defineComponent({
    name: 'AbnerVueOfficeExcel',
    props: {
        src: [String, ArrayBuffer, Blob],
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
        let renderId = 0;
        let renderImageDebounce = null;
        let swapTimer = null;

        function clearSwapTimer() {
            if (swapTimer) {
                clearTimeout(swapTimer);
                swapTimer = null;
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
            xs && xs.loadData({});
        }

        function renderExcel(buffer, currentId) {
            if (isUnmounted || currentId !== renderId || !xs) {
                return;
            }
            fileData = buffer;
            readExcelData(buffer, props.options.xls).then(workbook => {
                if (isUnmounted || currentId !== renderId || !xs) {
                    return;
                }
                if (!workbook._worksheets || workbook._worksheets.length === 0) {
                    throw new Error('未获取到数据，可能文件格式不正确或文件已损坏');
                }
                if (props.options.beforeTransformData && typeof props.options.beforeTransformData === 'function') {
                    workbook = props.options.beforeTransformData(workbook);
                }
                let { workbookData, medias, workbookSource } = transferExcelToSpreadSheet(workbook, { ...defaultOptions, ...props.options });
                if (props.options.transformData && typeof props.options.transformData === 'function') {
                    workbookData = props.options.transformData(workbookData);
                }
                clearSwapTimer();
                mediasSource = medias;
                workbookDataSource = workbookSource;
                offset = null;
                sheetIndex = 0;
                clearCache(ctx);
                renderImageDebounce && renderImageDebounce.cancel();
                xs.loadData(workbookData);
                emit('rendered');
                emit('switchSheet', 0);
            }).catch(e => {
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
            if (!props.src) {
                fileData = null;
                resetEmptyState();
                emit('error', new Error('src属性不能为空'));
                return;
            }
            getData(props.src, props.requestOptions).then(buffer => {
                renderExcel(buffer, currentId);
            }).catch(e => {
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
            xs = new Spreadsheet(rootRef.value, {
                mode: 'read',
                showToolbar: false,
                showContextmenu: props.options.showContextmenu || false,
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
                swapFunc.call(xs.bottombar, index);
                sheetIndex = index;
                offset = xs.sheet.data.getSelectedRect();
                clearSwapTimer();
                swapTimer = setTimeout(() => {
                    swapTimer = null;
                    if (isUnmounted || !xs) {
                        return;
                    }
                    renderImageDebounce && renderImageDebounce.cancel();
                    xs.reRender();
                    emit('switchSheet', index);
                });
            };

            renderImageDebounce = debounce(() => {
                if (isUnmounted || !ctx || !workbookDataSource._worksheets[sheetIndex]) {
                    return;
                }
                const targetRenderId = renderId;
                const targetSheetIndex = sheetIndex;
                renderImage(
                    ctx,
                    mediasSource,
                    workbookDataSource._worksheets[targetSheetIndex],
                    offset,
                    props.options,
                    () => !isUnmounted && targetRenderId === renderId && targetSheetIndex === sheetIndex
                );
            }, 200, {
                leading: true
            });
            const tableRender = xs.sheet.table.render;
            xs.sheet.table.render = function (...args) {
                xs && xs.sheet && tableRender.apply(xs.sheet.table, args);
                renderImageDebounce();
            };

            const setOffset = xs.sheet.editor.setOffset;
            xs.sheet.editor.setOffset = function (...args) {
                setOffset.apply(xs.sheet.editor, args);
                offset = args[0];
            };
            const canvas = rootRef.value.querySelector('canvas');
            ctx = canvas.getContext('2d');
            if (props.src) {
                loadExcelFromSrc();
            }
        });

        onBeforeUnmount(() => {
            isUnmounted = true;
            ++renderId;
            clearSwapTimer();
            renderImageDebounce && renderImageDebounce.cancel();
            renderImageDebounce = null;
            clearCache(ctx);
            if (xs && typeof xs.destroy === 'function') {
                xs.destroy();
            }
            xs = null;
            ctx = null;
            fileData = null;
        });

        watch(() => props.src, () => {
            loadExcelFromSrc();
        });

        function save(fileName) {
            const ext = props.options && props.options.xls ? 'xls' : 'xlsx';
            downloadFile(fileName || `abner-vue-office-excel-${new Date().getTime()}.${ext}`, fileData);
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
<style lang="less">

</style>
