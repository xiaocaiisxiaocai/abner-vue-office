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

class AbnerJsExcelPreview {
    container = null;
    wrapper = null;
    wrapperMain = null;
    options = {};
    renderedOptions = { ...defaultOptions };
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
    resizeObserver = null;
    resizeReloadDebounce = null;
    lastObservedWidth = 0;
    lastObservedHeight = 0;
    renderImageDebounce = null;
    swapTimer = null;
    fileData = null;
    renderId = 0;
    tableRenderVersion = 0;
    activeAbortController = null;
    isInternalLoad = false;
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
        this.options = mergeExcelOptions(defaultOptions, options);
        this.renderedOptions = { ...this.options };
        this.requestOptions = { ...(requestOptions || {}) };
        this.createWrapper();
        this.initSpreadsheet();
        this.hack();
        this.observeResize();
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
            if (that.isInternalLoad) {
                return;
            }
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
                that.renderedOptions,
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

    loadDataInternal(data) {
        if (!this.xs) {
            return;
        }
        this.isInternalLoad = true;
        try {
            this.xs.loadData(data);
        } finally {
            this.isInternalLoad = false;
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
        this.loadDataInternal({});
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
            return Promise.resolve(false);
        }
        const opts = mergeExcelOptions(defaultOptions, this.options);
        return readExcelData(buffer, opts.xls).then(workbook => {
            if (this.isDestroyed || currentId !== this.renderId || !this.xs) {
                return false;
            }
            if (!this.hasValidWorksheets(workbook)) {
                throw new Error('未获取到数据，可能文件格式不正确或文件已损坏');
            }
            if (opts.beforeTransformData && typeof opts.beforeTransformData === 'function') {
                const nextWb = opts.beforeTransformData(workbook);
                if (nextWb !== undefined) {
                    workbook = nextWb;
                }
                if (!this.hasValidWorksheets(workbook)) {
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
            this.clearSwapTimer();
            this.fileData = buffer;
            this.renderedOptions = { ...opts };
            this.mediasSource = medias;
            this.workbookDataSource = workbookSource;
            this.offset = null;
            this.sheetIndex = 0;
            clearCache(this.ctx);
            this.renderImageDebounce && this.renderImageDebounce.cancel();
            this.loadDataInternal(workbookData);
            return true;
        }).catch(e => {
            if (!this.isDestroyed && currentId === this.renderId) {
                this.fileData = null;
            }
            return Promise.reject(e);
        });
    }

    hack() {
        if (typeof MutationObserver !== 'undefined') {
            this.observerCallback = debounce(() => {
                if (!this.isDestroyed && this.wrapperMain) {
                    readOnlyInput(this.wrapperMain);
                }
            }, 200);
            this.observer = new MutationObserver(this.observerCallback);
            const observerConfig = { childList: true, subtree: true };
            this.observer.observe(this.wrapperMain, observerConfig);
        }
        readOnlyInput(this.wrapperMain);
    }

    observeResize() {
        if (typeof ResizeObserver === 'undefined' || !this.wrapper) {
            return;
        }
        this.lastObservedWidth = this.wrapper.clientWidth || 0;
        this.lastObservedHeight = this.wrapper.clientHeight || 0;
        this.resizeReloadDebounce = debounce(() => {
            if (this.isDestroyed || !this.xs || !this.xs.sheet || typeof this.xs.sheet.reload !== 'function') {
                return;
            }
            this.xs.sheet.reload();
        }, 100);
        this.resizeObserver = new ResizeObserver(() => {
            if (this.isDestroyed || !this.wrapper) {
                return;
            }
            const nextW = this.wrapper.clientWidth || 0;
            const nextH = this.wrapper.clientHeight || 0;
            if (nextW > 0 && nextH > 0 && (nextW !== this.lastObservedWidth || nextH !== this.lastObservedHeight)) {
                this.lastObservedWidth = nextW;
                this.lastObservedHeight = nextH;
                this.resizeReloadDebounce && this.resizeReloadDebounce();
            }
        });
        this.resizeObserver.observe(this.wrapper);
    }

    setOptions(options = {}) {
        this.options = mergeExcelOptions(mergeExcelOptions(defaultOptions, this.options), options);
        if (this.xs && this.xs.sheet && this.xs.sheet.contextMenu) {
            this.xs.sheet.contextMenu.isHide = !this.options.showContextmenu;
        }
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
        let didRender = false;
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
            didRender = Boolean(await this.renderExcel(res, currentId));
        } catch (e) {
            if (currentId === this.renderId) {
                this.activeAbortController = null;
            }
            if (!this.isDestroyed && currentId === this.renderId) {
                this.fileData = null;
                this.resetEmptyState();
                throw e;
            }
            return;
        }
        if (didRender && !this.isDestroyed && currentId === this.renderId) {
            this.options && typeof this.options.switchSheet === 'function' && this.options.switchSheet(0);
        }
    }

    save(fileName) {
        const ext = this.options && this.options.xls ? 'xls' : 'xlsx';
        Promise.resolve(
            downloadFile(fileName || `abner-vue-office-js-excel-${new Date().getTime()}.${ext}`, this.fileData)
        ).catch(() => {});
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
        this.resizeReloadDebounce && this.resizeReloadDebounce.cancel();
        this.resizeReloadDebounce = null;
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
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
