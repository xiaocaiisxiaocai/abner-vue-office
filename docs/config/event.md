# 事件

## rendered

渲染完成事件，可以在该事件中处理关闭loading操作等。

首次渲染完成及每次src变化之后渲染完成都会触发该事件。在 `@abner-vue-office/pptx` 组件中，该事件还会回传解析后的 `pptx` 数据对象。

## error

失败事件，各种失败都会触发该事件，包括网络请求失败，渲染失败等。

## switchSheet [excel特有事件]

切换工作表（Sheet）时触发，回调参数为当前激活工作表的索引（`number`，从 `0` 开始）。

## cellSelected [excel特有事件]

点击选中单个单元格时触发，回调参数为 `{ cell, rowIndex, columnIndex }`。

## cellsSelected [excel特有事件]

框选多个单元格区域时触发，回调参数为 `{ cell, startRowIndex, startColumnIndex, endRowIndex, endColumnIndex }`。
