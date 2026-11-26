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

export interface ExcelOptions {
    xls?: boolean;
    minColLength?: number;
    minRowLength?: number;
    widthOffset?: number;
    heightOffset?: number;
    showContextmenu?: boolean;
    beforeTransformData?: (workbookData: any) => any;
    transformData?: (workbookData: any) => any;
}

export type Options = ExcelOptions;

export interface ExcelProps {
    src?: OfficeSource | null;
    requestOptions?: Record<string, any>;
    options?: ExcelOptions;
    onRendered?: () => void;
    onError?: (error: any) => void;
    onSwitchSheet?: (sheetIndex: number) => void;
    onCellSelected?: (event: ExcelCellEvent) => void;
    onCellsSelected?: (event: ExcelCellsEvent) => void;
}

export interface AbnerVueOfficeExcelInstance {
    $props: ExcelProps;
    save: (fileName?: string) => void;
}

export interface AbnerVueOfficeExcelComponent {
    new (): AbnerVueOfficeExcelInstance;
    install(app: any): void;
}

declare const AbnerVueOfficeExcel: AbnerVueOfficeExcelComponent;
export default AbnerVueOfficeExcel;
