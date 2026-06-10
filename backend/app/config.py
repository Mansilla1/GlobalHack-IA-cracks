from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    anthropic_api_key: str = ""
    github_token: str = ""
    github_repo: str = ""
    database_url: str = "sqlite+aiosqlite:///./sentinel.db"


settings = Settings()
