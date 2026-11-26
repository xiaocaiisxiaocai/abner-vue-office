# abner-vue-office 项目启动与发包（Windows）

```shell
# 进入源码目录
cd core

# 安装依赖，推荐用 pnpm
pnpm i

# 开发 + 预览效果
npm run dev
```

# 发包

> 构建脚本已适配为 Windows 原生 Node 脚本（不再依赖 macOS/Linux 的 `cp`/`mkdir`/`mv` 命令）。

发包之前首先要对各个库进行打包，支持一键打包：

```shell
npm run lib
```

也可以针对单个库进行打包，具体见 `core/package.json` 中的 script，如对 `@abner-vue-office/excel` 进行打包：

```shell
npm run lib:vue-excel
```

进入单个包目录，进行发包：

```shell
cd packages/vue-excel
npm publish
```
