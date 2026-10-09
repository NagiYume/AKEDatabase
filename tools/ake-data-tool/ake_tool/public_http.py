from __future__ import annotations

import time
from http.client import HTTPException
from typing import Callable
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

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


def read_public_bytes(
    url: str,
    timeout: int,
    *,
    retries: int = 3,
    opener: Callable[..., object] = urlopen,
    before_attempt: Callable[[], None] | None = None,
    on_retry: Callable[[int, float, Exception], None] | None = None,
) -> bytes:
    """Read a complete response; discard interrupted bodies before retrying.

    Each attempt requests the entire object, so revisions cannot be mixed by
    appending bytes from a later response to an earlier partial response.
    """
    if type(retries) is not int or retries < 1:
        raise ValueError("retries 必须为正整数")
    for attempt in range(retries):
        if before_attempt is not None:
            before_attempt()
        request = Request(url, headers={**public_download_headers("application/json"),
                                        "Accept-Encoding": "identity"})
        try:
            with opener(request, timeout=timeout) as response:
                status = int(getattr(response, "status", 200))
                if status != 200:
                    raise HTTPError(url, status, "需要完整 HTTP 200 响应", None, None)
                length = response.headers.get("Content-Length")
                if length is not None and not str(length).isdigit():
                    raise OSError("远端响应 Content-Length 无效")
                expected = int(length) if length is not None else None
                body = bytearray()
                while True:
                    if before_attempt is not None:
                        before_attempt()
                    chunk = response.read(128 * 1024)
                    if not chunk:
                        break
                    body.extend(chunk)
                if expected is not None and len(body) != expected:
                    raise OSError(f"远端响应不完整：收到 {len(body)} 字节，预期 {expected} 字节")
                return bytes(body)
        except HTTPError as exc:
            if exc.code not in {408, 429} and not 500 <= exc.code <= 599:
                raise
            failure = exc
        except (HTTPException, URLError, TimeoutError, OSError) as exc:
            failure = exc
        if attempt + 1 == retries:
            raise failure
        delay = min(2 ** attempt, 5)
        if on_retry is not None:
            on_retry(attempt + 1, delay, failure)
        time.sleep(delay)
    raise RuntimeError("No download attempt made")
