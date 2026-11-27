declare namespace AbnerVueOfficeExcel {
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

    export interface ExcelOptions {
        xls?: boolean;
        minColLength?: number;
        minRowLength?: number;
        widthOffset?: number;
        heightOffset?: number;
        showContextmenu?: boolean;
        beforeTransformData?: (workbookData: any) => any;
        transformData?: (workbookData: any) => any;
        [key: string]: any;
    }

    export type Options = ExcelOptions;

    export interface ExcelProps {
        src?: OfficeSource | null;
        requestOptions?: RequestOptions;
        options?: ExcelOptions;
        onRendered?: () => void;
        onError?: (error: any) => void;
        onSwitchSheet?: (sheetIndex: number) => void;
        onCellSelected?: (event: ExcelCellEvent) => void;
        onCellsSelected?: (event: ExcelCellsEvent) => void;
        class?: any;
        style?: any;
        [key: string]: any;
    }

    export interface AbnerVueOfficeExcelInstance {
        $props: ExcelProps;
        save: (fileName?: string) => void;
    }

    export interface AbnerVueOfficeExcelComponent {
        readonly name: 'AbnerVueOfficeExcel';
        new (): AbnerVueOfficeExcelInstance;
        install(app: any): void;
    }
}

declare const AbnerVueOfficeExcel: AbnerVueOfficeExcel.AbnerVueOfficeExcelComponent;
export = AbnerVueOfficeExcel;
