"""Publish approved AKEGF RSA public keys to the read-only HTTPS registry."""

import argparse
import base64
import fcntl
import hashlib
import html
import json
import os
import re
import subprocess
import tempfile
from contextlib import contextmanager
from pathlib import Path
from string import Template
from textwrap import wrap


PROVIDER_ID = re.compile(r"[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?")
KEY_ID = re.compile(r"[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]")


def base64url(data):
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def read_public_key(path):
    return parse_public_key(path.read_bytes())


def parse_public_key(pem):
    if not re.fullmatch(
        rb"-----BEGIN PUBLIC KEY-----\r?\n(?:[A-Za-z0-9+/=]+\r?\n)+"
        rb"-----END PUBLIC KEY-----\r?\n?", pem
    ):
        raise ValueError("Expected one PEM SubjectPublicKeyInfo public key")

    def rsa(*args):
        result = subprocess.run(
            ["openssl", "rsa", "-pubin", *args],
            input=pem, capture_output=True, check=True, timeout=10,
        )
        return result.stdout

    modulus = int(rsa("-noout", "-modulus").decode("ascii").strip().removeprefix("Modulus="), 16)
    if modulus.bit_length() not in (2048, 3072, 4096):
        raise ValueError("RSA modulus must be 2048, 3072 or 4096 bits")
    der = rsa("-pubout", "-outform", "DER")
    # These key sizes use a four-byte outer SEQUENCE header. The next field
    # must be the rsaEncryption AlgorithmIdentifier with NULL parameters.
    if der[:2] != b"\x30\x82" or der[4:19] != bytes.fromhex("300d06092a864886f70d0101010500"):
        raise ValueError("Expected an unrestricted RSA public key (rsaEncryption)")
    return der


def write_file(path, content, mode=0o644):
    path.parent.mkdir(parents=True, exist_ok=True)
    output = tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent, delete=False)
    staged = Path(output.name)
    try:
        with output:
            output.write(content)
            os.fchmod(output.fileno(), mode)
            output.flush()
            os.fsync(output.fileno())
        staged.replace(path)
    finally:
        staged.unlink(missing_ok=True)


def publish(path, entry):
    write_file(path, json.dumps(entry, ensure_ascii=True, indent=2) + "\n")


def key_card(entry):
    provider = html.escape(entry["provider"])
    kid = html.escape(entry["kid"])
    active = entry["status"] == "active"
    status = "有效" if active else "已撤销"
    block = ""
    if active:
        encoded = entry["public_key"].replace("-", "+").replace("_", "/")
        encoded += "=" * (-len(encoded) % 4)
        pem = "\n".join(["-----BEGIN PUBLIC KEY-----", *wrap(encoded, 64), "-----END PUBLIC KEY-----"])
        block = f"<pre><code>{html.escape(pem)}</code></pre>"
    return (
        "<article class=\"key\">"
        f"<p><strong>{status}</strong> · {html.escape(entry['alg'])} · "
        f"<a href=\"/v1/providers/{provider}/keys/{kid}.json\">查看 JSON</a></p>"
        f"<p class=\"fingerprint\">指纹 <code>{kid}</code></p>{block}</article>"
    )


def key_entries(root):
    for path in sorted((root / "v1" / "providers").glob("*/keys/*.json")):
        provider = path.parent.parent.name
        entry = json.loads(path.read_text(encoding="utf-8"))
        if (not isinstance(entry, dict) or
                not PROVIDER_ID.fullmatch(provider) or not KEY_ID.fullmatch(path.stem) or
                entry.get("provider") != provider or entry.get("kid") != path.stem or
                entry.get("alg") != "PS256" or entry.get("status") not in ("active", "revoked") or
                (entry["status"] == "active" and not isinstance(entry.get("public_key"), str))):
            raise ValueError(f"Invalid registry entry: {path}")
        yield entry


def publish_directory(root):
    providers = {}
    for entry in key_entries(root):
        providers.setdefault(entry["provider"], []).append(entry)

    sections = [
        f"<section><h2>{html.escape(provider)}</h2>{''.join(map(key_card, keys))}</section>"
        for provider, keys in providers.items()
    ]
    template = Path(__file__).with_name("web") / "directory.html"
    page = Template(template.read_text(encoding="utf-8")).substitute(
        providers="\n".join(sections) or "<p>暂无已登记的提供方。</p>"
    )
    publish(root / "v1" / "providers.json", {
        "providers": [{"provider": provider, "keys": keys} for provider, keys in providers.items()],
    })
    write_file(root / "index.html", page)


@contextmanager
def registry_lock(root):
    descriptor = os.open(root / ".registry.lock", os.O_CREAT | os.O_WRONLY, 0o600)
    with os.fdopen(descriptor, "a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        yield


def fingerprint(der):
    return base64url(hashlib.sha256(der).digest())


class KeyConflict(ValueError):
    pass


def public_key_path(root, provider, kid):
    if not PROVIDER_ID.fullmatch(provider) or not KEY_ID.fullmatch(kid):
        raise ValueError("Invalid provider ID or public key fingerprint")
    return root / "v1" / "providers" / provider / "keys" / f"{kid}.json"


def register_key(root, provider, der):
    kid = fingerprint(der)
    path = public_key_path(root, provider, kid)
    entry = {
        "provider": provider, "kid": kid, "alg": "PS256",
        "status": "active", "public_key": base64url(der),
    }
    with registry_lock(root):
        if path.exists():
            if json.loads(path.read_text(encoding="utf-8")) != entry:
                raise KeyConflict("Existing entry differs or has been revoked")
        else:
            publish(path, entry)
        publish_directory(root)
    return entry


def revoke_key(root, provider, kid):
    path = public_key_path(root, provider, kid)
    with registry_lock(root):
        if not path.is_file():
            return False
        entry = json.loads(path.read_text(encoding="utf-8"))
        if entry["status"] != "revoked":
            publish(path, {
                "provider": provider, "kid": kid, "alg": "PS256", "status": "revoked",
            })
        publish_directory(root)
    return True


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path("/var/lib/akegf-verify"))
    commands = parser.add_subparsers(dest="action", required=True)
    register = commands.add_parser("register", help="Publish a previously approved public key")
    register.add_argument("provider")
    register.add_argument("pem", type=Path)
    revoke = commands.add_parser("revoke", help="Permanently revoke a published key")
    revoke.add_argument("provider")
    revoke.add_argument("kid")
    commands.add_parser("rebuild", help="Regenerate the public directory from existing key records")
    args = parser.parse_args()

    try:
        os.umask(0o022)
        if args.action == "register":
            print(register_key(args.root, args.provider, read_public_key(args.pem))["kid"])
        elif args.action == "revoke":
            if not revoke_key(args.root, args.provider, args.kid):
                raise ValueError("Unknown public key")
            print(args.kid)
        else:
            with registry_lock(args.root):
                publish_directory(args.root)
    except (OSError, ValueError, subprocess.SubprocessError) as error:
        parser.exit(1, f"{error}\n")


if __name__ == "__main__":
    main()
