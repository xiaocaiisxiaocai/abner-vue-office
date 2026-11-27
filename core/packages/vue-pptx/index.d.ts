export type OfficeSource = string | ArrayBuffer | ArrayBufferView | Blob | Response;

export interface RequestOptions {
    method?: string;
    headers?: HeadersInit;
    withCredentials?: boolean;
    credentials?: RequestCredentials;
    [key: string]: any;
}

export interface PptxOptions {
    renderer?: string;
    width?: number;
    height?: number;
    [key: string]: any;
}

export type Options = PptxOptions;

export interface PptxProps {
    src?: OfficeSource | null;
    requestOptions?: RequestOptions;
    options?: PptxOptions;
    onRendered?: (pptx?: any) => void;
    onError?: (error: any) => void;
    class?: any;
    style?: any;
    [key: string]: any;
}

export interface AbnerVueOfficePptxInstance {
    $props: PptxProps;
    save: (fileName?: string) => void;
    rerender: () => Promise<void>;
}

export interface AbnerVueOfficePptxComponent {
    readonly name: 'AbnerVueOfficePptx';
    new (): AbnerVueOfficePptxInstance;
    install(app: any): void;
}

declare const AbnerVueOfficePptx: AbnerVueOfficePptxComponent;
export default AbnerVueOfficePptx;
