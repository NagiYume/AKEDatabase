# 公共能力与界面

- 优先复用 `AKEV3.table`、`akeDataLoader`、`akeFetch`、`AKEUI`、`parseText`、`renderRawValueTip`、`AKEVoicePlayer` 和 `__akeRouter`，先查看现有调用方式。
- 相同业务转换共用实现；页面只组织展示。避免另建取数、语音播放、配方解析或富文本管线。
- 优先复用已有 `ake-ui-*` 组件。为适配新功能，可以自行新增或调整 CSS，保持页面整体风格一致。结构和共享组件规则写入 `theme/light.css`，不得在模块 HTML、内联 `<style>` 或独立样式表中添加规则。每次样式改动都要同时审阅 `theme/light.css`、`theme/dark.css`、`theme/yellow.css`：light 维护共享结构，dark/yellow 为新增的主题外观提供对应作用域变量，确保三种主题下均一致可用；同步更新三份文件的 `cssversion`。维护模块挂载/销毁、事件和异步请求生命周期。
- 界面文案遵循现有 i18n 结构、占位符和键名，默认补齐简体中文与英文，其他语言不擅自推测翻译。游戏文本从文本表本地化，缺失时保留 ID 或明确缺失状态。
- 游戏内 ID 属于隐藏技术信息：只有“隐藏模块”开关开启（`showHidden === true`）时才展示；开关关闭时不得显示地区、关卡、任务、奖励、物品、芯片、词缀、组合或其他游戏内 ID。缺失名称应使用本地化的“未命名/不可用”等安全文案，除非用户明确要求展示原始 ID。
