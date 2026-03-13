from __future__ import annotations

import json
import re
from html import unescape
from html.parser import HTMLParser

import httpx


class _TextExtractor(HTMLParser):
    SKIP_TAGS = {"script", "style", "noscript", "svg", "footer", "nav", "form"}

    def __init__(self) -> None:
        super().__init__()
        self.skip_depth = 0
        self.in_title = False
        self.title_parts: list[str] = []
        self.text_parts: list[str] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag in self.SKIP_TAGS:
            self.skip_depth += 1
            return
        if tag == "title":
            self.in_title = True

    def handle_endtag(self, tag: str) -> None:
        if tag in self.SKIP_TAGS and self.skip_depth > 0:
            self.skip_depth -= 1
            return
        if tag == "title":
            self.in_title = False

    def handle_data(self, data: str) -> None:
        if self.skip_depth > 0:
            return
        normalized = " ".join(data.split())
        if not normalized:
            return
        if self.in_title:
            self.title_parts.append(normalized)
        self.text_parts.append(normalized)


class SourceCaptureService:
    @staticmethod
    def capture(url: str) -> dict[str, str]:
        response = httpx.get(
            url,
            timeout=20.0,
            follow_redirects=True,
            headers={"User-Agent": "ConsiliumBot/1.0 (+https://consilium.local)"},
        )
        response.raise_for_status()

        content_type = response.headers.get("content-type", "")
        text = response.text
        if "html" in content_type.lower():
            json_ld_content = SourceCaptureService._extract_json_ld_content(text)
            extractor = _TextExtractor()
            extractor.feed(text)
            title = SourceCaptureService._extract_meta_title(text) or " ".join(extractor.title_parts).strip()
            body = SourceCaptureService._compact_text(
                " ".join(part for part in [json_ld_content, " ".join(extractor.text_parts)] if part)
            )
            return {"title": title, "content": body}

        return {"title": "", "content": SourceCaptureService._compact_text(text)}

    @staticmethod
    def _compact_text(value: str) -> str:
        compact = re.sub(r"\s+", " ", value).strip()
        return compact[:12000]

    @staticmethod
    def _extract_meta_title(html: str) -> str:
        patterns = [
            r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']+)["\']',
            r'<meta[^>]+name=["\']twitter:title["\'][^>]+content=["\']([^"\']+)["\']',
        ]
        for pattern in patterns:
            match = re.search(pattern, html, flags=re.IGNORECASE)
            if match:
                return unescape(match.group(1)).strip()
        return ""

    @staticmethod
    def _extract_json_ld_content(html: str) -> str:
        matches = re.findall(
            r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
            html,
            flags=re.IGNORECASE | re.DOTALL,
        )
        values: list[str] = []
        for raw_match in matches:
            candidate = raw_match.strip()
            if not candidate:
                continue
            try:
                payload = json.loads(candidate)
            except json.JSONDecodeError:
                continue
            for item in payload if isinstance(payload, list) else [payload]:
                if not isinstance(item, dict):
                    continue
                for key in ("articleBody", "description", "transcript", "text"):
                    value = item.get(key)
                    if isinstance(value, str) and len(value.strip()) > 80:
                        values.append(value.strip())
        return " ".join(values)
