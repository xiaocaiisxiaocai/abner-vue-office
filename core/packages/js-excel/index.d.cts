declare namespace abnerJsExcel {
    export type OfficeSource = string | ArrayBuffer | ArrayBufferView | Blob | Response;

    export interface RequestOptions {
        method?: string;
        headers?: Record<string, string> | Headers | [string, string][];
        withCredentials?: boolean;
        credentials?: RequestCredentials;
        timeout?: number;
        body?: any;
        signal?: AbortSignal;
        [key: string]: any;
    }

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

    export interface ExcelAutoFitOptions {
        minColWidth?: number;
        maxColWidth?: number;
        minRowHeight?: number;
        maxRowHeight?: number;
        allSheets?: boolean;
    }

    export interface Options {
        xls?: boolean;
        minColLength?: number;
        minRowLength?: number;
        widthOffset?: number;
        heightOffset?: number;
        showContextmenu?: boolean;
        resizable?: boolean;
        autoFit?: boolean;
        autoFitCol?: boolean;
        autoFitRow?: boolean;
        autoFitMinColWidth?: number;
        autoFitMaxColWidth?: number;
        autoFitMinRowHeight?: number;
        autoFitMaxRowHeight?: number;
        beforeTransformData?: (workbookData: any) => any;
        transformData?: (workbookData: any) => any;
        switchSheet?: (sheetIndex: number) => void;
        cellSelected?: (event: ExcelCellEvent) => void;
        cellsSelected?: (event: ExcelCellsEvent) => void;
        [key: string]: any;
    }

    export interface AbnerJsExcelPreview {
        preview: (src: OfficeSource) => Promise<void>;
        save: (fileName?: string) => void;
        setOptions: (options?: Options) => void;
        setRequestOptions: (requestOptions?: RequestOptions) => void;
        autoFitCol: (colIndex: number, options?: ExcelAutoFitOptions) => void;
        autoFitAllCols: (options?: ExcelAutoFitOptions) => void;
        autoFitRow: (rowIndex: number, options?: ExcelAutoFitOptions) => void;
        autoFitAllRows: (options?: ExcelAutoFitOptions) => void;
        autoFitAll: (options?: ExcelAutoFitOptions) => void;
        destroy: () => void;
    }

    export function init(container: HTMLElement, options?: Options, requestOptions?: RequestOptions): AbnerJsExcelPreview;
}

export = abnerJsExcel;
