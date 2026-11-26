export interface Options {
    inWrapper?: boolean;
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
    useMathMLPolyfill?: boolean;
    renderChanges?: boolean;
}

export interface AbnerJsDocxPreview {
    preview: (src: string | ArrayBuffer | Blob) => Promise<any>;
    save: (fileName?: string) => void;
    setOptions: (options: Options) => void;
    setRequestOptions: (requestOptions?: any) => void;
    destroy: ()=> void;
}
declare const abnerJsDocx: {
    init: (container: HTMLElement, options?: Options, requestOptions?: any) => AbnerJsDocxPreview;
};
export default abnerJsDocx;