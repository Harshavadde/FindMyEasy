from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./findeasy.db"

    UPLOAD_DIR: str = "uploads"

    PUBLIC_BASE_URL: str = "http://192.168.0.10:8000"

    MAX_IMAGE_SIZE_MB: int = 10

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )


settings = Settings()