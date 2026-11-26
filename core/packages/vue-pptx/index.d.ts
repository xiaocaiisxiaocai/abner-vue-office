export type OfficeSource = string | ArrayBuffer | ArrayBufferView | Blob | Response;

export interface PptxOptions {
    width?: number;
    height?: number;
    [key: string]: any;
}

export type Options = PptxOptions;

export interface PptxProps {
    src?: OfficeSource | null;
    requestOptions?: Record<string, any>;
    options?: PptxOptions;
    onRendered?: (pptx?: any) => void;
    onError?: (error: any) => void;
}

export interface AbnerVueOfficePptxInstance {
    $props: PptxProps;
    save: (fileName?: string) => void;
    rerender: () => Promise<void>;
}

export interface AbnerVueOfficePptxComponent {
    new (): AbnerVueOfficePptxInstance;
    install(app: any): void;
}

declare const AbnerVueOfficePptx: AbnerVueOfficePptxComponent;
export default AbnerVueOfficePptx;
