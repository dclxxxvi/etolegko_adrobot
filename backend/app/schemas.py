from datetime import datetime
from typing import Annotated

import pycountry
from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    model_validator,
)


def _validate_country(value: str) -> str:
    code = value.upper()
    if pycountry.countries.get(alpha_2=code) is None:
        raise ValueError(f"Unknown country code: {value}")
    return code


CountryCode = Annotated[
    str, StringConstraints(min_length=2, max_length=2), AfterValidator(_validate_country)
]
CampaignName = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)
]
OfferId = Annotated[int, Field(gt=0)]


class CampaignCreate(BaseModel):
    name: CampaignName
    country_code: CountryCode
    offer_id: OfferId


class CampaignUpdate(BaseModel):
    name: CampaignName | None = None
    country_code: CountryCode | None = None
    offer_id: OfferId | None = None


class CampaignOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    country_code: str
    offer_id: int
    offer_name: str | None = None
    kt_campaign_id: int
    kt_alias: str
    created_at: datetime
    updated_at: datetime


class CampaignList(BaseModel):
    items: list[CampaignOut]
    total: int


class StreamOfferOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    offer_id: int
    offer_name: str | None
    share: int
    pinned: bool
    is_active: bool


class StreamOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    kt_stream_id: int
    name: str
    position: int
    schema_type: str = Field(validation_alias="schema")
    action_payload: str | None
    countries: list[str]
    offers: list[StreamOfferOut]


class StreamOfferIn(BaseModel):
    offer_id: OfferId
    share: int = Field(ge=0, le=100)
    pinned: bool = False
    is_active: bool = True


class PushOffersIn(BaseModel):
    offers: list[StreamOfferIn]

    @model_validator(mode="after")
    def check_shares(self) -> "PushOffersIn":
        ids = [o.offer_id for o in self.offers]
        if len(ids) != len(set(ids)):
            raise ValueError("Offers must be unique within a stream")
        for o in self.offers:
            if not o.is_active and o.share != 0:
                raise ValueError(f"Removed offer #{o.offer_id} must have 0% share")
        active = [o for o in self.offers if o.is_active]
        total = sum(o.share for o in active)
        if active and total != 100:
            raise ValueError(f"Shares of active offers must sum to 100%, got {total}%")
        return self


class OfferOut(BaseModel):
    id: int
    name: str


class MetaOut(BaseModel):
    keitaro_url: str


class Metrics(BaseModel):
    clicks: int = 0
    conversions: int = 0
    revenue: float = 0.0
    daily_clicks: list[int]


class StreamStats(BaseModel):
    total: Metrics
    offers: dict[int, Metrics]


class CampaignStats(BaseModel):
    days: list[str]
    streams: dict[int, StreamStats]
