import Spreadsheet from '../../vue-excel/src/x-spreadsheet/index';
import { getData, readExcelData, transferExcelToSpreadSheet } from '../../vue-excel/src/excel';
import { renderImage, clearCache } from '../../vue-excel/src/media';
import { readOnlyInput } from '../../vue-excel/src/hack';
import debounce from 'lodash/debounce';
import { download as downloadFile } from '../../../utils/url.js';

const defaultOptions = {
    xls: false,
    minColLength: 20
};

class AbnerJsExcelPreview {
    container = null;
    wrapper = null;
    wrapperMain = null;
    options = {};
    requestOptions = {};
    mediasSource = [];
    workbookDataSource = {
        _worksheets: []
    };
    sheetIndex = 0;
    ctx = null;
    xs = null;
    offset = null;
    observer = null;
    observerCallback = null;
    renderImageDebounce = null;
    swapTimer = null;
    fileData = null;
    renderId = 0;
    tableRenderVersion = 0;
    activeAbortController = null;
    isDestroyed = false;

    abortActiveRequest() {
        if (this.activeAbortController) {
            try {
                this.activeAbortController.abort();
            } catch (e) {
                // ignore
            }
            this.activeAbortController = null;
        }
    }

    constructor(container, options = {}, requestOptions = {}) {
        if (!container) {
            throw new Error('container is required');
        }
        this.container = container;
        this.options = { ...defaultOptions, ...(options || {}) };
        this.requestOptions = { ...(requestOptions || {}) };
        this.createWrapper();
        this.initSpreadsheet();
        this.hack();
    }

    createWrapper() {
        this.wrapper = document.createElement('div');
        this.wrapper.className = 'abner-vue-office-excel';
        this.wrapperMain = document.createElement('div');
        this.wrapperMain.className = 'abner-vue-office-excel-main';
        this.wrapper.appendChild(this.wrapperMain);
        this.container.appendChild(this.wrapper);
    }

