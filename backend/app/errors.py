from __future__ import annotations

from typing import Any


class AppError(Exception):
    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        *,
        extra: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.extra = extra


def bad_request(code: str, message: str, *, extra: dict[str, Any] | None = None) -> AppError:
    return AppError(400, code, message, extra=extra)


def not_found(code: str, message: str, *, extra: dict[str, Any] | None = None) -> AppError:
    return AppError(404, code, message, extra=extra)
