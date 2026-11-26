# abner-vue-office

支持多种文件（**docx、excel、pdf、pptx**）预览的 Vue 组件库，支持 Vue 2 / Vue 3，也支持非 Vue 框架的原生 JS 预览。

## 功能特色
- 一站式：提供 Word（`.docx`）、PDF（`.pdf`）、Excel（`.xlsx`、`.xls`）、PPT（`.pptx`）多种文档的在线预览方案
- 简单：只需提供文档的 `src`（网络地址、`ArrayBuffer` 或 `Blob`）即可完成文档预览
- 体验好：选择每个文档的最佳预览方案，保证用户体验和性能都达到最佳状态
- 性能好：针对数据量较大做了优化

## 安装
```shell
# docx 文档预览组件
npm install @abner-vue-office/docx vue-demi@0.14.6

# excel 文档预览组件
npm install @abner-vue-office/excel vue-demi@0.14.6

# pdf 文档预览组件
npm install @abner-vue-office/pdf vue-demi@0.14.6

# pptx 文档预览组件
npm install @abner-vue-office/pptx vue-demi@0.14.6
```
如果是 Vue 2.6 版本或以下还需要额外安装 `@vue/composition-api`：
```shell
npm install @vue/composition-api
```

## 使用示例

文档预览场景大致可以分为三种：
- 有文档 CDN 地址，比如 `https://***.docx`，将文档地址字符串传给组件的 `src` 属性
- 通过接口请求获取文件内容，此时可以获取文件的 `ArrayBuffer` 或 `Blob` 格式数据传给组件的 `src` 属性
- 文件上传时预览，此时可以获取文件的 `ArrayBuffer` 或 `Blob` 格式数据传给组件的 `src` 属性

<details>
<summary>docx 文件预览示例（三种使用方式均有示例）</summary>

**1. 使用网络地址预览**
```vue
<template>
    <abner-vue-office-docx
        :src="docx"
        style="height: 100vh;"
        @rendered="rendered"
    />
</template>

<script>
// 引入 AbnerVueOfficeDocx 组件
import AbnerVueOfficeDocx from '@abner-vue-office/docx'
// 引入相关样式
import '@abner-vue-office/docx/lib/index.css'

export default {
    components: {
        AbnerVueOfficeDocx
    },
    data() {
        return {
            docx: 'https://your-domain.com/test.docx' // 设置文档网络地址，可以是相对地址
        }
    },
    methods: {
        rendered() {
            console.log('渲染完成')
        }
    }
}
</script>
```

**2. 上传文件预览**

读取文件的 `ArrayBuffer`：
```vue
<template>
    <div>
        <input type="file" @change="changeHandle" />
        <abner-vue-office-docx :src="src" />
    </div>
</template>

<script>
import AbnerVueOfficeDocx from '@abner-vue-office/docx'
import '@abner-vue-office/docx/lib/index.css'

export default {
    components: {
        AbnerVueOfficeDocx
    },
    data() {
        return {
            src: ''
        }
    },
    methods: {
        changeHandle(event) {
            let file = event.target.files[0]
            let fileReader = new FileReader()
            fileReader.readAsArrayBuffer(file)
            fileReader.onload = () => {
                this.src = fileReader.result
            }
        }
    }
}
</script>
```

**3. 二进制文件预览**

如果后端给的不是 CDN 地址，而是返回二进制流的接口，则可以获取文件的 `ArrayBuffer` 数据传递给 `src` 属性：

```vue
<template>
    <abner-vue-office-docx
        :src="docx"
        style="height: 100vh;"
        @rendered="rendered"
    />
</template>

<script>
// 引入 AbnerVueOfficeDocx 组件
import AbnerVueOfficeDocx from '@abner-vue-office/docx'
// 引入相关样式
import '@abner-vue-office/docx/lib/index.css'

export default {
    components: {
        AbnerVueOfficeDocx
    },
    data() {
        return {
            docx: ''
        }
    },
    mounted() {
        fetch('你的API文件地址', {
            method: 'post'
        }).then(res => {
            // 读取文件的 arrayBuffer
            res.arrayBuffer().then(buf => {
                this.docx = buf
            })
        })
    },
    methods: {
        rendered() {
            console.log('渲染完成')
        }
    }
}
</script>
```

</details>

<details>
<summary>excel 文件预览示例</summary>

通过网络地址预览示例如下，通过文件 `ArrayBuffer` 预览和上面 docx 的使用方式一致。
```vue
<template>
    <abner-vue-office-excel
        :src="excel"
        style="height: 100vh;"
        @rendered="renderedHandler"
        @error="errorHandler"
    />
</template>

<script>
// 引入 AbnerVueOfficeExcel 组件
import AbnerVueOfficeExcel from '@abner-vue-office/excel'
// 引入相关样式
import '@abner-vue-office/excel/lib/index.css'

export default {
    components: {
        AbnerVueOfficeExcel
    },
    data() {
        return {
            excel: 'https://your-domain.com/excel.xlsx' // 设置文档地址
        }
    },
    methods: {
        renderedHandler() {
            console.log('渲染完成')
        },
        errorHandler() {
            console.log('渲染失败')
        }
    }
}
</script>
```
</details>

<details>
<summary>pdf 文件预览示例</summary>

通过网络地址预览示例如下，通过文件 `ArrayBuffer` 预览和上面 docx 的使用方式一致。
```vue
<template>
    <abner-vue-office-pdf
        :src="pdf"
        style="height: 100vh"
        @rendered="renderedHandler"
        @error="errorHandler"
    />
</template>

<script>
// 引入 AbnerVueOfficePdf 组件
import AbnerVueOfficePdf from '@abner-vue-office/pdf'

export default {
    components: {
        AbnerVueOfficePdf
    },
    data() {
        return {
            pdf: 'https://your-domain.com/test.pdf' // 设置文档地址
        }
    },
    methods: {
        renderedHandler() {
            console.log('渲染完成')
        },
        errorHandler() {
            console.log('渲染失败')
        }
    }
}
</script>
```

</details>

<details>
<summary>pptx 文件预览示例</summary>

通过网络地址预览示例如下，通过文件 `ArrayBuffer` 预览和上面 docx 的使用方式一致。
```vue
<template>
    <abner-vue-office-pptx
        :src="pptx"
        style="height: 100vh"
        @rendered="renderedHandler"
        @error="errorHandler"
    />
</template>

<script>
import AbnerVueOfficePptx from '@abner-vue-office/pptx'

export default {
    components: {
        AbnerVueOfficePptx
    },
    data() {
        return {
            pptx: 'https://your-domain.com/test.pptx' // 设置文档地址
        }
    },
    methods: {
        renderedHandler() {
            console.log('渲染完成')
        },
        errorHandler() {
            console.log('渲染失败')
        }
    }
}
</script>
```

</details>

## 非 Vue 框架（原生 JS / React 等）预览

- `@abner-vue-office/js-docx`
- `@abner-vue-office/js-excel`
- `@abner-vue-office/js-pdf`

详细用法请参见 `docs/guide/js-preview.md`。

## 项目依赖的第三方库

- docx：基于 `docx-preview` 库实现
- pdf：基于 `pdfjs` 库实现，实现了虚拟列表增加性能
- excel：基于 `exceljs`、`xlsx` 和 `x-data-spreadsheet` 实现
- pptx：基于 `pptx-preview` 实现
