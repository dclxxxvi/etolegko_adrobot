from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=("../.env", ".env"), extra="ignore")

    keitaro_url: str = "https://tlgk.host/admin"
    keitaro_api_key: str = ""
    keitaro_domain_id: int = 1813
    keitaro_group_id: int = 10332
    keitaro_traffic_source_id: int = 836
    keitaro_timeout: float = 15.0
    keitaro_offers_cache_ttl: float = 60.0

    database_url: str = "postgresql+asyncpg://keitaro:keitaro@localhost:5432/keitaro"
    cors_origins: list[str] = ["http://localhost:5173"]

    @property
    def keitaro_api_url(self) -> str:
        # https://host/admin -> https://host/admin_api/v1
        return self.keitaro_url.rstrip("/") + "_api/v1"
