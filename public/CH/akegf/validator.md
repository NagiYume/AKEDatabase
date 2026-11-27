# AKEGF 工具认证

工具认证面向提供抽卡记录迁移功能的应用。应用须同时支持导入和导出所声明的版本（v1.1 或 v1.2），并在应用内附上 [AKEGF 首页](https://www.akedata.wiki/?plugin=akegf&id=home)链接。版本兼容、必填字段和分组合并规则见[标准化文档](/?plugin=akegf&id=standard)。

如果你的项目使用了 AKEGF 标准，欢迎通过 [Pull Request](https://github.com/NagiYume/AKEDatabase/pulls) 将你的项目添加到这里

## 导入后再导出的检查方法

[v1.1 未签名多角色示例](/plugin/data/akegf/example.json)和[v1.2 签名多角色示例](/plugin/data/akegf/example-signed.json)使用相同的角色和流水。签名版可用[示例专用公钥](/plugin/data/akegf/example-key.json)验证。

1. v1.1 导入方分别导入两份示例再导出。v1.2 导入方应拒绝未签名示例，并使用已登记的测试签名密钥完成签名档案的往返。用站内示例验证验签流程时，预期结果为「示例档案验签通过」。
2. 用本页表单检查导出的 JSON。格式通过表明档案符合声明版本的结构和唯一性规则。工具认证还需要对照导入前后的数据。
3. 按 `(region, server_id, uid)` 对照角色分组。示例中的国服角色应保留三条流水，国际服角色应保留一条。国服角色的干员抽取和武器申领具有相同的毫秒时间和流水号，但来源类别不同，导出后应仍有两条记录。
4. 逐条核对事件类型和来源已提供的卡池、获得物、星级、毫秒时间及流水号。示例中的赠送武器应保留为 `gift_weapon`，省略缺失的星级。长流水号 `90071992547409931` 应按字符串原样保留。

## 格式校验工具

正式 v1.2 档案通过公钥目录查询提供方 ID 和公钥指纹，并在浏览器本地验签。选择「检查导入版本」可检查档案是否满足该版本的导入要求。导入规则见[标准化文档](/?plugin=akegf&id=standard)。

粘贴完整的 JSON 后点击「校验 JSON」，或选择本机文件直接校验。内容仅在当前浏览器中处理。

工具按档案声明的 v1.1 或 v1.2 Schema 检查字段、类型和取值，再检查重复角色分组和分组内重复流水号。例如，错误路径 `/endfield/0/list/1` 指向第一个角色的第二条流水。

## 登记签名公钥

向 [AKEDatabase 提交 PR](https://github.com/NagiYume/AKEDatabase/pulls)。复制以下格式填写正文，并提供可公开下载的 PEM 和 JSON 文件。

~~~text
标题：[AKEGF] 登记 <export_provider> 签名公钥

项目名称：
项目主页或仓库 URL：
项目维护者 GitHub 账号或授权链接：
申请类型：首次登记 / 密钥轮换
提供方 ID（info.export_provider）：
新公钥指纹（kid）：
RSA 公钥 PEM（文件或公开下载链接）：
AKEGF 导入支持（无 / v1.1 / v1.2）：
轮换时填写旧 kid 和处理方式（保留 / 撤销）：
{
  "provider": "akegf-example",
  "kid": "GbXz6FFT7xjWXaCU2vG8cOMDAT9LoIM8LQjxWGlYh_o",
  "alg": "PS256",
  "status": "active",
  "public_key": "MIIBojANBgkqhkiG9w0BAQEFAAOCAY8AMIIBigKCAYEA1Hemjuapv-778_sw5x58z6L8Li4RCZcBsa69yoLWTjY9kTP0crBll9JWP4SwYaZveXOkzAvpbrYxRXyZYmzA2nBcgpooC71EdT3l5EWy3ZXzzaTccRDAp2Ta4Zju8k-mki-GjuEiRsLAQ3Kc5uUkWIm0a3K70OyO2cURjd2FDoQTNK12I0fs4V8ijmNdeqBwuPnFmJWOD4hy4_kgSsVVAzK_Abi33mCHlSHwASjGvkHvdx93NOZx92D9_IC98F72eu7fuYUHod7F9JcyHapMBeWwDZkHhmp3Sr-2X9dfnbpRCW1tddRwlk_QmhKN_KyH0Ge_8C3_r50xXvZiVKlil-lytkItOREsEXvDiNkSpR1DJChEgzki2_9bapxeGi3KSQB6h8pcSLQdmYNx6oBaJgrCpsZL7GLA6z12QBvuWS9LzfBYC_gPBRHESFsAlG_mJTfXNXVemHlELWljQQmPhDtec_0pIonSr5ayhJH5-tqu6CfFcGXu0AIyzHUdymhBAgMBAAE"
}
~~~

公钥使用 `BEGIN PUBLIC KEY` 格式，`kid` 按规范从公钥计算。签名示例使用公开的示例流水或自造数据，`info.export_provider` 和 `info.rsa_signature` 中的 `kid` 必须与申请一致。PR 只提交公钥和公开示例，私钥由提供方自行保管。轮换时先登记新公钥，再切换签名密钥。维护者核对申请方身份、支持范围和示例签名后，将公钥登记到 [AKEGF 公钥目录](https://verify.akedata.wiki/)。签名规则见[标准化文档](/?plugin=akegf&id=standard)。
