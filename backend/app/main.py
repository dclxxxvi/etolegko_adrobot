import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import campaigns, misc, streams
from app.config import Settings
from app.db import create_engine, create_sessionmaker
from app.keitaro import KeitaroClient, KeitaroError, KeitaroNotFoundError, KeitaroUnavailableError

logger = logging.getLogger(__name__)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        engine = create_engine(settings.database_url)
        app.state.settings = settings
        app.state.engine = engine
        app.state.sessionmaker = create_sessionmaker(engine)
        app.state.kt = KeitaroClient(
            settings.keitaro_api_url,
            settings.keitaro_api_key,
            timeout=settings.keitaro_timeout,
            offers_cache_ttl=settings.keitaro_offers_cache_ttl,
        )
        yield
        await app.state.kt.aclose()
        await engine.dispose()

    app = FastAPI(title="Keitaro Wrapper", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(KeitaroError)
    async def keitaro_error_handler(_: Request, exc: KeitaroError) -> JSONResponse:
        logger.warning("Keitaro error: %s", exc.message)
        if isinstance(exc, KeitaroUnavailableError):
            return JSONResponse(status_code=503, content={"detail": exc.message})
        if isinstance(exc, KeitaroNotFoundError):
            detail = "Entity not found in Keitaro. Try fetching streams from KT."
            return JSONResponse(status_code=502, content={"detail": detail})
        return JSONResponse(status_code=502, content={"detail": f"Keitaro: {exc.message}"})

    for router in (misc.router, campaigns.router, streams.router):
        app.include_router(router, prefix="/api")
    return app


app = create_app()
