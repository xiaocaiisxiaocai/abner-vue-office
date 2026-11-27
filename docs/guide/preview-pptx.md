# pptx文件预览

## 安装
```shell
npm install @abner-vue-office/pptx vue-demi@0.14.6
```

## 使用网络地址预览

```vue
<template>
    <abner-vue-office-pptx
        :src="pptx"
        :options="options"
        style="height: 100vh;"
        @rendered="renderedHandler"
        @error="errorHandler"
    />
</template>

<script>
// 引入 AbnerVueOfficePptx 组件
import AbnerVueOfficePptx from '@abner-vue-office/pptx'

export default {
    components: {
        AbnerVueOfficePptx
    },
    data() {
        return {
            options: {
                width: 960, // 可不传，默认取容器宽度或 960
                height: 540 // 可不传，默认取容器高度或 540
            },
            pptx: 'https://your-domain.com/test.pptx' // 设置文档地址
        }
    },
    methods: {
        renderedHandler(pptx) {
            console.log('渲染完成', pptx)
        },
        errorHandler(e) {
            console.log('渲染失败', e)
        }
    }
}
</script>
```

## 上传文件预览

和 docx 的上传文件预览一致，获取文件的 `ArrayBuffer` 或 `Blob`，传给组件的 `src` 属性。
