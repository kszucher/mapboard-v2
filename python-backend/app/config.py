from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="GRAPHBOARD_", extra="ignore")

    database_url: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/graphboard",
        description="Async SQLAlchemy connection string",
    )
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:5173"])


settings = Settings()

