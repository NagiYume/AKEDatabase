# AKEGF 工具认证

工具认证面向提供抽卡记录迁移功能的应用。应用须同时支持导入和导出 v0.4 档案，并在应用内声明支持的版本，附上 [AKEGF 首页](https://www.akedata.wiki/?plugin=akegf&id=home)链接。文件的字段类型、条件必填项和分组合并规则见[标准化文档](/?plugin=akegf&id=standard)。

如果你的项目使用了 AKEGF 标准，欢迎通过 [Pull Request](https://github.com/NagiYume/AKEDatabase/pulls) 将你的项目添加到这里

## 导入后再导出的检查方法

[未签名多角色示例](/plugin/data/akegf/example.json)和[签名多角色示例](/plugin/data/akegf/example-signed.json)使用相同的角色和流水。签名版可用[示例专用公钥](https://verify.akedata.wiki/v1/providers/akegf-example/keys/8cOMDGbXz6FFT7xjWXaCU2vGAT9LoIM8LQjxWGlYh_o.json)验证。

1. 在测试会话中临时导入未签名版，再导出这些角色的记录。使用签名版检查验签流程，预期结果为「示例档案验签通过」。
2. 用本页表单检查导出的 JSON。格式通过表明这份文件符合 v0.4 的结构和唯一性规则。工具认证还需要对照导入前后的数据。
3. 按 `(region, server_id, uid)` 对照角色分组。示例中的国服角色应保留三条流水，国际服角色应保留一条。国服角色的干员抽取和武器申领具有相同的毫秒时间和流水号，但来源类别不同，导出后应仍有两条记录。
4. 逐条核对事件类型和来源已提供的卡池、获得物、星级、毫秒时间及流水号。示例中的赠送武器应保留为 `gift_weapon`，省略缺失的星级。长流水号 `90071992547409931` 应按字符串原样保留。

## 格式校验工具

对签名档案，浏览器只从公钥目录查询提供方 ID 和公钥指纹，并在本地验签。结果分别显示格式和信任状态。未验证的档案仅供当前会话使用。导入规则见[标准化文档](/?plugin=akegf&id=standard)。

粘贴完整的 JSON 后点击「校验 JSON」，或选择本机文件直接校验。内容仅在当前浏览器中处理。

工具按 v0.4 Schema 检查字段、类型和取值，再检查重复角色分组和分组内重复流水号。例如，错误路径 `/endfield/0/list/1` 指向第一个角色的第二条流水。

## 登记签名公钥

通过项目 PR 提交项目链接、拟使用的提供方 ID、RSA 公钥 PEM 和基于公开示例生成的签名档案。维护者核对项目身份、支持的导入导出范围和样例签名后，将公钥登记到 [AKEGF 公钥目录](https://verify.akedata.wiki/)。同时支持导入和导出的项目可按上文提交往返结果，申请工具认证。私钥由提供方保管。轮换时先登记新公钥，再用新密钥签名。旧密钥泄露时申请撤销。签名规则见[标准化文档](/?plugin=akegf&id=standard)。
