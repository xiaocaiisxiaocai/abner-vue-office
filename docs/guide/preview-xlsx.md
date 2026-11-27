# xlsx/xls文件预览
::: tip
支持 `.xlsx` 和 `.xls` 文件预览。预览 `.xls` 文件时，需在 `options` 中配置 `xls: true`。
:::

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

## 上传文件预览

和docx的上传文件预览一样，获取文件的ArrayBuffer，传给组件的src属性。

需要注意：如果允许用户同时上传 `.xlsx` 和 `.xls` 本地文件，请根据上传文件名的后缀动态设置 `options.xls`（例如：`this.options.xls = /\.xls$/i.test(file.name)`），因为传入 `ArrayBuffer` 后组件无法仅凭二进制自动判断为 `.xls`（可通过 `this.options.xls = /\.xls$/i.test(file.name)` 在解析前切换）。
