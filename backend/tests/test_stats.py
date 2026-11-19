from app.services.stats import aggregate_report

DAYS = ["2026-11-18", "2026-11-19"]


def test_aggregate_report_groups_by_stream_and_offer() -> None:
    rows = [
        {"stream_id": 0, "offer_id": 0, "day": "2026-11-19", "clicks": 99},
        {"stream_id": 10, "offer_id": 0, "day": "2026-11-18", "clicks": 3},
        {
            "stream_id": 11,
            "offer_id": 1,
            "day": "2026-11-18",
            "clicks": 2,
            "conversions": 1,
            "revenue": 1.5,
        },
        {"stream_id": 11, "offer_id": 1, "day": "2026-11-19", "clicks": 4, "revenue": 2.25},
        {"stream_id": 11, "offer_id": 2, "day": "2026-11-19", "clicks": 1},
    ]
    result = aggregate_report(rows, DAYS)

    assert set(result) == {10, 11}  # unmatched clicks (stream 0) are skipped
    assert result[10].total.daily_clicks == [3, 0]
    assert result[10].offers == {}
    offer1 = result[11].offers[1]
    assert (offer1.clicks, offer1.conversions, offer1.revenue) == (6, 1, 3.75)
    assert offer1.daily_clicks == [2, 4]
    assert result[11].total.clicks == 7
