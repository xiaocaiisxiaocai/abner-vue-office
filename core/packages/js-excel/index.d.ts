export type OfficeSource = string | ArrayBuffer | ArrayBufferView | Blob | Response;

export interface ExcelCellEvent {
    cell: any;
    rowIndex: number;
    columnIndex: number;
}

export interface ExcelCellsEvent {
    cell: any;
    startRowIndex: number;
    startColumnIndex: number;
    endRowIndex: number;
    endColumnIndex: number;
}

export interface Options {
    xls?: boolean;
    minColLength?: number;
    minRowLength?: number;
    widthOffset?: number;
    heightOffset?: number;
    showContextmenu?: boolean;
    beforeTransformData?: (workbookData: any) => any;
    transformData?: (workbookData: any) => any;
    switchSheet?: (sheetIndex: number) => void;
    cellSelected?: (event: ExcelCellEvent) => void;
    cellsSelected?: (event: ExcelCellsEvent) => void;
}

export interface AbnerJsExcelPreview {
    preview: (src: OfficeSource) => Promise<any>;
    save: (fileName?: string) => void;
    setOptions: (options: Options) => void;
    setRequestOptions: (requestOptions?: Record<string, any>) => void;
    destroy: () => void;
}

declare const abnerJsExcel: {
    init: (container: HTMLElement, options?: Options, requestOptions?: Record<string, any>) => AbnerJsExcelPreview;
};
export default abnerJsExcel;
