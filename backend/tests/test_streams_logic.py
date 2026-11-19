import pytest
from pydantic import ValidationError

from app.models import Campaign, Stream, StreamOffer
from app.schemas import PushOffersIn, StreamOfferIn
from app.services.streams import distribute_shares, merge_stream_offers, merge_streams
from tests.conftest import kt_stream


def make_stream(*offers: StreamOffer) -> Stream:
    return Stream(
        kt_stream_id=11, name="Offers", position=2, schema="landings", offers=list(offers)
    )


def offer(offer_id: int, share: int, *, pinned: bool = False, active: bool = True) -> StreamOffer:
    return StreamOffer(
        offer_id=offer_id, share=share, pinned=pinned, is_active=active, sort_order=offer_id
    )


class TestMergeStreamOffers:
    def test_offer_removed_in_keitaro_stays_inactive(self) -> None:
        stream = make_stream(offer(1, 50, pinned=True), offer(2, 50))
        merge_stream_offers(stream, [{"offer_id": 2, "share": 100, "state": "active"}], {})

        removed, kept = stream.offers
        assert (removed.offer_id, removed.is_active, removed.share, removed.pinned) == (
            1,
            False,
            0,
            False,
        )
        assert (kept.offer_id, kept.is_active, kept.share) == (2, True, 100)

    def test_keeps_pinned_flag_and_appends_new_offers(self) -> None:
        stream = make_stream(offer(1, 70, pinned=True))
        merge_stream_offers(
            stream,
            [
                {"offer_id": 1, "share": 60, "state": "active"},
                {"offer_id": 5, "share": 40, "state": "active"},
            ],
            {5: "Fifth"},
        )
        assert [(o.offer_id, o.share, o.pinned) for o in stream.offers] == [
            (1, 60, True),
            (5, 40, False),
        ]
        assert stream.offers[1].offer_name == "Fifth"
        assert stream.offers[1].sort_order > stream.offers[0].sort_order

    def test_previously_removed_offer_returns_when_back_in_keitaro(self) -> None:
        stream = make_stream(offer(1, 0, active=False))
        merge_stream_offers(stream, [{"offer_id": 1, "share": 100, "state": "active"}], {})
        assert stream.offers[0].is_active
        assert stream.offers[0].share == 100

    def test_disabled_offer_in_keitaro_is_inactive(self) -> None:
        stream = make_stream(offer(1, 100))
        merge_stream_offers(stream, [{"offer_id": 1, "share": 100, "state": "disabled"}], {})
        assert not stream.offers[0].is_active
        assert stream.offers[0].share == 0


def test_merge_streams_upserts_and_removes() -> None:
    campaign = Campaign(streams=[make_stream(offer(1, 100)), Stream(kt_stream_id=99, offers=[])])
    merge_streams(
        campaign,
        [
            kt_stream(11, 2, "landings", [(2, 100)]),
            kt_stream(10, 1, "redirect", countries=["DE"]),
        ],
        {},
    )
    assert [s.kt_stream_id for s in campaign.streams] == [10, 11]
    geo, offers = campaign.streams
    assert geo.countries == ["DE"]
    assert geo.action_payload == "https://google.com"
    assert [(o.offer_id, o.is_active) for o in offers.offers] == [(1, False), (2, True)]


class TestDistributeShares:
    def test_even_split_with_remainder(self) -> None:
        items = [StreamOfferIn(offer_id=i, share=0) for i in (1, 2, 3)]
        assert [o.share for o in distribute_shares(items)] == [34, 33, 33]

    def test_pinned_share_is_kept(self) -> None:
        items = [
            StreamOfferIn(offer_id=1, share=50, pinned=True),
            StreamOfferIn(offer_id=2, share=0),
            StreamOfferIn(offer_id=3, share=0),
            StreamOfferIn(offer_id=4, share=30, is_active=False),
        ]
        assert [o.share for o in distribute_shares(items)] == [50, 25, 25, 0]

    def test_unsatisfiable_pins_are_dropped(self) -> None:
        items = [
            StreamOfferIn(offer_id=1, share=30, pinned=True),
            StreamOfferIn(offer_id=2, share=30, pinned=True),
        ]
        result = distribute_shares(items)
        assert [o.share for o in result] == [50, 50]
        assert not any(o.pinned for o in result)


class TestPushValidation:
    def test_valid(self) -> None:
        PushOffersIn.model_validate(
            {
                "offers": [
                    {"offer_id": 1, "share": 60, "pinned": True},
                    {"offer_id": 2, "share": 40},
                    {"offer_id": 3, "share": 0, "is_active": False},
                ]
            }
        )

    def test_empty_stream_is_allowed(self) -> None:
        PushOffersIn.model_validate({"offers": [{"offer_id": 1, "share": 0, "is_active": False}]})

    @pytest.mark.parametrize(
        ("offers", "message"),
        [
            ([{"offer_id": 1, "share": 60}, {"offer_id": 2, "share": 30}], "sum to 100"),
            ([{"offer_id": 1, "share": 100}, {"offer_id": 1, "share": 0}], "unique"),
            (
                [{"offer_id": 1, "share": 100}, {"offer_id": 2, "share": 5, "is_active": False}],
                "0% share",
            ),
            ([{"offer_id": 1, "share": 101}], "less than or equal"),
        ],
    )
    def test_invalid(self, offers: list[dict[str, object]], message: str) -> None:
        with pytest.raises(ValidationError, match=message):
            PushOffersIn.model_validate({"offers": offers})
