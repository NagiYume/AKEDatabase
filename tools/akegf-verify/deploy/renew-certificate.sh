#!/bin/sh
set -eu
umask 077

domain=verify.akedata.wiki
work=/etc/akegf-verify/acme
certificate="$work/certs/${domain}_ecc/fullchain.cer"
pending="$work/reload-required"
install -d -m 0700 "$work" "$work/config" "$work/certs"
exec 9>/run/ake-domain-certificate.lock
flock -w 150 9

if ! openssl x509 -checkend 1728000 -noout -in "$certificate" >/dev/null 2>&1; then
    touch "$pending"
    sh /opt/ake-tablecfg/runtime/acme/acme.sh \
        --home "$work" --config-home "$work/config" --cert-home "$work/certs" \
        --issue --force --server letsencrypt --keylength ec-256 -d "$domain" \
        --webroot /var/lib/ake-acme-webroot
fi
openssl x509 -in "$certificate" -noout -checkhost "$domain"

if [ -f "$pending" ] && [ -f /etc/nginx/conf.d/akegf-verify-https.conf ]; then
    nginx -t
    systemctl reload nginx
    rm -f "$pending"
fi
