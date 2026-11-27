export type OfficeSource = string | ArrayBuffer | ArrayBufferView | Blob | Response;

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
    hideWrapperOnPrint?: boolean;
    ignoreWidth?: boolean;
    ignoreHeight?: boolean;
    ignoreFonts?: boolean;
    breakPages?: boolean;
    ignoreLastRenderedPageBreak?: boolean;
    experimental?: boolean;
    trimXmlDeclaration?: boolean;
    useBase64URL?: boolean;
    renderHeaders?: boolean;
    renderFooters?: boolean;
    renderFootnotes?: boolean;
    renderEndnotes?: boolean;
    renderChanges?: boolean;
    renderComments?: boolean;
    renderAltChunks?: boolean;
    debug?: boolean;
    [key: string]: any;
}

export type Options = DocxOptions;

export interface DocxProps {
    src?: OfficeSource | null;
    requestOptions?: RequestOptions;
    options?: DocxOptions;
    onRendered?: () => void;
    onError?: (error: any) => void;
    class?: any;
    style?: any;
    [key: string]: any;
}

export interface AbnerVueOfficeDocxInstance {
    $props: DocxProps;
    save: (fileName?: string) => void;
}

export interface AbnerVueOfficeDocxComponent {
    new (): AbnerVueOfficeDocxInstance;
    install(app: any): void;
}

declare const AbnerVueOfficeDocx: AbnerVueOfficeDocxComponent;
export default AbnerVueOfficeDocx;
