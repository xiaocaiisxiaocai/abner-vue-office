# xlsx/xls文件预览
::: tip
支持 `.xlsx` 和 `.xls` 文件预览。预览 `.xls` 文件时，需在 `options` 中配置 `xls: true`。
:::

## 安装

```shell
# 安装组件（Vue 2.6 及以下需额外安装 @vue/composition-api）
npm install @abner-vue-office/excel vue-demi@0.14.6
```

## 使用网络地址预览

```vue
<template>
    <abner-vue-office-excel
        :src="excel"
        :options="options"
        style="height: 100vh;"
        @rendered="renderedHandler"
        @error="errorHandler"
    />
</template>

<script>
// 引入AbnerVueOfficeExcel组件
import AbnerVueOfficeExcel from '@abner-vue-office/excel'
// 引入相关样式
import '@abner-vue-office/excel/lib/index.css'

export default {
    components: {
        AbnerVueOfficeExcel
    },
    data() {
        return {
            options:{
                xls: false,       // 预览xlsx文件设为false；预览xls文件设为true
                showContextmenu: false, // 是否显示右键菜单，默认false
                minColLength: 0,  // excel最少渲染多少列（默认20），设为0则按内容实际列数渲染
                minRowLength: 0,  // excel最少渲染多少行（默认100），设为0则按内容实际行数渲染
                widthOffset: 10,  // 如果渲染出来的结果感觉列宽不够，可以在默认渲染的列宽上再加 Npx 宽
                heightOffset: 10, // 在默认渲染的行高上再加 Npx 高
                resizable: true,  // 是否允许拖拽表头调整列宽行高以及双击表头边线自适应，默认 true
                autoFit: false,   // 是否在文档加载完成后自动执行所有列与所有行自适应，默认 false
                autoFitCol: false, // 是否在加载完成后自动执行所有列自适应，默认 false
                autoFitRow: false, // 是否在加载完成后自动执行所有行自适应，默认 false
                beforeTransformData: (workbookData) => {return workbookData}, // 底层通过exceljs获取excel文件内容，通过该钩子函数，可以对获取的excel文件内容进行修改，比如某个单元格的数据显示不正确，可以在此自行修改每个单元格的value值。
                transformData: (workbookData) => {return workbookData}, // 将获取到的excel数据进行处理之后且渲染到页面之前，可通过transformData对即将渲染的数据及样式进行修改，此时每个单元格的text值就是即将渲染到页面上的内容
            },
            excel: 'https://your-domain.com/demo/excel.xlsx'// 设置文档地址
        }
    },
    methods: {
        renderedHandler() {
            console.log("渲染完成")
        },
        errorHandler() {
            console.log("渲染失败")
        }
    }
}
</script>
```

## 列宽行高调整与自适应（原生 Excel 交互）

默认 `options.resizable: true`，预览模式下支持与原生 Excel 一致的列宽/行高交互：

- **调整单列 / 单行**：拖拽列头或行头分隔线即可手动调整宽度/高度；双击分隔线可自适应当前列宽/行高（鼠标悬停在分隔线左右 / 上下两侧均会高亮命中）。
- **批量调整 / 自适应选中列或行**：跨列头或行头拖拽多选（或结合 `Shift` 点击表头）后，拖拽或双击选中范围内任意列的分隔线 / 行的分隔线，可批量调整或批量自适应所选列宽/行高。
- **所有列自适应 / 所有行自适应**：点击左上角全选三角 `◢`（或按下 `Ctrl+A` / `Cmd+A`）全选工作表后，双击任意列头分隔线即可自适应**所有列宽**，双击任意行头分隔线即可自适应**所有行高**；拖拽任意列/行分隔线可统一调整所有可见列宽/行高。
- **配置与方法调用**：也可在加载时配置 `options.autoFit` / `autoFitCol` / `autoFitRow`，或通过组件实例方法 `autoFitCol(colIndex, opts)`、`autoFitAllCols(opts)`、`autoFitRow(rowIndex, opts)`、`autoFitAllRows(opts)`、`autoFitAll(opts)` 编程触发。

## 上传文件预览

和docx的上传文件预览一样，获取文件的ArrayBuffer，传给组件的src属性。

需要注意：如果允许用户同时上传 `.xlsx` 和 `.xls` 本地文件，请在 `FileReader.onload` 中更新 `this.src` 之前根据上传文件名的后缀动态设置 `options.xls`（例如：`this.options.xls = /\.xls$/i.test(file.name); this.src = reader.result;`），因为传入 `ArrayBuffer` 后组件无法仅凭二进制自动判断为 `.xls`。
