from collections.abc import AsyncIterator, Iterator
from typing import Any

import httpx
import pytest
import respx
from fastapi import FastAPI

from app.config import Settings
from app.db import Base
from app.main import create_app

KT_API = "https://kt.test/admin_api/v1"


@pytest.fixture
def settings() -> Settings:
    return Settings(
        _env_file=None,
        keitaro_url="https://kt.test/admin",
        keitaro_api_key="test-key",
        database_url="sqlite+aiosqlite://",
        keitaro_offers_cache_ttl=0,
    )


@pytest.fixture
def kt() -> Iterator[respx.MockRouter]:
    with respx.mock(base_url=KT_API, assert_all_called=False) as router:
        router.get("/offers").respond(
            json=[{"id": 1, "name": "Offer One"}, {"id": 2, "name": "Offer Two"}]
        )
        yield router


@pytest.fixture
async def app(settings: Settings, kt: respx.MockRouter) -> AsyncIterator[FastAPI]:
    application = create_app(settings)
    async with application.router.lifespan_context(application):
        async with application.state.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        yield application


@pytest.fixture
async def client(app: FastAPI) -> AsyncIterator[httpx.AsyncClient]:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


def kt_stream(
    stream_id: int,
    position: int,
    schema: str,
    offers: list[tuple[int, int]] | None = None,
    countries: list[str] | None = None,
    campaign_id: int = 100,
) -> dict[str, Any]:
    """Build a Keitaro stream payload; offers are (offer_id, share) pairs."""
    return {
        "id": stream_id,
        "campaign_id": campaign_id,
        "name": "Geo -> Google" if schema == "redirect" else "Offers",
        "position": position,
        "schema": schema,
        "action_payload": "https://google.com" if schema == "redirect" else "",
        "filters": (
            [{"name": "country", "mode": "accept", "payload": countries}] if countries else []
        ),
        "offers": [
            {"offer_id": oid, "share": share, "state": "active"} for oid, share in (offers or [])
        ],
    }
