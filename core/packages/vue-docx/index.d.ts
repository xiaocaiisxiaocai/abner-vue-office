export interface RequestOptions {
    method?: string;
    headers?: Record<string, string>;
    withCredentials?: boolean;
    credentials?: RequestCredentials;
    [key: string]: any;
}

export interface DocxOptions {
    className?: string;
    inWrapper?: boolean;
    ignoreWidth?: boolean;
    ignoreHeight?: boolean;
    ignoreFonts?: boolean;
    breakPages?: boolean;
    ignoreLastRenderedPageBreak?: boolean;
    experimental?: boolean;
    trimXmlDeclaration?: boolean;
    useBase64URL?: boolean;
    useMathMLPolyfill?: boolean;
    renderHeaders?: boolean;
    renderFooters?: boolean;
    renderFootnotes?: boolean;
    renderEndnotes?: boolean;
    renderChanges?: boolean;
    showChanges?: boolean;
    debug?: boolean;
}

declare const AbnerVueOfficeDocx: {
    install?: (vue: any) => void;
    src: string | ArrayBuffer | Blob;
    requestOptions?: RequestOptions;
    options?: DocxOptions;
    save?: (fileName?: string) => void;
};
export default AbnerVueOfficeDocx;
