# 属性

## src

- 类型：`String | ArrayBuffer | ArrayBufferView | Blob | Response`

文档地址或二进制内容，可为文件在 CDN 或服务器上的地址，或者通过 `FileReader`、`fetch` 读取的 `ArrayBuffer`、`Uint8Array` 等 `ArrayBufferView`、`Blob`、`Response` 格式。

## request-options
- 类型：`Object`

如果属性 `src` 是个文件地址：
- `@abner-vue-office/docx` 与 `@abner-vue-office/pptx` 内部通过 `window.fetch` 请求，支持 `method`、`headers`、`withCredentials`、`credentials` 等配置。
- `@abner-vue-office/excel` 内部通过 `XMLHttpRequest` 请求，额外支持 `timeout`、`body` 等配置。
- `@abner-vue-office/pdf` 委托给 `pdfjsLib.getDocument`，从中读取 `headers`（对应 `httpHeaders`）及 `withCredentials` / `credentials: 'include'`。

## options

- 类型：`Object`

预览需要的一些特殊配置，不同预览组件可配置项各不相同。

- excel预览

excel相关的配置项如下：

- `xls`：预览 `.xlsx` 文件设为 `false`（默认）；预览 `.xls` 文件设为 `true`
- `showContextmenu`：是否启用右键菜单（支持动态切换；只读预览模式下仅展示复制操作），默认 `false`
- `minColLength`：excel最少渲染多少列，如果想实现excel文件内容有几列，就渲染几列，可以将此值设置为0，默认 `20`
- `minRowLength`：excel最少渲染多少行，如果想实现根据excel实际行数渲染，可以将此值设置为0，默认 `100`
- `widthOffset`：在默认渲染的列宽上再加 Npx 宽
- `heightOffset`：在默认渲染的行高上再加 Npx 高
- `beforeTransformData`：底层通过exceljs获取excel文件内容，通过该钩子函数，可以对获取的excel文件内容进行修改，比如某个单元格的数据显示不正确，可以在此自行修改每个单元格的value值。
- `transformData`：将获取到的excel数据进行处理之后且渲染到页面之前，可通过transformData对即将渲染的数据及样式进行修改，此时每个单元格的text值就是即将渲染到页面上的内容。

```javascript
const options = {
  xls: false,
  showContextmenu: false,
  minColLength: 20,
  minRowLength: 100,
  widthOffset: 10, // 在默认渲染的列宽上再加10px宽
  heightOffset: 10, // 在默认渲染的行高上再加10px高
  beforeTransformData: function (workbookData) {
    // 修改workbookData，可以打印出来看看数据格式
    return workbookData;
  },
  transformData: function (workbookData) {
    // 修改workbookData，可以打印出来看看数据格式
    return workbookData;
  }
};
```

- docx预览

docx预览组件支持的可配置项如下（对应 `docx-preview@0.3.x`）：

```typescript
interface DocxOptions {
    className?: string; // 默认 "docx"，class name/prefix for default and document style classes
    inWrapper?: boolean; // 默认 true，enables rendering of wrapper around document content
    hideWrapperOnPrint?: boolean; // 默认 false，disables wrapper styles when printing
    ignoreWidth?: boolean; // 默认 false，disables rendering width of page
    ignoreHeight?: boolean; // 默认 false，disables rendering height of page
    ignoreFonts?: boolean; // 默认 false，disables fonts rendering
    breakPages?: boolean; // 默认 true，enables page breaking on page breaks
    ignoreLastRenderedPageBreak?: boolean; // 默认 false，disables page breaking on lastRenderedPageBreak elements
    experimental?: boolean; // 默认 false，enables experimental features (tab stops calculation)
    trimXmlDeclaration?: boolean; // 默认 true，if true, xml declaration will be removed from xml documents before parsing
    useBase64URL?: boolean; // 默认 false，if true, images, fonts, etc. will be converted to base 64 URL, otherwise URL.createObjectURL is used
    renderHeaders?: boolean; // 默认 true，enables headers rendering
    renderFooters?: boolean; // 默认 true，enables footers rendering
    renderFootnotes?: boolean; // 默认 true，enables footnotes rendering
    renderEndnotes?: boolean; // 默认 true，enables endnotes rendering
    renderChanges?: boolean; // 默认 false，enables experimental rendering of document changes (insertions/deletions)
    renderComments?: boolean; // 默认 false，enables experimental rendering of document comments
    renderAltChunks?: boolean; // 默认 true，enables rendering of altChunks (html parts)
    debug?: boolean; // 默认 false，enables additional logging
}
```

- pdf预览

pdf 预览组件支持的可配置项如下：

```javascript
const options = {
    width: 800, // number，可不传，用来控制pdf预览的基准宽度；默认根据容器宽度减去 20px 计算（兜底 800px）
    gap: 10, // number，页面之间的间距（像素），默认 10
    defaultScale: 1, // number，默认缩放比例，默认 1
    httpHeaders: {}, // object, 请求头配置
    withCredentials: false, // boolean, 跨域请求是否携带凭证
    password: '', // string, 加密pdf的密码
    // 更多配置参见 https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html
}
```

- pptx预览

pptx 预览组件支持的可配置项如下：

```javascript
const options = {
    renderer: 'svg', // string，可不传，pptx-preview 渲染器配置
    width: 960, // number，可不传，默认取容器宽度或 960
    height: 540, // number，可不传，默认取容器高度或 540
}
```


## staticFileUrl [pdf特有属性]
- 类型：`String`

pdf渲染时可能会请求一些bcmap文件，这些文件默认从 https://unpkg.com/pdfjs-dist@3.1.81/ 加载，但是可能存在网络不通问题，如果遇到这种问题，可以将这些文件放到自己静态目录，然后修改该属性，告诉组件去这里请求bcmap文件。

涉及的文件存放在当前github项目中 `core/public/static/cmaps` 目录下，可将 `cmaps` 目录复制到你的静态服务目录下，然后修改 `staticFileUrl` 为 `cmaps` 文件夹对应的父地址，可传入完整 URL（如 `https://example.com/static/`）或同源相对路径（如 `/static/`）。

## defaultScale [pdf特有属性]
- 类型：`Number`（默认 `1`）

设置 PDF 预览的默认缩放比例（优先级低于 `options.defaultScale`）。

## 组件方法（通过 ref 调用）

- `save(fileName?: string)`：四个 Vue 组件均支持导出下载当前已加载文档。
- `rerender(): Promise<void>`：`@abner-vue-office/pdf` 与 `@abner-vue-office/pptx` 支持根据当前容器或配置重新渲染。
- `getScale(): number` / `setScale(scale: number): void`：`@abner-vue-office/pdf` 支持读取与动态设置缩放比例。
