export interface Options {
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

declare const AbnerVueOfficePdf: {
    install?: (vue: any) => void;
    src: string | ArrayBuffer | Blob;
    staticFileUrl?: string;
    requestOptions?: Record<string, any>;
    options?: Options;
    defaultScale?: number;
    rerender?: () => void;
    save?: (fileName?: string) => void;
    getScale?: () => number;
    setScale?: (scale: number) => void;
};
export default AbnerVueOfficePdf;
