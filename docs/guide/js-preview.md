# 非Vue框架文件预览

为了在非Vue的框架中进行Office文件预览，增加了通过js进行预览的方式。

docx、excel、pdf三个预览库的API几乎一致，只需要初始化时传入要挂载的Dom，然后传递要预览的文件地址，即可完成预览，非常地简单。
## docx文件预览

- 安装依赖库

```shell
# docx文件预览库
npm i @abner-vue-office/js-docx
```

- 预览

```javascript
import abnerJsDocx from "@abner-vue-office/js-docx";
import '@abner-vue-office/js-docx/lib/index.css'

//初始化时指明要挂载的父元素Dom节点
const myDocxPreviewer = abnerJsDocx.init(document.getElementById('docx'));

//传递要预览的文件地址即可
myDocxPreviewer.preview('https://your-domain.com/test.docx').then(res=>{
    console.log('预览完成');
}).catch(e=>{
    console.log('预览失败', e);
})

```

## excel文件预览

- 安装依赖库

```shell
# excel文件预览库
npm i @abner-vue-office/js-excel
```

- 预览

```javascript
import abnerJsExcel from "@abner-vue-office/js-excel";
import '@abner-vue-office/js-excel/lib/index.css';

const myExcelPreviewer = abnerJsExcel.init(document.getElementById('excel'));
myExcelPreviewer.preview('https://your-domain.com/test.xlsx').then(res=>{
    console.log('预览完成');
}).catch(e=>{
    console.log('预览失败', e);
})

```


## pdf文件预览

- 安装依赖库

```shell
# pdf文件预览库
npm i @abner-vue-office/js-pdf
```

- 预览

```javascript
import abnerJsPdf from "@abner-vue-office/js-pdf";

const myPdfPreviewer = abnerJsPdf.init(document.getElementById('pdf'), {
    onError: (e)=>{
        console.log('发生错误', e)
    },
    onRendered: ()=>{
        console.log('渲染完成')
    }
});
myPdfPreviewer.preview('https://your-domain.com/test.pdf');

```

## API

### init方法

三种库的init方法保持一致，init方法会返回预览对象。
```ts
init: (container: HTMLElement, options?: Options, requestOptions?: any) => AbnerJsPdfPreview | AbnerJsExcelPreview | AbnerJsDocxPreview;
```

- container

预览挂载的父容器Dom

- options

预览支持的配置参数，三个预览库支持的配置不同。

docx预览支持的配置，详细说明见库docx-preview：
```ts
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
```

excel支持的配置
```ts
export interface Options {
    xls?: boolean; //是否预览.xls格式文件，默认false
    minColLength?: number;  //excel最少渲染多少列，如果想实现xlsx文件内容有几列，就渲染几列，可以将此值设置为0.
    minRowLength?: number; //excel最少渲染多少行，默认100
    widthOffset?: number; //单元格列宽偏移量（像素）
    heightOffset?: number; //单元格行高偏移量（像素）
    showContextmenu?: boolean; //是否显示右键菜单，默认false
    beforeTransformData?: (workbookData: any) => any; //底层exceljs转换前钩子
    transformData?: (workbookData: any) => any; //数据转换后钩子
    switchSheet?: (sheetIndex: number) => void; //切换sheet回调
    cellSelected?: (event: ExcelCellEvent) => void; //单元格点击回调
    cellsSelected?: (event: ExcelCellsEvent) => void; //单元格框选回调
}
```

pdf支持的配置，详情见https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html

```ts
export interface Options {
    staticFileUrl?: string;
    gap?: number; //多个canvas之间的距离
    width?: number;
    data?: BinaryData;
    httpHeaders?: Object;
    withCredentials?: boolean;
    password?: string;
    length?: number;
    docBaseUrl?: string;
    cMapUrl?: string;
    cMapPacked?: boolean;
    CMapReaderFactory?: Object;
    enableXfa?: boolean;
    useSystemFonts?: boolean;
    onError?: (error: any) => void;
    onRendered?: () => void;
}
```

### preview方法
调用preview方法进行文件的预览。

preview方法接收参数支持：`string | ArrayBuffer | ArrayBufferView | Blob | Response`（文件 URL 地址、`ArrayBuffer`、`Uint8Array` 等 TypedArray、`Blob`、`Response`）。

```ts
preview: (src: string | ArrayBuffer | ArrayBufferView | Blob | Response) => Promise<any>
```

url格式适合有文件静态地址的情况，ArrayBuffer格式适合文件上传前的预览。

### setOptions方法

更新预览配置（浅合并，调用后可配合 `rerender` 或下一次 `preview` 生效）。

```ts
setOptions: (options: Options) => void;
```

### setRequestOptions方法

更新远程文件请求的 `requestOptions`（如 `headers`、`withCredentials` 等）。

```ts
setRequestOptions: (requestOptions?: Record<string, any>) => void;
```

### rerender方法 [js-pdf]

`@abner-vue-office/js-pdf` 支持在容器尺寸变化或 `setOptions` 后调用 `rerender()` 重新计算分页并渲染。

```ts
rerender: () => Promise<any>;
```

### save方法

调用save进行文件下载，参数名为下载的文件名称，可不传。

```ts
 save: (fileName?: string) => void;
```

### 浏览器 `<script>` 直接引入

如不通过构建工具打包，可直接使用各包的 `./lib/index.umd.js`（全局挂载 `window.abnerJsDocx` / `window.abnerJsExcel` / `window.abnerJsPdf`）及对应 `./lib/index.css`。

### destroy方法

卸载方法，可以在组件销毁前调用预览对象的卸载方法，避免长期使用造成内存泄露。
