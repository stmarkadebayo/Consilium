from __future__ import annotations

import re
from html import unescape
from typing import Optional
from urllib.parse import parse_qs, quote_plus, urlparse, urlunparse

import httpx

from app.services.source_capture_service import SourceCaptureService


class SourceDiscoveryService:
    DISALLOWED_HOST_FRAGMENTS = {
        "brainyquote.com",
        "goodreads.com",
        "reddit.com",
        "quora.com",
        "4chan.org",
        "fandom.com",
        "pinterest.com",
        "facebook.com",
        "instagram.com",
        "tiktok.com",
        "x.com",
        "twitter.com",
        "tumblr.com",
        "substack.com",
        "medium.com",
        "tabloid",
    }
    HIGH_REPUTATION_HOSTS = {
        "britannica.com",
        "wikipedia.org",
        "nytimes.com",
        "wsj.com",
        "ft.com",
        "forbes.com",
        "bloomberg.com",
        "cnbc.com",
        "youtube.com",
        "youtu.be",
        "ted.com",
        "harvard.edu",
        "stanford.edu",
        "mit.edu",
        "nature.com",
        "science.org",
    }
    LOW_REPUTATION_HOSTS = {
        "wikihow.com",
        "yourstory.com",
        "brainyquote.com",
        "goodreads.com",
    }

    def discover_sources(
        self,
        *,
        person_name: str,
        custom_brief: Optional[str] = None,
        limit: int = 5,
    ) -> list[dict]:
        candidates: list[dict] = []
        seen_urls: set[str] = set()

        for query in self._build_queries(person_name, custom_brief):
            for result in self._search(query):
                classified = self._classify_result(person_name=person_name, query=query, result=result)
                if not classified:
                    continue
                normalized_url = self._normalize_url(classified["url"])
                if normalized_url in seen_urls:
                    continue

                captured = SourceCaptureService.capture(normalized_url)
                content = (captured.get("content") or "").strip()
                if len(content) < 120:
                    continue

                title = classified.get("title") or captured.get("title") or result.get("title") or normalized_url
                result_payload = {
                    "url": normalized_url,
                    "title": title[:255],
                    "source_type": classified["source_type"],
                    "publisher": classified["publisher"],
                    "quality_score": classified["quality_score"],
                    "is_primary": classified["is_primary"],
                    "content": content,
                }
                result_payload["quality_score"] = round(
                    self._rank_candidate(
                        person_name=person_name,
                        result=result_payload,
                        query=query,
                        content=content,
                    ),
                    4,
                )
                candidates.append(
                    result_payload
                )
                seen_urls.add(normalized_url)
        filtered = [candidate for candidate in candidates if candidate["quality_score"] >= 0.4]
        filtered.sort(key=lambda candidate: (candidate["quality_score"], candidate["is_primary"]), reverse=True)
        return self._diversify_results(filtered, limit)

    def _build_queries(self, person_name: str, custom_brief: Optional[str]) -> list[str]:
        normalized_name = " ".join(person_name.split())
        extra_terms = []
        if custom_brief:
            extra_terms = [term for term in re.findall(r"[A-Za-z]{4,}", custom_brief.lower())[:3]]

        base_queries = [
            f'"{normalized_name}" official website',
            f'"{normalized_name}" interview',
            f'"{normalized_name}" talk',
            f'"{normalized_name}" biography',
            f'"{normalized_name}" book',
            f'"{normalized_name}" wikipedia',
        ]
        if extra_terms:
            base_queries.insert(1, f'"{normalized_name}" {" ".join(extra_terms)} interview')
        return base_queries

    def _search(self, query: str) -> list[dict]:
        response = httpx.get(
            f"https://duckduckgo.com/html/?q={quote_plus(query)}",
            timeout=20.0,
            follow_redirects=True,
            headers={"User-Agent": "ConsiliumBot/1.0 (+https://consilium.local)"},
        )
        response.raise_for_status()
        return self._parse_duckduckgo_results(response.text)

    def _parse_duckduckgo_results(self, html: str) -> list[dict]:
        matches = re.findall(
            r'<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>(.*?)</a>',
            html,
            flags=re.IGNORECASE | re.DOTALL,
        )
        results = []
        for href, title_html in matches:
            url = self._resolve_duckduckgo_href(unescape(href))
            title = re.sub(r"<[^>]+>", "", unescape(title_html)).strip()
            if not url:
                continue
            results.append({"url": url, "title": title})
        return results

    def _resolve_duckduckgo_href(self, href: str) -> Optional[str]:
        if href.startswith("http://") or href.startswith("https://"):
            return href
        parsed = urlparse(href)
        query = parse_qs(parsed.query)
        uddg = query.get("uddg", [None])[0]
        return unescape(uddg) if uddg else None

    def _classify_result(self, *, person_name: str, query: str, result: dict) -> Optional[dict]:
        url = result["url"]
        parsed = urlparse(url)
        host = parsed.netloc.lower().removeprefix("www.")
        if not host or any(fragment in host for fragment in self.DISALLOWED_HOST_FRAGMENTS):
            return None

        title = (result.get("title") or "").lower()
        query_lower = query.lower()
        source_type = "reference"
        quality_score = 0.7
        is_primary = False

        if "wikipedia.org" in host:
            source_type = "reference"
            quality_score = 0.6
            is_primary = False
        elif ("youtube.com" in host or "youtu.be" in host) and self._looks_person_specific(person_name, title):
            source_type = "talk"
            quality_score = 0.76
            is_primary = True
        elif "interview" in query_lower or "podcast" in host or "podcast" in title:
            source_type = "interview"
            quality_score = 0.8
            is_primary = True
        elif "talk" in query_lower or "conference" in title or "talk" in title:
            source_type = "talk"
            quality_score = 0.78
            is_primary = True
        elif "book" in query_lower or "books.google" in host:
            source_type = "book"
            quality_score = 0.88
            is_primary = True
        elif "biography" in query_lower or "britannica.com" in host:
            source_type = "biography"
            quality_score = 0.74
        elif "official website" in query_lower or self._looks_official(person_name, host, title):
            source_type = "official_website"
            quality_score = 0.9
            is_primary = True

        if quality_score < 0.4:
            return None
        return {
            "url": url,
            "title": result.get("title"),
            "source_type": source_type,
            "publisher": host,
            "quality_score": quality_score,
            "is_primary": is_primary,
        }

    def _rank_candidate(self, *, person_name: str, result: dict, query: str, content: str) -> float:
        source_type = result["source_type"]
        base_score = {
            "official_website": 0.9,
            "book": 0.9,
            "interview": 0.82,
            "talk": 0.79,
            "biography": 0.74,
            "reference": 0.68,
            "other": 0.55,
        }.get(source_type, 0.55)

        publisher = (result.get("publisher") or "").lower()
        publisher_score = 0.55
        if any(host in publisher for host in self.HIGH_REPUTATION_HOSTS):
            publisher_score = 0.9
        elif any(host in publisher for host in self.LOW_REPUTATION_HOSTS):
            publisher_score = 0.4

        title = (result.get("title") or "").lower()
        person_match = 0.9 if self._looks_person_specific(person_name, title) else 0.55
        primary_score = 1.0 if result.get("is_primary") else 0.45
        content_score = 0.85 if len(content) > 1500 else 0.6 if len(content) > 400 else 0.35

        combined = (
            base_score * 0.3
            + person_match * 0.25
            + publisher_score * 0.2
            + primary_score * 0.15
            + content_score * 0.1
        )
        if "wikipedia.org" in publisher:
            combined = min(combined, 0.7)
        return max(0.0, min(1.0, combined))

    def _diversify_results(self, results: list[dict], limit: int) -> list[dict]:
        selected: list[dict] = []
        seen_publishers: set[str] = set()
        for result in results:
            publisher = result.get("publisher") or ""
            if publisher not in seen_publishers or len(selected) < 2:
                selected.append(result)
                seen_publishers.add(publisher)
            if len(selected) >= limit:
                break
        if len(selected) < limit:
            for result in results:
                if result in selected:
                    continue
                selected.append(result)
                if len(selected) >= limit:
                    break
        return selected

    @staticmethod
    def _normalize_url(url: str) -> str:
        parsed = urlparse(url)
        normalized = parsed._replace(query="", fragment="")
        return urlunparse(normalized)

    @staticmethod
    def _looks_official(person_name: str, host: str, title: str) -> bool:
        tokens = [token for token in re.findall(r"[a-z0-9]+", person_name.lower()) if len(token) > 2]
        return any(token in host or token in title for token in tokens)

    @staticmethod
    def _looks_person_specific(person_name: str, text: str) -> bool:
        tokens = [token for token in re.findall(r"[a-z0-9]+", person_name.lower()) if len(token) > 2]
        text_lower = text.lower()
        return sum(1 for token in tokens if token in text_lower) >= max(1, min(2, len(tokens)))
