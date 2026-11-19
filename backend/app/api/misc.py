from fastapi import APIRouter

from app.api.deps import KeitaroDep, SettingsDep
from app.schemas import MetaOut, OfferOut

router = APIRouter(tags=["misc"])


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/meta")
async def meta(settings: SettingsDep) -> MetaOut:
    return MetaOut(keitaro_url=settings.keitaro_url.rstrip("/"))


@router.get("/offers")
async def offers(kt: KeitaroDep) -> list[OfferOut]:
    return [OfferOut(id=int(o["id"]), name=str(o["name"])) for o in await kt.list_offers()]
