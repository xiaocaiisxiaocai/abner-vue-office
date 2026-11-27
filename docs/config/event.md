# 事件

## rendered

渲染完成事件，可以在该事件中处理关闭 loading 操作等。

- 首次渲染完成及每次 `src` 变化之后渲染完成都会触发该事件；`@abner-vue-office/pdf` 调用 `rerender()` / `setScale()` 完成后，以及 `@abner-vue-office/pptx` 调用 `rerender()` 完成后也会触发。
- 在 `@abner-vue-office/pptx` 组件中，该事件还会回传解析后的 `pptx` 数据对象。
- 当运行时将 `src` 设为空值（如 `''` 或 `null`）时：`@abner-vue-office/docx` 会清空画布并触发 `rendered`；`@abner-vue-office/excel` 与 `@abner-vue-office/pdf` 会清空画布并触发 `error`；`@abner-vue-office/pptx` 会清空画布（不触发事件）。

## error

失败事件，各种失败都会触发该事件，包括网络请求失败、文件解析失败、渲染失败等。

## switchSheet [excel特有事件]

加载工作簿完成（触发 `switchSheet(0)`）以及切换工作表（Sheet）时触发，回调参数为当前激活工作表的索引（`number`，从 `0` 开始）。

## cellSelected [excel特有事件]

点击选中单个单元格时触发，回调参数为 `{ cell, rowIndex, columnIndex }`。

## cellsSelected [excel特有事件]

框选多个单元格区域时触发，回调参数为 `{ cell, startRowIndex, startColumnIndex, endRowIndex, endColumnIndex }`。
