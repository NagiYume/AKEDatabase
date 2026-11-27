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

## 管理接口

在 [AKEGF 密钥管理](https://verify.akedata.wiki/admin) 输入 AKE Server Tool 的访问口令，即可查看密钥列表、添加公私钥、撤销公钥和删除私钥。页面口令只保留在当前页面内存中。nginx 将 HTTPS 管理请求转发至 `127.0.0.1:8768`，对管理 API 限流。各 API 请求使用 `Authorization: Bearer <token>`。systemd 从 AKE Server Tool 的 `/etc/ake-tablecfg/status-token` 加载同一份口令。若 AKE Server Tool 使用自定义 `status_token_file`，同步修改 unit 的 `LoadCredential` 源路径。轮换口令后重启两项使用口令的服务。

| 方法与路径 | 操作 |
| --- | --- |
| `GET /admin/v1/keys` | 列出公钥和私钥的提供方、指纹和算法，以及公钥状态。 |
| `POST /admin/v1/providers/{provider}/public-keys` | 请求正文发送 `BEGIN PUBLIC KEY` PEM。返回 `kid` 并更新公开目录。 |
| `DELETE /admin/v1/providers/{provider}/public-keys/{kid}` | 撤销公钥。公开接口保留 `revoked` 状态，已撤销的指纹无法重新登记。 |
| `POST /admin/v1/providers/{provider}/private-keys` | 请求正文发送未加密的 RSA PKCS#8 或 PKCS#1 PEM。服务检查密钥并从对应公钥计算 `kid`。 |
| `DELETE /admin/v1/providers/{provider}/private-keys/{kid}` | 删除服务端私钥文件。需要停止对相应档案的信任时，另行撤销对应公钥。 |

上传使用 `Content-Type: application/x-pem-file`，正文上限 16 KiB。密钥须为 2048、3072 或 4096 位通用 RSA。成功响应为 JSON。未认证返回 401，错误的 PEM 返回 400，重复登记已撤销的公钥返回 409。添加同一把有效公钥或私钥，以及再次删除私钥均可安全重试。

服务端自有私钥保存在 `/var/lib/akegf-verify-private/{provider}/{kid}.pem`，目录权限为 0700，文件权限为 0600。API 只返回元数据。第三方提交登记 PR 时仅提供公钥和公开的签名示例。服务器私钥备份应使用限制访问的独立存储，文件删除也需在备份中按实际保留要求处理。

从 Bash 调用 HTTPS 管理接口时，替换下列示例中的提供方、密钥路径和指纹。

~~~sh
IFS= read -rs -p 'AKE Server Tool token: ' AKEGF_ADMIN_TOKEN
printf '\n'
akegf_admin() {
    printf 'Authorization: Bearer %s\n' "$AKEGF_ADMIN_TOKEN" |
        curl --fail-with-body --silent --show-error --header @- "$@"
}
api=https://verify.akedata.wiki/admin/v1
provider=provider-id

akegf_admin "$api/keys"
akegf_admin -H 'Content-Type: application/x-pem-file' \
    --data-binary @project-public.pem "$api/providers/$provider/public-keys"
akegf_admin -H 'Content-Type: application/x-pem-file' \
    --data-binary @server-private.pem "$api/providers/$provider/private-keys"
~~~

撤销公钥或删除私钥时，按需执行对应的 DELETE。操作完成后清除当前终端中的口令变量。

~~~sh
public_kid=PUBLIC_KEY_FINGERPRINT
private_kid=PRIVATE_KEY_FINGERPRINT
akegf_admin -X DELETE "$api/providers/$provider/public-keys/$public_kid"
akegf_admin -X DELETE "$api/providers/$provider/private-keys/$private_kid"
unset AKEGF_ADMIN_TOKEN
~~~

## 示例专用公钥

`akegf-example` 用于[签名多角色示例](../../plugin/data/akegf/example-signed.json)。[未签名示例](../../plugin/data/akegf/example.json)与签名版的角色和流水一致。生成示例时使用一次性私钥，站内校验器使用随示例发布的[专用公钥](../../plugin/data/akegf/example-key.json)验证。

示例专用提供方的档案只用于测试，导入工具应禁止写入正式历史、同步或参与排行。

## 部署与续期

首次安装时由 root 初始化公开目录。nginx 对 `/var/lib/akegf-verify` 只读。服务依赖 nginx，登记命令使用 Python 3.11 和 OpenSSL。现有上海服务器提供 ACME 客户端 `/opt/ake-tablecfg/runtime/acme/acme.sh` 和 webroot `/var/lib/ake-acme-webroot`。

1. 确认域名指向该主机，公网可访问 80 和 443。建立 `/opt/akegf-verify`、`/etc/akegf-verify` 和 `/var/lib/akegf-verify`，权限 0755。将 `registry.py`、`deploy/renew-certificate.sh` 和 `web/` 安装至 `/opt/akegf-verify`。执行 `python3 /opt/akegf-verify/registry.py rebuild` 生成公开首页及列表。
2. 安装 `deploy/verify-http.conf` 至 `/etc/nginx/conf.d/akegf-verify-http.conf`，执行 `nginx -t` 和 `systemctl reload nginx`。运行 `/bin/sh /opt/akegf-verify/renew-certificate.sh`，用 HTTP-01 签发本域名证书。
3. 安装 `deploy/verify-https.conf` 至 `/etc/nginx/conf.d/akegf-verify-https.conf`，验证配置后重载 nginx。安装 `deploy/akegf-verify-certificate.*` 至 `/etc/systemd/system/`，执行 `systemctl daemon-reload` 和 `systemctl enable --now akegf-verify-certificate.timer`。
4. 从公网请求 `/healthz`、首页和目录 JSON。登记首把公钥后检查目录和单键记录，并用项目提供的公开样例完成端到端验签。

证书及 ACME 账户位于 `/etc/akegf-verify/acme`。定时器每日检查，进入到期前 20 天时签发新证书并重载 nginx。续期日志使用 `journalctl -u akegf-verify-certificate.service`。公钥条目通过文件锁与原子替换发布，登记和撤销即时生效，无需重载 nginx。

启用管理服务时，在仓库的 `tools/akegf-verify` 目录执行下列命令。已有 `akegf-admin` 系统账户时，跳过创建账户。nginx 仍通过原有公开目录读文件。

~~~sh
sudo useradd --system --user-group --no-create-home --shell /usr/sbin/nologin akegf-admin
sudo install -m 0644 admin.py registry.py /opt/akegf-verify/
sudo chown -R akegf-admin:akegf-admin /var/lib/akegf-verify
sudo install -m 0644 deploy/akegf-verify-admin.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now akegf-verify-admin.service
~~~

systemd 负责创建私钥目录和读取共享口令。启用后需要使用 CLI 时，以相同的 `akegf-admin` 账户执行 `registry.py`，使 API 和 CLI 共用文件锁、目录权限与撤销状态。

更新 HTTPS 管理入口时，将 `web/admin.html`、`web/admin.css` 和 `web/admin.js` 安装到 `/opt/akegf-verify/web/`，并将 `deploy/verify-https.conf` 安装到 `/etc/nginx/conf.d/akegf-verify-https.conf`。通过 `nginx -t` 后重载 nginx。检查 `/admin` 返回页面，`/admin/v1/keys` 对缺少口令的请求返回 401，对正确口令返回列表，公开 `/v1/providers.json` 保持只读。
