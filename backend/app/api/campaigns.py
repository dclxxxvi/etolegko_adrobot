from typing import Annotated

from fastapi import APIRouter, Query, Response, status

from app.api.deps import CampaignDep, KeitaroDep, SessionDep, SettingsDep
from app.models import Campaign
from app.schemas import CampaignCreate, CampaignList, CampaignOut, CampaignStats, CampaignUpdate
from app.services import campaigns as service
from app.services.stats import campaign_stats

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


def to_out(campaign: Campaign) -> CampaignOut:
    out = CampaignOut.model_validate(campaign)
    for stream in campaign.streams:
        for offer in stream.offers:
            if offer.offer_id == campaign.offer_id and offer.offer_name:
                out.offer_name = offer.offer_name
    return out


@router.get("")
async def list_campaigns(
    session: SessionDep,
    q: Annotated[str | None, Query(max_length=255)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> CampaignList:
    items, total = await service.list_campaigns(session, q, limit, offset)
    return CampaignList(items=[to_out(c) for c in items], total=total)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_campaign(
    data: CampaignCreate, session: SessionDep, kt: KeitaroDep, settings: SettingsDep
) -> CampaignOut:
    return to_out(await service.create_campaign(session, kt, settings, data))


@router.get("/{campaign_id}")
async def get_campaign(campaign: CampaignDep) -> CampaignOut:
    return to_out(campaign)


@router.patch("/{campaign_id}")
async def update_campaign(
    data: CampaignUpdate, campaign: CampaignDep, session: SessionDep, kt: KeitaroDep
) -> CampaignOut:
    return to_out(await service.update_campaign(session, kt, campaign, data))


@router.delete("/{campaign_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_campaign(campaign: CampaignDep, session: SessionDep, kt: KeitaroDep) -> Response:
    await service.delete_campaign(session, kt, campaign)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{campaign_id}/stats")
async def get_stats(
    campaign: CampaignDep, kt: KeitaroDep, days: Annotated[int, Query(ge=1, le=90)] = 7
) -> CampaignStats:
    return await campaign_stats(kt, campaign, days)
