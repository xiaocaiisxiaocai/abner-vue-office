declare namespace abnerJsPdf {
    export type OfficeSource = string | ArrayBuffer | ArrayBufferView | Blob | Response;

    export interface RequestOptions {
        headers?: Record<string, string>;
        withCredentials?: boolean;
        credentials?: RequestCredentials;
        [key: string]: any;
    }

    export interface Options {
        staticFileUrl?: string;
        gap?: number;
        width?: number;
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
        onError?: (error: any) => void;
        onRendered?: () => void;
        [key: string]: any;
    }

    export interface AbnerJsPdfPreview {
        preview: (src: OfficeSource) => Promise<void>;
        rerender: () => Promise<void>;
        save: (fileName?: string) => void;
        setOptions: (options?: Options) => void;
        setRequestOptions: (requestOptions?: RequestOptions) => void;
        destroy: () => void;
    }

    export function init(container: HTMLElement, options?: Options, requestOptions?: RequestOptions): AbnerJsPdfPreview;
}

export = abnerJsPdf;
