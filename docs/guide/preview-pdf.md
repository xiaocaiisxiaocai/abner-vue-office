# pdf文件预览

## 使用网络地址预览

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
//引入AbnerVueOfficePdf组件
import AbnerVueOfficePdf from '@abner-vue-office/pdf'

export default {
    components: {
        AbnerVueOfficePdf
    },
    data() {
        return {
            pdf: 'http://static.shanhuxueyuan.com/test.pdf' //设置文档地址
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