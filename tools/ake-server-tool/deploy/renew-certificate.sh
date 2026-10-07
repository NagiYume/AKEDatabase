#!/bin/sh
set -eu
certificate=/etc/ake-tablecfg/tls/fullchain.pem
# Keep the current service running unless renewal is actually due.
if openssl x509 -checkend 2592000 -noout -in "$certificate" >/dev/null 2>&1; then
    exit 0
fi
was_running=0
if systemctl is-active --quiet ake-tablecfg.service; then
    was_running=1
    systemctl stop ake-tablecfg.service
fi
restore_service() {
    if [ "$was_running" = 1 ]; then
        systemctl start ake-tablecfg.service
    fi
}
trap restore_service EXIT
trap 'exit 1' HUP INT TERM
sh /opt/ake-tablecfg/runtime/acme/acme.sh \
    --home /opt/ake-tablecfg/runtime/acme \
    --config-home /etc/ake-tablecfg/acme \
    --cert-home /etc/ake-tablecfg/certs \
    --renew --force --server letsencrypt --ecc \
    -d server-status.akedata.wiki
source=/etc/ake-tablecfg/certs/server-status.akedata.wiki_ecc
install -o root -g ake-tablecfg -m 640 "$source/fullchain.cer" "$certificate"
install -o root -g ake-tablecfg -m 640 "$source/server-status.akedata.wiki.key" /etc/ake-tablecfg/tls/private.key
