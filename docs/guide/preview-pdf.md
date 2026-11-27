# pdf文件预览

## 安装
```shell
npm install @abner-vue-office/pdf vue-demi@0.14.6
```

## 使用网络地址预览

```vue
<template>
    <abner-vue-office-pdf 
        :src="pdf"
        :options="options"
        style="height: 100vh"
        @rendered="renderedHandler"
        @error="errorHandler"
    />
</template>

<script>
// 引入AbnerVueOfficePdf组件
import AbnerVueOfficePdf from '@abner-vue-office/pdf'

export default {
    components: {
        AbnerVueOfficePdf
    },
    data() {
        return {
            options: {
                gap: 10,
                defaultScale: 1
            },
            pdf: 'https://your-domain.com/test.pdf' // 设置文档地址
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

## 属性与实例方法说明

- `staticFileUrl`：自定义 `cmaps` 字体映射目录根路径（默认为 `https://unpkg.com/pdfjs-dist@3.1.81/`）。
- `defaultScale`：默认缩放比例（默认 `1`，优先级低于 `options.defaultScale`）。
- 通过 `ref` 调用实例方法：`setScale(scale)`、`getScale()`、`rerender()`、`save(fileName)`。

## 上传文件预览

和docx的上传文件预览一样，获取文件的ArrayBuffer，传给组件的src属性。