    initSpreadsheet() {
        this.xs = new Spreadsheet(this.wrapperMain, {
            mode: 'read',
            evalPaused: true,
            showToolbar: false,
            showContextmenu: this.options.showContextmenu || false,
            view: {
                height: () => this.wrapper && this.wrapper.clientHeight || 300,
                width: () => this.wrapper && this.wrapper.clientWidth || 1200,
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

        this.xs.on('cell-selected', (cell, ri, ci) => {
            if (this.options && typeof this.options.cellSelected === 'function') {
                this.options.cellSelected({
                    cell,
                    rowIndex: ri,
                    columnIndex: ci
                });
            }
        });
        this.xs.on('cells-selected', (cell, { sri, sci, eri, eci }) => {
            if (this.options && typeof this.options.cellsSelected === 'function') {
                this.options.cellsSelected({
                    cell,
                    startRowIndex: sri,
                    startColumnIndex: sci,
                    endRowIndex: eri,
                    endColumnIndex: eci
                });
            }
        });

        const that = this;

        const swapFunc = this.xs.bottombar.swapFunc;
        this.xs.bottombar.swapFunc = function (index) {
            if (!that.xs || !that.xs.datas || !that.xs.datas[index]) {
                return;
            }
            that.sheetIndex = index;
            that.offset = that.xs.datas[index].getSelectedRect();
            that.renderImageDebounce && that.renderImageDebounce.cancel();
            swapFunc.call(that.xs.bottombar, index);
            that.offset = that.xs.sheet.data.getSelectedRect();
            that.clearSwapTimer();
            that.swapTimer = setTimeout(() => {
                that.swapTimer = null;
                if (that.isDestroyed || !that.xs) {
                    return;
                }
                that.options && typeof that.options.switchSheet === 'function' && that.options.switchSheet(index);
            });
        };

        this.renderImageDebounce = debounce(() => {
            if (
                that.isDestroyed ||
                !that.ctx ||
                !that.workbookDataSource ||
                !that.workbookDataSource._worksheets[that.sheetIndex]
            ) {
                return;
            }
            const targetRenderId = that.renderId;
            const targetSheetIndex = that.sheetIndex;
            const targetTableVersion = that.tableRenderVersion;
            renderImage(
                that.ctx,
                that.mediasSource,
                that.workbookDataSource._worksheets[targetSheetIndex],
                that.offset,
                that.options,
                () => !that.isDestroyed && targetRenderId === that.renderId && targetSheetIndex === that.sheetIndex && targetTableVersion === that.tableRenderVersion
            );
        }, 200, {
            leading: true
        });
        const tableRender = this.xs.sheet.table.render;
        this.xs.sheet.table.render = function (...args) {
            that.tableRenderVersion += 1;
            that.xs && that.xs.sheet && tableRender.apply(that.xs.sheet.table, args);
            that.renderImageDebounce && that.renderImageDebounce();
        };

        const setOffset = this.xs.sheet.editor.setOffset;
        this.xs.sheet.editor.setOffset = function (...args) {
            setOffset.apply(that.xs.sheet.editor, args);
            that.offset = args[0];
        };

        const canvas = this.wrapperMain.querySelector('canvas');
        this.ctx = canvas ? canvas.getContext('2d') : null;
    }

    clearSwapTimer() {
        if (this.swapTimer) {
            clearTimeout(this.swapTimer);
            this.swapTimer = null;
        }
    }

    resetEmptyState() {
        this.clearSwapTimer();
        this.mediasSource = [];
        this.workbookDataSource = {
            _worksheets: []
        };
        this.renderImageDebounce && this.renderImageDebounce.cancel();
        clearCache(this.ctx);
        this.xs && this.xs.loadData({});
    }

    hasValidWorksheets(wb) {
        if (!wb) {
            return false;
        }
        if (Array.isArray(wb.worksheets)) {
            return wb.worksheets.length > 0;
        }
        return Array.isArray(wb._worksheets) && wb._worksheets.some(Boolean);
    }

    renderExcel(buffer, currentId = this.renderId) {
        if (this.isDestroyed || currentId !== this.renderId || !this.xs) {
            return Promise.resolve();
        }
        return readExcelData(buffer, this.options.xls).then(workbook => {
            if (this.isDestroyed || currentId !== this.renderId || !this.xs) {
                return;
            }
            if (!this.hasValidWorksheets(workbook)) {
                throw new Error('未获取到数据，可能文件格式不正确或文件已损坏');
            }
            if (this.options.beforeTransformData && typeof this.options.beforeTransformData === 'function') {
                const nextWb = this.options.beforeTransformData(workbook);
                if (nextWb !== undefined) {
                    workbook = nextWb;
                }
                if (!this.hasValidWorksheets(workbook)) {
                    throw new Error('未获取到数据，可能文件格式不正确或文件已损坏');
                }
            }
            let { workbookData, medias, workbookSource } = transferExcelToSpreadSheet(workbook, this.options);
            if (this.options.transformData && typeof this.options.transformData === 'function') {
                const nextData = this.options.transformData(workbookData);
                if (nextData !== undefined) {
                    workbookData = nextData;
                }
            }
            this.clearSwapTimer();
            this.fileData = buffer;
            this.mediasSource = medias;
            this.workbookDataSource = workbookSource;
            this.offset = null;
            this.sheetIndex = 0;
            clearCache(this.ctx);
            this.renderImageDebounce && this.renderImageDebounce.cancel();
            this.xs.loadData(workbookData);
            typeof this.options.switchSheet === 'function' && this.options.switchSheet(0);
        }).catch(e => {
            if (!this.isDestroyed && currentId === this.renderId) {
                this.fileData = null;
            }
            return Promise.reject(e);
        });
    }

    hack() {
        if (typeof MutationObserver !== 'undefined') {
            this.observerCallback = debounce(() => readOnlyInput(this.wrapperMain), 200);
            this.observer = new MutationObserver(this.observerCallback);
            const observerConfig = { attributes: true, childList: true, subtree: true };
            this.observer.observe(this.wrapperMain, observerConfig);
        }
        readOnlyInput(this.wrapperMain);
    }

    setOptions(options = {}) {
        this.options = { ...defaultOptions, ...(this.options || {}), ...(options || {}) };
    }

    setRequestOptions(requestOptions = {}) {
        this.requestOptions = { ...(requestOptions || {}) };
    }

    async preview(src) {
        if (this.isDestroyed) {
            return;
        }
        const currentId = ++this.renderId;
        this.abortActiveRequest();
        this.fileData = null;
        if (!src) {
            this.resetEmptyState();
            throw new Error('预览地址不能为空');
        }
        try {
            const reqOpts = this.requestOptions || {};
            let fetchOpts = reqOpts;
            if (!reqOpts.signal && typeof AbortController !== 'undefined') {
                this.activeAbortController = new AbortController();
                fetchOpts = { ...reqOpts, signal: this.activeAbortController.signal };
            }
            const res = await getData(src, fetchOpts);
            if (currentId === this.renderId) {
                this.activeAbortController = null;
            }
            if (this.isDestroyed || currentId !== this.renderId) {
                return;
            }
            await this.renderExcel(res, currentId);
        } catch (e) {
            if (currentId === this.renderId) {
                this.activeAbortController = null;
            }
            if (!this.isDestroyed && currentId === this.renderId) {
                this.fileData = null;
                this.resetEmptyState();
                throw e;
            }
        }
    }

    save(fileName) {
        const ext = this.options && this.options.xls ? 'xls' : 'xlsx';
        downloadFile(fileName || `abner-vue-office-js-excel-${new Date().getTime()}.${ext}`, this.fileData);
    }

    destroy() {
        this.isDestroyed = true;
        ++this.renderId;
        this.abortActiveRequest();
        this.clearSwapTimer();
        this.renderImageDebounce && this.renderImageDebounce.cancel();
        this.renderImageDebounce = null;
        this.observerCallback && this.observerCallback.cancel();
        this.observerCallback = null;
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        clearCache(this.ctx);
        if (this.xs && typeof this.xs.destroy === 'function') {
            this.xs.destroy();
        }
        if (this.wrapper && this.wrapper.parentNode) {
            this.wrapper.parentNode.removeChild(this.wrapper);
        }
        this.container = null;
        this.wrapper = null;
        this.wrapperMain = null;
        this.ctx = null;
        this.xs = null;
        this.options = {};
        this.requestOptions = {};
        this.mediasSource = null;
        this.workbookDataSource = null;
        this.fileData = null;
    }
}

export function init(container, options, requestOptions) {
    return new AbnerJsExcelPreview(container, options, requestOptions);
}
