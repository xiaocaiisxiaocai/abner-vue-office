export interface Options {
    minColLength?: number;
    minRowLength?: number;
    showContextmenu?: boolean;
}

export interface AbnerJsExcelPreview {
    preview: (src: string | ArrayBuffer | Blob) => Promise<any>;
    save: (fileName?: string) => void;
    setOptions: (options: Options) => void;
    setRequestOptions: (requestOptions?: any) => void;
    destroy: ()=> void;
}
declare const abnerJsExcel: {
    init: (container: HTMLElement, options?: Options, requestOptions?: any) => AbnerJsExcelPreview;
};
export default abnerJsExcel;