export type OfficeSource = string | ArrayBuffer | ArrayBufferView | Blob | Response;

export interface RequestOptions {
    headers?: Record<string, string>;
    withCredentials?: boolean;
    credentials?: RequestCredentials;
    [key: string]: any;
}

export interface PdfOptions {
    width?: number;
    gap?: number;
    defaultScale?: number;
    data?: ArrayBuffer | Uint8Array;
    httpHeaders?: Record<string, string>;
    withCredentials?: boolean;
    password?: string;
    length?: number;
    docBaseUrl?: string;
    cMapUrl?: string;
    cMapPacked?: boolean;
    CMapReaderFactory?: new (...args: any[]) => any;
    enableXfa?: boolean;
    useSystemFonts?: boolean;
    [key: string]: any;
}

export type Options = PdfOptions;

export interface PdfProps {
    src?: OfficeSource | null;
    staticFileUrl?: string;
    requestOptions?: RequestOptions;
    options?: PdfOptions;
    defaultScale?: number;
    onRendered?: () => void;
    onError?: (error: any) => void;
    class?: any;
    style?: any;
    [key: string]: any;
}

export interface AbnerVueOfficePdfInstance {
    $props: PdfProps;
    $slots?: { default?: () => any };
    userScale: number;
    rerender: () => Promise<void>;
    save: (fileName?: string) => void;
    getScale: () => number;
    setScale: (scale: number) => void;
}

export interface AbnerVueOfficePdfComponent {
    readonly name: 'AbnerVueOfficePdf';
    new (): AbnerVueOfficePdfInstance;
    install(app: any): void;
}

declare const AbnerVueOfficePdf: AbnerVueOfficePdfComponent;
export default AbnerVueOfficePdf;
