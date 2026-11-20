"""Thin async client for the Keitaro Admin API v1."""

import time
from typing import Any

import httpx

JSON = dict[str, Any]


class KeitaroError(Exception):
    """Keitaro returned an error response."""

    def __init__(self, message: str, status_code: int | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class KeitaroNotFoundError(KeitaroError):
    pass


class KeitaroUnavailableError(KeitaroError):
    """Keitaro is unreachable (network error / timeout / 5xx)."""


def _error_message(response: httpx.Response) -> str:
    try:
        data = response.json()
    except ValueError:
        return f"Keitaro responded with HTTP {response.status_code}"
    if isinstance(data, dict):
        error = data.get("error")
        if isinstance(error, str):
            return error
        # validation errors: {"field": ["message", ...]}
        parts = []
        for field, value in data.items():
            msgs = value if isinstance(value, list) else [value]
            parts.append(f"{field}: {', '.join(str(m) for m in msgs)}")
        if parts:
            return "; ".join(parts)
    return f"Keitaro responded with HTTP {response.status_code}"


class KeitaroClient:
    def __init__(
        self,
        base_url: str,
        api_key: str,
        timeout: float = 15.0,
        offers_cache_ttl: float = 60.0,
    ) -> None:
        self._http = httpx.AsyncClient(
            base_url=base_url.rstrip("/"),
            headers={"Api-Key": api_key, "Accept": "application/json"},
            timeout=timeout,
        )
        self._offers_cache: tuple[float, list[JSON]] | None = None
        self._offers_cache_ttl = offers_cache_ttl

    async def aclose(self) -> None:
        await self._http.aclose()

    async def _request(self, method: str, path: str, json: Any = None) -> Any:
        try:
            response = await self._http.request(method, path, json=json)
        except httpx.TimeoutException as exc:
            raise KeitaroUnavailableError("Keitaro request timed out") from exc
        except httpx.HTTPError as exc:
            raise KeitaroUnavailableError(f"Keitaro is unavailable: {exc}") from exc

        if response.status_code == 404:
            raise KeitaroNotFoundError("Not found in Keitaro", 404)
        if response.status_code >= 500:
            raise KeitaroUnavailableError(_error_message(response), response.status_code)
        if response.status_code >= 400:
            raise KeitaroError(_error_message(response), response.status_code)
        try:
            return response.json()
        except ValueError as exc:
            raise KeitaroError("Keitaro returned an invalid response") from exc

    # campaigns
    async def create_campaign(self, data: JSON) -> JSON:
        result: JSON = await self._request("POST", "/campaigns", data)
        return result

    async def update_campaign(self, campaign_id: int, data: JSON) -> JSON:
        result: JSON = await self._request("PUT", f"/campaigns/{campaign_id}", data)
        return result

    async def delete_campaign(self, campaign_id: int) -> None:
        await self._request("DELETE", f"/campaigns/{campaign_id}")

    # streams
    async def get_campaign_streams(self, campaign_id: int) -> list[JSON]:
        result: list[JSON] = await self._request("GET", f"/campaigns/{campaign_id}/streams")
        return result

    async def create_stream(self, data: JSON) -> JSON:
        result: JSON = await self._request("POST", "/streams", data)
        return result

    async def update_stream(self, stream_id: int, data: JSON) -> JSON:
        result: JSON = await self._request("PUT", f"/streams/{stream_id}", data)
        return result

    # offers
    async def list_offers(self) -> list[JSON]:
        now = time.monotonic()
        if self._offers_cache and now - self._offers_cache[0] < self._offers_cache_ttl:
            return self._offers_cache[1]
        offers: list[JSON] = await self._request("GET", "/offers")
        self._offers_cache = (now, offers)
        return offers

    async def offer_names(self) -> dict[int, str]:
        """Best-effort map offer_id -> name (empty if offers are not accessible)."""
        try:
            return {int(o["id"]): str(o["name"]) for o in await self.list_offers()}
        except KeitaroError:
            return {}

    # reports
    async def build_report(self, data: JSON) -> JSON:
        result: JSON = await self._request("POST", "/report/build", data)
        return result
