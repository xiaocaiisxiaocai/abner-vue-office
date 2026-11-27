# abner-vue-office简介

abner-vue-office是一个支持多种文件（docx、xlsx、xls、pdf、pptx）预览的vue组件库，支持vue2和vue3。

目标是成为使用最简单，功能最强大的文件预览库

## 功能特色
- 一站式：提供docx、xlsx、xls、pdf、pptx多种文档的在线预览方案，有它就够了，不用再四处寻找、测试、集成各种库了
- 使用简单：只需提供文档的src(网络地址)即可完成文档预览，也支持ArrayBuffer、ArrayBufferView、Blob、Response等多种格式
- 支持样式：不仅能预览内容，也支持文档样式，最大限度还原office文件内容


## 安装
```shell
# docx文档预览组件
npm install @abner-vue-office/docx vue-demi@0.14.6

# excel文档预览组件
npm install @abner-vue-office/excel vue-demi@0.14.6

# pdf文档预览组件
npm install @abner-vue-office/pdf vue-demi@0.14.6

# pptx文档预览组件
npm install @abner-vue-office/pptx vue-demi@0.14.6
```
如果是 Vue 2.6 版本或以下还需要额外安装并注册 `@vue/composition-api`：
```shell
npm install @vue/composition-api
```
```javascript
import Vue from 'vue'
import VueCompositionAPI from '@vue/composition-api'
Vue.use(VueCompositionAPI)
```
如果使用 `pnpm` 或启用了 `--ignore-scripts` 导致自动版本切换未执行，可手动切换或直接引入对应版本入口：
```shell
# 手动切换为 Vue 2（如需切换回 Vue 3 可传参数 3）
npx abner-vue-office-docx-switch 2
npx abner-vue-office-excel-switch 2
npx abner-vue-office-pdf-switch 2
npx abner-vue-office-pptx-switch 2
```
```javascript
// 或在 Vue 2 中直接引入 lib/v2（Vue 3 对应 lib/v3）
import AbnerVueOfficeDocx from '@abner-vue-office/docx/lib/v2'
import '@abner-vue-office/docx/lib/v2/index.css'
```


## 使用网络地址预览

docx、xlsx、pdf、pptx 四种文件的预览方式几乎一致，我们先以docx文档的预览为例，介绍下组件用法。

docx的预览如下：
```vue
<template>
    <abner-vue-office-docx
        :src="docx"
        style="height: 100vh;"
        @rendered="renderedHandler"
        @error="errorHandler"
    />
</template>

<script>
//引入AbnerVueOfficeDocx组件
import AbnerVueOfficeDocx from '@abner-vue-office/docx'
//引入相关样式
import '@abner-vue-office/docx/lib/index.css'

export default {
    components: {
        AbnerVueOfficeDocx
    },
    data() {
        return {
            docx: 'https://your-domain.com/test6.docx' //设置文档网络地址，可以是相对地址
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
可以看出，非常的简单，只需要指定文档的src远程地址即可。

建议为组件设置 `style` 高度（如 `height: 100vh;`）或确保其父容器拥有明确高度（组件根容器使用 `height: 100%`）。

组件渲染完成会抛出rendered事件，渲染失败会抛出error事件。


## 上传文件预览

预览通常有两种场景，一种是已有文件的远程地址，另一种是上传前预览，上传前预览主要是通过读取文件的ArrayBuffer格式，传给预览组件来实现。

我们以ElementUI的上传组件作为示例，当然也可以使用普通的input type="file"，只要能获取文件的ArrayBuffer格式数据即可。
```vue

<template>
    <div id="docx-demo">
        <el-upload
            :limit="1"
            :file-list="fileList"
            accept=".docx"
            :beforeUpload="beforeUpload"
            action=""
        >
            <el-button size="small" type="warning">点击上传</el-button>
        </el-upload>
        <abner-vue-office-docx :src="src" style="height: 100vh;"/>
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
            src: '',
            fileList: []
        }
    },
    methods: {
        //在beforeUpload中读取文件内容
        beforeUpload(file) {
            if (!file) return false;
            let reader = new FileReader();
            reader.onload = (loadEvent) => {
                let arrayBuffer = loadEvent.target.result;
                this.src = arrayBuffer;
            };
            reader.readAsArrayBuffer(file);
            return false
        }
    }
}
</script>
```
主要是利用在beforeUpload中获取上传的文件，然后利用FileReader以ArrayBuffer格式读取，读取之后传给预览组件。

如果是原生的input type="file"，也是类似的
```vue

<template>
    <div>
        <input type="file" @change="changeHandle"/>
        <abner-vue-office-docx :src="src" style="height: 100vh;"/>
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
            let file = event.target.files && event.target.files[0];
            if (!file) return;
            let fileReader = new FileReader();
            fileReader.onload = () => {
                this.src = fileReader.result;
            };
            fileReader.readAsArrayBuffer(file);
        }
    }
}
</script>
```
