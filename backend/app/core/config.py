from pathlib import Path
from dotenv import load_dotenv
from urllib.parse import quote_plus
from pydantic_settings import BaseSettings

load_dotenv(Path(__file__).parent.parent.parent / '.env')


class Settings(BaseSettings):
    DB_USER: str
    DB_PASSWORD: str
    DB_HOST: str
    DB_PORT: int
    DB_NAME: str
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://localhost:3003",
        "http://localhost:3004",
        "http://localhost:3005",
        "http://localhost:3006",
        "http://localhost:3007",
        "http://localhost:3008",
        "http://localhost:3009",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:3002",
        "http://127.0.0.1:3003",
        "http://127.0.0.1:3004",
        "http://127.0.0.1:3005",
        "http://127.0.0.1:3006",
        "http://127.0.0.1:3007",
        "http://127.0.0.1:3008",
        "http://127.0.0.1:3009",
    ]

    @property
    def DATABASE_URL(self) -> str:
        return f"postgresql+psycopg2://{quote_plus(self.DB_USER)}:{quote_plus(self.DB_PASSWORD)}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"


settings = Settings()
