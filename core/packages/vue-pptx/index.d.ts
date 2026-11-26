export interface Options {
    width?: number;
    height?: number;
    [key: string]: any;
}

declare const AbnerVueOfficePptx: {
    install?: (vue: any) => void;
    src: string | ArrayBuffer | Blob;
    requestOptions?: Record<string, any>;
    options?: Options;
    save?: (fileName?: string) => void;
};
export default AbnerVueOfficePptx;
