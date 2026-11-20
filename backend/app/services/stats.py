"""Per-stream / per-offer statistics from Keitaro reports."""

from datetime import UTC, datetime, timedelta
from typing import Any

from app.keitaro import KeitaroClient
from app.models import Campaign
from app.schemas import CampaignStats, Metrics, StreamStats


def _empty(days: int) -> Metrics:
    return Metrics(daily_clicks=[0] * days)


def _add(metrics: Metrics, row: dict[str, Any], day_index: int | None) -> None:
    clicks = int(row.get("clicks") or 0)
    metrics.clicks += clicks
    metrics.conversions += int(row.get("conversions") or 0)
    metrics.revenue = round(metrics.revenue + float(row.get("revenue") or 0), 2)
    if day_index is not None:
        metrics.daily_clicks[day_index] += clicks


def aggregate_report(rows: list[dict[str, Any]], day_list: list[str]) -> dict[int, StreamStats]:
    index = {d: i for i, d in enumerate(day_list)}
    streams: dict[int, StreamStats] = {}
    for row in rows:
        stream_id = int(row.get("stream_id") or 0)
        if not stream_id:
            continue  # clicks that did not match any stream
        offer_id = int(row.get("offer_id") or 0)
        day_index = index.get(str(row.get("day")))
        stats = streams.setdefault(stream_id, StreamStats(total=_empty(len(day_list)), offers={}))
        _add(stats.total, row, day_index)
        if offer_id:
            _add(stats.offers.setdefault(offer_id, _empty(len(day_list))), row, day_index)
    return streams


async def campaign_stats(kt: KeitaroClient, campaign: Campaign, days: int) -> CampaignStats:
    today = datetime.now(UTC).date()
    day_list = [(today - timedelta(days=days - 1 - i)).isoformat() for i in range(days)]
    report = await kt.build_report(
        {
            "range": {"from": day_list[0], "to": day_list[-1], "timezone": "UTC"},
            "dimensions": ["stream_id", "offer_id", "day"],
            "measures": ["clicks", "conversions", "revenue"],
            "filters": [
                {"name": "campaign_id", "operator": "EQUALS", "expression": campaign.kt_campaign_id}
            ],
        }
    )
    rows = report.get("rows") or []
    return CampaignStats(days=day_list, streams=aggregate_report(rows, day_list))
