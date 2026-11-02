from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/findeasy"

    UPLOAD_DIR: str = "uploads"

    PUBLIC_BASE_URL: str = "http://localhost:8000"

    MAX_IMAGE_SIZE_MB: int = 10

    # Authentication
    JWT_SECRET_KEY: str = Field(
        default="change-me-before-deployment",
        validation_alias=AliasChoices("JWT_SECRET_KEY", "AUTH_SECRET_KEY"),
    )
    AUTH_TOKEN_EXPIRE_MINUTES: int = 60

    ENVIRONMENT: str = "development"
    PHONE_OTP_ENABLED: bool = False
    OWNER_INVITATION_TTL_HOURS: int = 72
    OWNER_REGISTRATION_BASE_URL: str = "findeasy://owner/register"

    OWNER_EMAIL_SMTP_HOST: str = ""
    OWNER_EMAIL_SMTP_PORT: int = 587
    OWNER_EMAIL_SMTP_USERNAME: str = ""
    OWNER_EMAIL_SMTP_PASSWORD: str = ""
    OWNER_EMAIL_FROM_ADDRESS: str = ""
    OWNER_EMAIL_SMTP_USE_SSL: bool = False

    CORS_ORIGINS: str = "http://localhost:8081,http://localhost:19006"

    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_TIMEOUT_SECONDS: int = 30
    DB_CONNECT_TIMEOUT_SECONDS: int = 10

    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )
settings = Settings()