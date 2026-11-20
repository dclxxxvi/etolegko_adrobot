import json
from typing import Any

import httpx
import respx

from tests.conftest import kt_stream

CAMPAIGN = {"name": "Test campaign", "country_code": "de", "offer_id": 1}


def mock_create(kt: respx.MockRouter, campaign_id: int = 100) -> None:
    kt.post("/campaigns").respond(json={"id": campaign_id, "alias": "abc"})
    kt.post("/streams").mock(
        side_effect=[
            httpx.Response(200, json=kt_stream(10, 1, "redirect", countries=["DE"])),
            httpx.Response(200, json=kt_stream(11, 2, "landings", [(1, 100)])),
        ]
    )


async def create(client: httpx.AsyncClient, kt: respx.MockRouter, **data: Any) -> dict[str, Any]:
    mock_create(kt)
    response = await client.post("/api/campaigns", json={**CAMPAIGN, **data})
    assert response.status_code == 201, response.text
    result: dict[str, Any] = response.json()
    return result


async def streams(client: httpx.AsyncClient, campaign_id: int) -> list[dict[str, Any]]:
    response = await client.get(f"/api/campaigns/{campaign_id}/streams")
    assert response.status_code == 200
    result: list[dict[str, Any]] = response.json()
    return result


class TestCampaigns:
    async def test_create_builds_two_streams_in_keitaro(
        self, client: httpx.AsyncClient, kt: respx.MockRouter
    ) -> None:
        campaign = await create(client, kt)

        assert campaign["country_code"] == "DE"
        assert campaign["kt_campaign_id"] == 100
        assert campaign["offer_name"] == "Offer One"
        geo_req, offers_req = [
            json.loads(c.request.content)
            for c in kt.calls
            if c.request.url.path.endswith("/streams")
        ]
        assert geo_req["filters"] == [{"name": "country", "mode": "accept", "payload": ["DE"]}]
        assert geo_req["action_payload"] == "https://google.com"
        assert offers_req["offers"] == [{"offer_id": 1, "share": 100, "state": "active"}]

        geo, offers = await streams(client, campaign["id"])
        assert geo["schema_type"] == "redirect"
        assert offers["offers"][0] | {"offer_name": None} == {
            "offer_id": 1,
            "offer_name": None,
            "share": 100,
            "pinned": False,
            "is_active": True,
        }

    async def test_create_rolls_back_keitaro_campaign_on_stream_error(
        self, client: httpx.AsyncClient, kt: respx.MockRouter
    ) -> None:
        kt.post("/campaigns").respond(json={"id": 100, "alias": "abc"})
        kt.post("/streams").respond(422, json={"offers": ["Offer not found"]})
        delete = kt.delete("/campaigns/100").respond(json=[])

        response = await client.post("/api/campaigns", json=CAMPAIGN)

        assert response.status_code == 502
        assert "Offer not found" in response.json()["detail"]
        assert delete.called
        assert (await client.get("/api/campaigns")).json()["total"] == 0

    async def test_keitaro_unavailable_returns_503(
        self, client: httpx.AsyncClient, kt: respx.MockRouter
    ) -> None:
        kt.post("/campaigns").mock(side_effect=httpx.ConnectTimeout("timeout"))
        response = await client.post("/api/campaigns", json=CAMPAIGN)
        assert response.status_code == 503

    async def test_validation(self, client: httpx.AsyncClient) -> None:
        response = await client.post(
            "/api/campaigns", json={"name": " ", "country_code": "XX", "offer_id": 0}
        )
        assert response.status_code == 422
        assert {e["loc"][-1] for e in response.json()["detail"]} == {
            "name",
            "country_code",
            "offer_id",
        }

    async def test_search_by_name(self, client: httpx.AsyncClient, kt: respx.MockRouter) -> None:
        await create(client, kt, name="Alpha DE")
        mock_create(kt, campaign_id=200)
        kt.post("/streams").mock(
            side_effect=[
                httpx.Response(200, json=kt_stream(20, 1, "redirect", campaign_id=200)),
                httpx.Response(200, json=kt_stream(21, 2, "landings", campaign_id=200)),
            ]
        )
        await client.post("/api/campaigns", json={**CAMPAIGN, "name": "Beta 100%"})

        found = (await client.get("/api/campaigns", params={"q": "alpha"})).json()
        assert [c["name"] for c in found["items"]] == ["Alpha DE"]
        assert found["total"] == 1
        found = (await client.get("/api/campaigns", params={"q": "100%"})).json()
        assert [c["name"] for c in found["items"]] == ["Beta 100%"]
        assert (await client.get("/api/campaigns")).json()["total"] == 2

    async def test_update_name_and_country(
        self, client: httpx.AsyncClient, kt: respx.MockRouter
    ) -> None:
        campaign = await create(client, kt)
        rename = kt.put("/campaigns/100").respond(json={})
        geo = kt.put("/streams/10").respond(json={})

        response = await client.patch(
            f"/api/campaigns/{campaign['id']}", json={"name": "New", "country_code": "FR"}
        )

        assert response.status_code == 200
        assert response.json()["name"] == "New"
        assert json.loads(rename.calls.last.request.content) == {"name": "New"}
        assert json.loads(geo.calls.last.request.content)["filters"][0]["payload"] == ["FR"]

    async def test_update_offer_replaces_primary_offer(
        self, client: httpx.AsyncClient, kt: respx.MockRouter
    ) -> None:
        campaign = await create(client, kt)
        kt.get("/campaigns/100/streams").respond(
            json=[kt_stream(10, 1, "redirect"), kt_stream(11, 2, "landings", [(1, 100)])]
        )
        push = kt.put("/streams/11").respond(json=kt_stream(11, 2, "landings", [(2, 100)]))

        response = await client.patch(f"/api/campaigns/{campaign['id']}", json={"offer_id": 2})

        assert response.status_code == 200
        assert response.json()["offer_id"] == 2
        assert json.loads(push.calls.last.request.content) == {
            "offers": [{"offer_id": 2, "share": 100, "state": "active"}]
        }
        offers = (await streams(client, campaign["id"]))[1]["offers"]
        assert [(o["offer_id"], o["is_active"]) for o in offers] == [(1, False), (2, True)]

    async def test_delete_when_already_deleted_in_keitaro(
        self, client: httpx.AsyncClient, kt: respx.MockRouter
    ) -> None:
        campaign = await create(client, kt)
        kt.delete("/campaigns/100").respond(404, text="<html>Not found</html>")

        assert (await client.delete(f"/api/campaigns/{campaign['id']}")).status_code == 204
        assert (await client.get(f"/api/campaigns/{campaign['id']}")).status_code == 404


