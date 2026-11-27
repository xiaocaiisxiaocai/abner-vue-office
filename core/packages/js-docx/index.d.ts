export type OfficeSource = string | ArrayBuffer | ArrayBufferView | Blob | Response;

export interface RequestOptions {
    method?: string;
    headers?: HeadersInit;
    withCredentials?: boolean;
    credentials?: RequestCredentials;
    signal?: AbortSignal;
    [key: string]: any;
}

export interface Options {
    inWrapper?: boolean;
    hideWrapperOnPrint?: boolean;
    ignoreWidth?: boolean;
    ignoreHeight?: boolean;
    ignoreFonts?: boolean;
    breakPages?: boolean;
    debug?: boolean;
    experimental?: boolean;
    className?: string;
    trimXmlDeclaration?: boolean;
    renderHeaders?: boolean;
    renderFooters?: boolean;
    renderFootnotes?: boolean;
    renderEndnotes?: boolean;
    ignoreLastRenderedPageBreak?: boolean;
    useBase64URL?: boolean;
    renderChanges?: boolean;
    renderComments?: boolean;
    renderAltChunks?: boolean;
    [key: string]: any;
}

export interface AbnerJsDocxPreview {
    preview: (src: OfficeSource) => Promise<void>;
    save: (fileName?: string) => void;
    setOptions: (options?: Options) => void;
    setRequestOptions: (requestOptions?: RequestOptions) => void;
    destroy: () => void;
}

declare const abnerJsDocx: {
    init: (container: HTMLElement, options?: Options, requestOptions?: RequestOptions) => AbnerJsDocxPreview;
};
export default abnerJsDocx;
export as namespace abnerJsDocx;
