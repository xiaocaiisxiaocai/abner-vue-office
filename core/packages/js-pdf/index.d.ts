export interface Options {
    staticFileUrl?: string;
    width?: number;
    data?: BinaryData;
    httpHeaders?: Object;
    withCredentials?: boolean;
    password?: string;
    length?: number;
    docBaseUrl?: string;
    cMapUrl?: string;
    cMapPacked?: boolean;
    CMapReaderFactory?: Object;
    useSystemFonts?: boolean;
    onError?: (error: any) => void;
    onRendered?: () => void;
}

export interface AbnerJsPdfPreview {
    preview: (src: string | ArrayBuffer | Blob) => Promise<any>;
    rerender: () => Promise<any>;
    save: (fileName?: string) => void;
    setOptions: (options: Options) => void;
    setRequestOptions: (requestOptions?: any) => void;
    destroy: ()=> void;
}
declare const abnerJsPdf: {
    init: (container: HTMLElement, options?: Options, requestOptions?: any) => AbnerJsPdfPreview;
};
export default abnerJsPdf;