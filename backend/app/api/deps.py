from typing import Annotated

from fastapi import Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.db import get_session
from app.keitaro import KeitaroClient
from app.models import Campaign

SessionDep = Annotated[AsyncSession, Depends(get_session)]


def get_kt(request: Request) -> KeitaroClient:
    client: KeitaroClient = request.app.state.kt
    return client


def get_settings(request: Request) -> Settings:
    settings: Settings = request.app.state.settings
    return settings


KeitaroDep = Annotated[KeitaroClient, Depends(get_kt)]
SettingsDep = Annotated[Settings, Depends(get_settings)]


async def get_campaign(campaign_id: int, session: SessionDep) -> Campaign:
    campaign = await session.get(Campaign, campaign_id)
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign


CampaignDep = Annotated[Campaign, Depends(get_campaign)]
