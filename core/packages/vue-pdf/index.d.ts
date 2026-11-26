export type OfficeSource = string | ArrayBuffer | ArrayBufferView | Blob | Response;

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
    CMapReaderFactory?: Record<string, any>;
    enableXfa?: boolean;
    useSystemFonts?: boolean;
    [key: string]: any;
}

export type Options = PdfOptions;

export interface PdfProps {
    src?: OfficeSource | null;
    staticFileUrl?: string;
    requestOptions?: Record<string, any>;
    options?: PdfOptions;
    defaultScale?: number;
    onRendered?: () => void;
    onError?: (error: any) => void;
}

export interface AbnerVueOfficePdfInstance {
    $props: PdfProps;
    rerender: () => Promise<void>;
    save: (fileName?: string) => void;
    getScale: () => number;
    setScale: (scale: number) => void;
}

export interface AbnerVueOfficePdfComponent {
    new (): AbnerVueOfficePdfInstance;
    install(app: any): void;
}

declare const AbnerVueOfficePdf: AbnerVueOfficePdfComponent;
export default AbnerVueOfficePdf;
