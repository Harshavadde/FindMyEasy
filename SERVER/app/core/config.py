from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./findmyeasy.db"

    UPLOAD_DIR: str = "uploads"

    MAX_IMAGE_SIZE_MB: int = 10

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )


settings = Settings()