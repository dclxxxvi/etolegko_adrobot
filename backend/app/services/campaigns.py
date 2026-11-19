"""Campaign CRUD: keeps the local DB and Keitaro in sync."""

import contextlib
import logging
import secrets

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import Settings
from app.keitaro import KeitaroClient, KeitaroError, KeitaroNotFoundError
from app.models import Campaign, Stream
from app.schemas import CampaignCreate, CampaignUpdate, StreamOfferIn
from app.services.streams import (
    distribute_shares,
    geo_filter_update,
    geo_stream_payload,
    merge_streams,
    offers_stream_payload,
    push_stream_offers,
    sync_streams,
)

logger = logging.getLogger(__name__)


async def list_campaigns(
    session: AsyncSession, q: str | None, limit: int, offset: int
) -> tuple[list[Campaign], int]:
    stmt = select(Campaign)
    if q:
        stmt = stmt.where(Campaign.name.icontains(q.strip(), autoescape=True))
    total = await session.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = await session.scalars(
        stmt.order_by(Campaign.created_at.desc(), Campaign.id.desc()).limit(limit).offset(offset)
    )
    return list(rows), total or 0


async def create_campaign(
    session: AsyncSession, kt: KeitaroClient, settings: Settings, data: CampaignCreate
) -> Campaign:
    alias = secrets.token_hex(5)
    kt_campaign = await kt.create_campaign(
        {
            "name": data.name,
            "alias": alias,
            "type": "position",
            "state": "active",
            "group_id": settings.keitaro_group_id,
            "domain_id": settings.keitaro_domain_id,
            "traffic_source_id": settings.keitaro_traffic_source_id,
            "cost_type": "CPC",
            "cost_value": 0,
        }
    )
    kt_campaign_id = int(kt_campaign["id"])
    try:
        geo = await kt.create_stream(geo_stream_payload(kt_campaign_id, data.country_code))
        offers = await kt.create_stream(offers_stream_payload(kt_campaign_id, data.offer_id))

        campaign = Campaign(
            name=data.name,
            country_code=data.country_code,
            offer_id=data.offer_id,
            kt_campaign_id=kt_campaign_id,
            kt_alias=str(kt_campaign.get("alias") or alias),
            streams=[],
        )
        merge_streams(campaign, [geo, offers], await kt.offer_names())
        session.add(campaign)
        await session.commit()
    except Exception:
        # compensation: do not leave a half-created campaign in Keitaro
        await session.rollback()
        with contextlib.suppress(KeitaroError):
            await kt.delete_campaign(kt_campaign_id)
        raise
    return await reload_campaign(session, campaign.id)


async def reload_campaign(session: AsyncSession, campaign_id: int) -> Campaign:
    """Load a campaign with streams and offers, overwriting stale in-session state."""
    stmt = (
        select(Campaign)
        .where(Campaign.id == campaign_id)
        .options(selectinload(Campaign.streams).selectinload(Stream.offers))
        .execution_options(populate_existing=True)
    )
    return (await session.scalars(stmt)).one()


def _find_stream(campaign: Campaign, schema: str) -> Stream | None:
    return next((s for s in campaign.streams if s.schema == schema), None)


async def update_campaign(
    session: AsyncSession, kt: KeitaroClient, campaign: Campaign, data: CampaignUpdate
) -> Campaign:
    if data.name is not None and data.name != campaign.name:
        await kt.update_campaign(campaign.kt_campaign_id, {"name": data.name})
        campaign.name = data.name
        await session.commit()

    if data.country_code is not None and data.country_code != campaign.country_code:
        geo = _find_stream(campaign, "redirect")
        if geo is not None:
            await kt.update_stream(geo.kt_stream_id, geo_filter_update(data.country_code))
        campaign.country_code = data.country_code
        await session.commit()

    if data.offer_id is not None and data.offer_id != campaign.offer_id:
        await _replace_primary_offer(session, kt, campaign, data.offer_id)

    return await reload_campaign(session, campaign.id)


async def _replace_primary_offer(
    session: AsyncSession, kt: KeitaroClient, campaign: Campaign, new_offer_id: int
) -> None:
    """The new offer takes the place (and share) of the previous primary offer in Flow 2."""
    await sync_streams(session, kt, campaign)
    stream = _find_stream(campaign, "landings")
    if stream is not None:
        items = [
            StreamOfferIn(
                offer_id=o.offer_id, share=o.share, pinned=o.pinned, is_active=o.is_active
            )
            for o in stream.offers
        ]
        new = next((i for i in items if i.offer_id == new_offer_id), None)
        old = next((i for i in items if i.offer_id == campaign.offer_id and i.is_active), None)
        if new is None:
            new = StreamOfferIn(offer_id=new_offer_id, share=0, is_active=False)
            items.append(new)
        if old is not None and not new.is_active:
            # swap: the new offer inherits share and pin of the old one
            new.is_active, new.share, new.pinned = True, old.share, old.pinned
            old.is_active, old.share, old.pinned = False, 0, False
        else:
            if old is not None:
                old.is_active, old.share, old.pinned = False, 0, False
            new.is_active = True
            items = distribute_shares(items)
        await push_stream_offers(session, kt, stream, items)

    campaign.offer_id = new_offer_id
    await session.commit()


async def delete_campaign(session: AsyncSession, kt: KeitaroClient, campaign: Campaign) -> None:
    try:
        await kt.delete_campaign(campaign.kt_campaign_id)
    except KeitaroNotFoundError:
        logger.info("Campaign %s is already absent in Keitaro", campaign.kt_campaign_id)
    await session.delete(campaign)
    await session.commit()