class TestStreams:
    async def test_push_keeps_removed_offers(
        self, client: httpx.AsyncClient, kt: respx.MockRouter
    ) -> None:
        campaign = await create(client, kt)
        stream = (await streams(client, campaign["id"]))[1]
        push = kt.put("/streams/11").respond(json=kt_stream(11, 2, "landings", [(2, 100)]))

        response = await client.put(
            f"/api/campaigns/{campaign['id']}/streams/{stream['id']}/offers",
            json={
                "offers": [
                    {"offer_id": 1, "share": 0, "is_active": False},
                    {"offer_id": 2, "share": 100, "pinned": True},
                ]
            },
        )

        assert response.status_code == 200, response.text
        assert json.loads(push.calls.last.request.content) == {
            "offers": [{"offer_id": 2, "share": 100, "state": "active"}]
        }
        offers = response.json()["offers"]
        assert [(o["offer_id"], o["share"], o["pinned"], o["is_active"]) for o in offers] == [
            (1, 0, False, False),
            (2, 100, True, True),
        ]
        assert offers[1]["offer_name"] == "Offer Two"

    async def test_push_validation_error(
        self, client: httpx.AsyncClient, kt: respx.MockRouter
    ) -> None:
        campaign = await create(client, kt)
        stream = (await streams(client, campaign["id"]))[1]
        push = kt.put("/streams/11")

        response = await client.put(
            f"/api/campaigns/{campaign['id']}/streams/{stream['id']}/offers",
            json={"offers": [{"offer_id": 1, "share": 90}]},
        )

        assert response.status_code == 422
        assert not push.called

    async def test_push_to_redirect_stream_is_rejected(
        self, client: httpx.AsyncClient, kt: respx.MockRouter
    ) -> None:
        campaign = await create(client, kt)
        geo = (await streams(client, campaign["id"]))[0]
        response = await client.put(
            f"/api/campaigns/{campaign['id']}/streams/{geo['id']}/offers",
            json={"offers": [{"offer_id": 1, "share": 100}]},
        )
        assert response.status_code == 400

    async def test_sync_marks_offers_removed_in_keitaro(
        self, client: httpx.AsyncClient, kt: respx.MockRouter
    ) -> None:
        campaign = await create(client, kt)
        kt.get("/campaigns/100/streams").respond(
            json=[
                kt_stream(10, 1, "redirect", countries=["DE"]),
                kt_stream(11, 2, "landings", [(2, 100)]),
            ]
        )

        response = await client.post(f"/api/campaigns/{campaign['id']}/streams/sync")

        assert response.status_code == 200
        offers = response.json()[1]["offers"]
        assert [(o["offer_id"], o["share"], o["is_active"]) for o in offers] == [
            (1, 0, False),
            (2, 100, True),
        ]

    async def test_stats(self, client: httpx.AsyncClient, kt: respx.MockRouter) -> None:
        campaign = await create(client, kt)
        report = kt.post("/report/build").respond(json={"rows": [], "total": 0})

        response = await client.get(f"/api/campaigns/{campaign['id']}/stats", params={"days": 3})

        assert response.status_code == 200
        assert len(response.json()["days"]) == 3
        body = json.loads(report.calls.last.request.content)
        assert body["filters"][0]["expression"] == 100
