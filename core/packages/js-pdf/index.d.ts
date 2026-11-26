export interface Options {
    staticFileUrl?: string;
    gap?: number;
    width?: number;
    data?: ArrayBuffer | Uint8Array;
    httpHeaders?: Record<string, string>;
    withCredentials?: boolean;
    password?: string;
    length?: number;
    docBaseUrl?: string;
    cMapUrl?: string;
    cMapPacked?: boolean;
    CMapReaderFactory?: Record<string, any>;
    enableXfa?: boolean;
    useSystemFonts?: boolean;
    onError?: (error: any) => void;
    onRendered?: () => void;
    [key: string]: any;
}

export interface AbnerJsPdfPreview {
    preview: (src: string | ArrayBuffer | Blob) => Promise<any>;
    rerender: () => Promise<any>;
    save: (fileName?: string) => void;
    setOptions: (options: Options) => void;
    setRequestOptions: (requestOptions?: Record<string, any>) => void;
    destroy: () => void;
}

declare const abnerJsPdf: {
    init: (container: HTMLElement, options?: Options, requestOptions?: Record<string, any>) => AbnerJsPdfPreview;
};
export default abnerJsPdf;
