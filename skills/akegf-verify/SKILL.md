---
name: akegf-verify
description: 维护 AKEGF RSA 公钥目录的登记、撤销、HTTPS 查询和证书续期。
---

# AKEGF 公钥目录

协议见[站内模块](../modules/akegf/SKILL.md)，部署与登记命令见[运维说明](../../tools/akegf-verify/OPERATIONS.md)。[registry.py](../../tools/akegf-verify/registry.py) 写入独立生产目录 /var/lib/akegf-verify。nginx 仅公开约定路径，前端和第三方按提供方 ID 与 SHA-256 SPKI 指纹请求公钥，在客户端使用 PS256 验签。

登记前核对来方项目身份、导入导出能力及公开样例签名。密钥轮换通过新指纹并行登记；需要撤销时保留 revoked 记录。生产目录内的公钥及撤销状态属于持久数据，备份及恢复时一并保留。TLS 证书单独使用 ACME 签发及定时续期。

公开首页和 `/v1/providers.json` 由 registry.py 从单键记录同步生成。登记、撤销或运行 `rebuild` 后更新。首页模板和样式位于 `tools/akegf-verify/web`，JSON 列表同时供合作页使用。

[管理后端](../../tools/akegf-verify/admin.py) 监听 `127.0.0.1:8768`，通过 systemd credential 使用 AKE Server Tool 的 `status-token`。nginx 提供 `https://verify.akedata.wiki/admin` 管理页面和同源 `/admin/v1/` API，页面源码位于 `tools/akegf-verify/web/admin.*`。API 和 registry.py 的 CLI 共用公钥登记、撤销和文件锁。私钥文件单独放在 `/var/lib/akegf-verify-private`，删除私钥和撤销公钥分别处理。管理 API 仅返回密钥元数据。部署与口令轮换见运维说明。

正式 v1.2 档案通过公钥目录取得有效公钥。导入后的信任与使用规则见[标准文档](../../public/CH/akegf/standard.md)。

`akegf-example` 为示例保留。站内工具使用随示例发布的[专用公钥](../../plugin/data/akegf/example-key.json)。更新样例时另行签发一次性示例密钥，导入工具仅将该提供方用于测试。
