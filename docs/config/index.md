# 属性

## src

- 类型：`String | ArrayBuffer | ArrayBufferView | Blob | Response`

文档地址或二进制内容，可为文件在 CDN 或服务器上的地址，或者通过 `FileReader`、`fetch` 读取的 `ArrayBuffer`、`Uint8Array` 等 `ArrayBufferView`、`Blob`、`Response` 格式。

## request-options
- 类型：Object

如果属性src是个文件地址，组件内部会通过window.fetch（Excel 内部通过 XMLHttpRequest）进行请求，可以用来设置headers、withCredentials等请求信息。


## options

- 类型： Object

预览需要的一些特殊配置，不同预览组件可配置项各不相同。

- excel预览

excel相关的配置项如下：

- `xls`：预览 `.xlsx` 文件设为 `false`（默认）；预览 `.xls` 文件设为 `true`
- `showContextmenu`：是否显示右键菜单，默认 `false`
- `minColLength`：excel最少渲染多少列，如果想实现excel文件内容有几列，就渲染几列，可以将此值设置为0，默认 `20`
- `minRowLength`：excel最少渲染多少行，如果想实现根据excel实际行数渲染，可以将此值设置为0，默认 `100`
- `widthOffset`：在默认渲染的列表宽度上再加 Npx宽
- `heightOffset`：在默认渲染的列表高度上再加 Npx高
- `beforeTransformData`：底层通过exceljs获取excel文件内容，通过该钩子函数，可以对获取的excel文件内容进行修改，比如某个单元格的数据显示不正确，可以在此自行修改每个单元格的value值。
- `transformData`：将获取到的excel数据进行处理之后且渲染到页面之前，可通过transformData对即将渲染的数据及样式进行修改，此时每个单元格的text值就是即将渲染到页面上的内容。

```javascript
{
  "xls": false,
  "showContextmenu": false,
  "minColLength": 20, 
  "minRowLength": 100,
  "widthOffset": 10, //在默认渲染的列表宽度上再加10px宽
  "heightOffset": 10, //在默认渲染的列表高度上再加10px高
  "beforeTransformData": function (workbookData){
        //修改workbookData，可以打印出来看看数据格式
        return workbookData;
  },
  "transformData": function (workbookData){
      //修改workbookData，可以打印出来看看数据格式
      return workbookData;    
  }
}
```

- docx预览

docx预览组件支持的可配置项如下

```typescript
{
    className: string = "docx", //class name/prefix for default and document style classes
    inWrapper: boolean = true, //enables rendering of wrapper around document content
    ignoreWidth: boolean = false, //disables rendering width of page
    ignoreHeight: boolean = false, //disables rendering height of page
    ignoreFonts: boolean = false, //disables fonts rendering
    breakPages: boolean = true, //enables page breaking on page breaks
    ignoreLastRenderedPageBreak: boolean = false, //disables page breaking on lastRenderedPageBreak elements
    experimental: boolean = false, //enables experimental features (tab stops calculation)
    trimXmlDeclaration: boolean = true, //if true, xml declaration will be removed from xml documents before parsing
    useBase64URL: boolean = false, //if true, images, fonts, etc. will be converted to base 64 URL, otherwise URL.createObjectURL is used
    useMathMLPolyfill: boolean = false, //includes MathML polyfills for chrome, edge, etc.
    renderChanges: false, //enables experimental rendering of document changes (insertions/deletions)
    debug: boolean = false, //enables additional logging
}
```

- pdf预览

pdf 预览组件支持的可配置项如下

```javascript
const options = {
    width: 500, //number，可不传，用来控制pdf预览的宽度，默认根据文档实际宽度计算
    gap: 10, //number，页面之间的间距（像素），默认 10
    defaultScale: 1, //number，默认缩放比例，默认 1
    httpHeaders: {}, //object, Basic authentication headers
    password: '', //string, 加密pdf的密码
    //更多配置参见 https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html
}
```

- pptx预览

pptx 预览组件支持的可配置项如下

```javascript
const options = {
    width: 960, //number，可不传，默认取容器宽度或 960
    height: 540, //number，可不传，默认取容器高度或 540
}
```


## staticFileUrl [pdf特有属性]
- 类型： String

pdf渲染时可能会请求一些bcmap文件，这些文件默认从 https://unpkg.com/pdfjs-dist@3.1.81/ 加载，但是可能存在网络不通问题，如果遇到这种问题，可以将这些文件放到自己静态目录，然后修改该属性，告诉组件去这里请求bcmap文件。

涉及的文件存放在当前github项目中 `core/public/static/cmaps` 目录下，可将 `cmaps` 目录复制到你的静态服务目录下，然后修改 `staticFileUrl` 为 `cmaps` 文件夹对应的父地址，必须以 `http` 或 `https` 开头，如 `https://example.com/static/`

## defaultScale [pdf特有属性]
- 类型：`Number`（默认 `1`）

设置 PDF 预览的默认缩放比例（优先级低于 `options.defaultScale`）。

## 组件方法（通过 ref 调用）

- `save(fileName?: string)`：四个 Vue 组件均支持导出下载当前已加载文档。
- `rerender(): Promise<void>`：`@abner-vue-office/pdf` 与 `@abner-vue-office/pptx` 支持根据当前容器或配置重新渲染。
- `getScale(): number` / `setScale(scale: number): void`：`@abner-vue-office/pdf` 支持读取与动态设置缩放比例。
