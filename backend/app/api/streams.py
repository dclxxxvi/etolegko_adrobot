from fastapi import APIRouter, HTTPException

from app.api.deps import CampaignDep, KeitaroDep, SessionDep
from app.schemas import PushOffersIn, StreamOut
from app.services.campaigns import reload_campaign
from app.services.streams import push_stream_offers, sync_streams

router = APIRouter(prefix="/campaigns/{campaign_id}/streams", tags=["streams"])


@router.get("")
async def list_streams(campaign: CampaignDep) -> list[StreamOut]:
    return [StreamOut.model_validate(s) for s in campaign.streams]


@router.post("/sync")
async def sync(campaign: CampaignDep, session: SessionDep, kt: KeitaroDep) -> list[StreamOut]:
    await sync_streams(session, kt, campaign)
    campaign = await reload_campaign(session, campaign.id)
    return [StreamOut.model_validate(s) for s in campaign.streams]


@router.put("/{stream_id}/offers")
async def push_offers(
    stream_id: int, data: PushOffersIn, campaign: CampaignDep, session: SessionDep, kt: KeitaroDep
) -> StreamOut:
    stream = next((s for s in campaign.streams if s.id == stream_id), None)
    if stream is None:
        raise HTTPException(status_code=404, detail="Stream not found")
    if stream.schema != "landings":
        raise HTTPException(status_code=400, detail="This stream does not distribute offers")
    await push_stream_offers(session, kt, stream, data.offers)
    campaign = await reload_campaign(session, campaign.id)
    stream = next(s for s in campaign.streams if s.id == stream_id)
    return StreamOut.model_validate(stream)
