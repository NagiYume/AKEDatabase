# AKEGF 公钥目录

生产域名为 [verify.akedata.wiki](https://verify.akedata.wiki/)。nginx 通过 HTTPS 提供只读公钥查询。导出应用自行签名。导入工具查询提供方 ID 和公钥指纹后，在本地验证档案。签名格式见[标准化文档](../../public/CH/akegf/standard.md)。

## 查询接口

| 请求 | 响应 |
| --- | --- |
| `GET /` | 按提供方分组的公钥目录页面，展示有效公钥的 PEM、指纹和状态。 |
| `GET /v1/providers.json` | 目录 JSON，包含 `providers` 数组。每组包含 `provider` 与 `keys`，键条目格式同单键接口。 |
| `GET /healthz` | `200` 和 `{"status":"ok"}`。 |
| `GET /v1/providers/{provider}/keys/{kid}.json` | `200`，包含 `provider`、`kid`、`alg`、`status`。有效记录另带 `public_key`，使用无填充 Base64url 编码 DER SubjectPublicKeyInfo。撤销记录为 `status: "revoked"`。未登记返回 `404`。 |

同一路径支持 `HEAD`。响应带 `Access-Control-Allow-Origin: *` 和 `Cache-Control: no-store`。HTTP 请求跳转 HTTPS，ACME 验证路径除外。`alg` 固定为 `PS256`。

## 登记与撤销

登记时核对项目和申请方身份、提供方 ID 归属、支持的导入导出范围与样例签名。首次登记前，用申请方提供的 PEM 直接验签。下面的 `payload.bin` 是按规范构造的带前缀 JCS 字节，`signature.bin` 是签名字段第二段经 Base64url 解码后的原始字节。

```sh
openssl dgst -sha256 -verify project-public.pem -signature signature.bin \
    -sigopt rsa_padding_mode:pss -sigopt rsa_mgf1_md:sha256 \
    -sigopt rsa_pss_saltlen:32 payload.bin
```

通过后，由服务器管理员执行下面的命令。替换 `provider-id` 和 `key-fingerprint`。登记仅接受 PEM 格式的通用 RSA SubjectPublicKeyInfo 公钥。命令输出 `kid`，可用输出值拼接接口路径，核对返回值。

```sh
python3 /opt/akegf-verify/registry.py register provider-id /path/to/project-public.pem
python3 /opt/akegf-verify/registry.py revoke provider-id key-fingerprint
```

项目保管签名私钥。登记新指纹可轮换密钥，旧密钥保留有效时可继续核验历史档案。撤销后，使用该指纹的所有档案都无法通过核验，包括历史档案。撤销记录不可重新登记，应随公钥目录备份及恢复。登记和撤销会重新生成目录首页和列表 JSON，撤销条目仍显示指纹和状态。恢复备份或更换页面模板后，用 `python3 /opt/akegf-verify/registry.py rebuild` 从单键记录重新生成两份目录。

## Starward 历史签名

Starward 当前导出的档案为未签名 v0.4。导入历史签名档案时，通过 `starward-ake` 和签名中的 `kid` 查询对应公钥，按标准判定信任状态。

## 示例专用公钥

`akegf-example` 用于发布和验签[签名多角色示例](../../plugin/data/akegf/example-signed.json)。[未签名示例](../../plugin/data/akegf/example.json)与签名版的角色和流水一致。公钥源文件为 [akegf-example.pem](keys/akegf-example.pem)，可用 `python3 /opt/akegf-verify/registry.py register akegf-example /path/to/akegf-example.pem` 恢复目录条目。生成示例时使用一次性私钥。以后更新示例时，以新密钥签署并登记新公钥，为旧样例保留原公钥。

示例专用提供方的档案只用于测试，导入工具应禁止写入正式历史、同步或参与排行。

## 部署与续期

生产目录由 root 持有。nginx 对 `/var/lib/akegf-verify` 只读。服务依赖 nginx，登记命令使用 Python 3.11 和 OpenSSL。现有上海服务器提供 ACME 客户端 `/opt/ake-tablecfg/runtime/acme/acme.sh` 和 webroot `/var/lib/ake-acme-webroot`。

1. 确认域名指向该主机，公网可访问 80 和 443。建立 `/opt/akegf-verify`、`/etc/akegf-verify` 和 `/var/lib/akegf-verify`，权限 0755。将 `registry.py`、`deploy/renew-certificate.sh` 和 `web/` 安装至 `/opt/akegf-verify`。执行 `python3 /opt/akegf-verify/registry.py rebuild` 生成公开首页及列表。
2. 安装 `deploy/verify-http.conf` 至 `/etc/nginx/conf.d/akegf-verify-http.conf`，执行 `nginx -t` 和 `systemctl reload nginx`。运行 `/bin/sh /opt/akegf-verify/renew-certificate.sh`，用 HTTP-01 签发本域名证书。
3. 安装 `deploy/verify-https.conf` 至 `/etc/nginx/conf.d/akegf-verify-https.conf`，验证配置后重载 nginx。安装 `deploy/akegf-verify-certificate.*` 至 `/etc/systemd/system/`，执行 `systemctl daemon-reload` 和 `systemctl enable --now akegf-verify-certificate.timer`。
4. 从公网请求 `/healthz`、首页和目录 JSON。登记首把公钥后检查目录和单键记录，并用项目提供的公开样例完成端到端验签。

证书及 ACME 账户位于 `/etc/akegf-verify/acme`。定时器每日检查，进入到期前 20 天时签发新证书并重载 nginx。续期日志使用 `journalctl -u akegf-verify-certificate.service`。公钥条目通过文件锁与原子替换发布，登记和撤销即时生效，无需重载 nginx。
