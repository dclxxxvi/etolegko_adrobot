"""Keitaro streams: payload builders, merge (sync) and push logic."""

from collections.abc import Sequence
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.keitaro import KeitaroClient
from app.models import Campaign, Stream, StreamOffer, utcnow
from app.schemas import StreamOfferIn

GOOGLE_URL = "https://google.com"
OFFERS_STREAM_NAME = "Offers"


def geo_stream_name(country_code: str) -> str:
    return f"Geo {country_code} -> Google"


def geo_stream_payload(kt_campaign_id: int, country_code: str) -> dict[str, Any]:
    """Flow 1: visitors from the country are redirected to Google."""
    return {
        "campaign_id": kt_campaign_id,
        "type": "regular",
        "name": geo_stream_name(country_code),
        "position": 1,
        "state": "active",
        "action_type": "http",
        "schema": "redirect",
        "action_payload": GOOGLE_URL,
        "filters": [{"name": "country", "mode": "accept", "payload": [country_code]}],
    }


def geo_filter_update(country_code: str) -> dict[str, Any]:
    return {
        "name": geo_stream_name(country_code),
        "filters": [{"name": "country", "mode": "accept", "payload": [country_code]}],
    }


def offers_stream_payload(kt_campaign_id: int, offer_id: int) -> dict[str, Any]:
    """Flow 2: the rest of the traffic goes to offers."""
    return {
        "campaign_id": kt_campaign_id,
        "type": "regular",
        "name": OFFERS_STREAM_NAME,
        "position": 2,
        "state": "active",
        "action_type": "http",
        "schema": "landings",
        "offers": [{"offer_id": offer_id, "share": 100, "state": "active"}],
    }


def offers_payload(items: Sequence[StreamOfferIn]) -> dict[str, Any]:
    return {
        "offers": [
            {"offer_id": o.offer_id, "share": o.share, "state": "active"}
            for o in items
            if o.is_active
        ]
    }


def distribute_shares(items: list[StreamOfferIn]) -> list[StreamOfferIn]:
    """Same algorithm as the frontend: pinned shares are kept, the rest is split evenly."""
    result = [
        o.model_copy(update={"share": 0, "pinned": False}) if not o.is_active else o.model_copy()
        for o in items
    ]
    active = [o for o in result if o.is_active]
    free = [o for o in active if not o.pinned]
    pinned_sum = sum(o.share for o in active if o.pinned)
    if active and (pinned_sum > 100 or (not free and pinned_sum != 100)):
        # pins cannot be satisfied: drop them and split evenly
        for o in active:
            o.pinned = False
        free, pinned_sum = active, 0
    if not free:
        return result
    rest = max(0, 100 - pinned_sum)
    base, remainder = divmod(rest, len(free))
    for i, o in enumerate(free):
        o.share = base + (1 if i < remainder else 0)
    return result


def _countries(kt_stream: dict[str, Any]) -> list[str]:
    for f in kt_stream.get("filters") or []:
        if f.get("name") == "country" and isinstance(f.get("payload"), list):
            return [str(c) for c in f["payload"]]
    return []


def merge_stream_offers(
    stream: Stream, kt_offers: list[dict[str, Any]], offer_names: dict[int, str]
) -> None:
    """Apply offers from Keitaro to the local stream.

    Offers missing in Keitaro are not deleted: they become inactive with 0% share,
    so the user can bring them back.
    """
    by_id = {o.offer_id: o for o in stream.offers}
    next_order = max((o.sort_order for o in stream.offers), default=-1) + 1
    seen: set[int] = set()

    for kt_offer in kt_offers:
        offer_id = int(kt_offer["offer_id"])
        seen.add(offer_id)
        local = by_id.get(offer_id)
        if local is None:
            local = StreamOffer(offer_id=offer_id, pinned=False, sort_order=next_order)
            next_order += 1
            stream.offers.append(local)
            by_id[offer_id] = local
        local.share = int(kt_offer.get("share") or 0)
        local.is_active = kt_offer.get("state", "active") == "active"
        if not local.is_active:
            local.share = 0
            local.pinned = False

    for local in stream.offers:
        if local.offer_id not in seen:
            local.is_active = False
            local.share = 0
            local.pinned = False
        if local.offer_id in offer_names:
            local.offer_name = offer_names[local.offer_id]


def apply_kt_stream(stream: Stream, kt_stream: dict[str, Any], offer_names: dict[int, str]) -> None:
    stream.kt_stream_id = int(kt_stream["id"])
    stream.name = str(kt_stream.get("name") or "")
    stream.position = int(kt_stream.get("position") or 0)
    stream.schema = str(kt_stream.get("schema") or "")
    stream.action_payload = kt_stream.get("action_payload") or None
    stream.countries = _countries(kt_stream)
    stream.synced_at = utcnow()
    merge_stream_offers(stream, kt_stream.get("offers") or [], offer_names)


def merge_streams(
    campaign: Campaign, kt_streams: list[dict[str, Any]], offer_names: dict[int, str]
) -> None:
    """Upsert streams by Keitaro ID; streams deleted in Keitaro are removed locally."""
    by_kt_id = {s.kt_stream_id: s for s in campaign.streams}
    kt_ids = {int(s["id"]) for s in kt_streams}
    for existing in list(campaign.streams):
        if existing.kt_stream_id not in kt_ids:
            campaign.streams.remove(existing)
    for kt_stream in kt_streams:
        stream = by_kt_id.get(int(kt_stream["id"]))
        if stream is None:
            stream = Stream(offers=[], countries=[])
            campaign.streams.append(stream)
        apply_kt_stream(stream, kt_stream, offer_names)
    campaign.streams.sort(key=lambda s: s.position)


async def sync_streams(session: AsyncSession, kt: KeitaroClient, campaign: Campaign) -> None:
    kt_streams = await kt.get_campaign_streams(campaign.kt_campaign_id)
    merge_streams(campaign, kt_streams, await kt.offer_names())
    await session.commit()


async def push_stream_offers(
    session: AsyncSession, kt: KeitaroClient, stream: Stream, items: Sequence[StreamOfferIn]
) -> None:
    """Send the draft to Keitaro and store the result (including removed offers) locally."""
    kt_stream = await kt.update_stream(stream.kt_stream_id, offers_payload(items))

    by_id = {o.offer_id: o for o in stream.offers}
    next_order = max((o.sort_order for o in stream.offers), default=-1) + 1
    for item in items:
        local = by_id.get(item.offer_id)
        if local is None:
            local = StreamOffer(offer_id=item.offer_id, sort_order=next_order)
            next_order += 1
            stream.offers.append(local)
        local.pinned = item.pinned and item.is_active

    apply_kt_stream(stream, kt_stream, await kt.offer_names())
    await session.commit()
