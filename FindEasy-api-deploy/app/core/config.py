
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Must be supplied through the environment or .env file.
    DATABASE_URL: str

    UPLOAD_DIR: str = "uploads"
    PUBLIC_BASE_URL: str = "http://localhost:8000"
    MAX_IMAGE_SIZE_MB: int = 10

    # Authentication
    JWT_SECRET_KEY: str = ""
    OTP_SECRET_SALT: str = ""
    ENVIRONMENT: str = "production"
    PHONE_OTP_ENABLED: bool = False
    TWOFACTOR_API_KEY: str = ""
    AUTH_TOKEN_EXPIRE_MINUTES: int = 60

    CORS_ORIGINS: str = "http://localhost:8081,http://localhost:19006"

    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_TIMEOUT_SECONDS: int = 30
    DB_CONNECT_TIMEOUT_SECONDS: int = 10

    def cors_origins(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.CORS_ORIGINS.split(",")
            if origin.strip()
        ]

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )


settings = Settings()
