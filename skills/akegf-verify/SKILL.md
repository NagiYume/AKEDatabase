---
name: akegf-verify
description: 维护 AKEGF RSA 公钥目录的登记、撤销、HTTPS 查询和证书续期。
---

# AKEGF 公钥目录

协议见[站内模块](../modules/akegf/SKILL.md)，部署与登记命令见[运维说明](../../tools/akegf-verify/OPERATIONS.md)。[registry.py](../../tools/akegf-verify/registry.py) 写入独立生产目录 /var/lib/akegf-verify。nginx 仅公开约定路径，前端和第三方按提供方 ID 与 SHA-256 SPKI 指纹请求公钥，在客户端使用 PS256 验签。

登记前核对来方项目身份、导入导出能力及公开样例签名。密钥轮换通过新指纹并行登记；需要撤销时保留 revoked 记录。生产目录内的公钥及撤销状态属于持久数据，备份及恢复时一并保留。TLS 证书单独使用 ACME 签发及定时续期。

公开首页和 `/v1/providers.json` 由 registry.py 从单键记录同步生成。登记、撤销或运行 `rebuild` 后更新。首页模板和样式位于 `tools/akegf-verify/web`，JSON 列表同时供合作页使用。

Starward 当前仅导出未签名档案。历史 `starward-ake` 签名档案通过原目录查询公钥。导入后的信任与使用规则见 v0.4 标准。

`akegf-example` 为示例保留。使用 [示例公钥](../../tools/akegf-verify/keys/akegf-example.pem) 恢复已发布样例对应条目。更新样例时另行签发示例密钥，导入工具仅将该提供方用于测试。
