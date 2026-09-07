from __future__ import annotations


PUBLIC_DOWNLOAD_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/140.0.0.0 Safari/537.36 AKEDataTool/1.0"
)


def public_download_headers(accept: str) -> dict[str, str]:
    return {
        "Accept": accept,
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "Pragma": "no-cache",
        "User-Agent": PUBLIC_DOWNLOAD_USER_AGENT,
    }
