from pathlib import Path
from urllib.parse import quote_plus
from pydantic_settings import BaseSettings

_env_file = Path(__file__).parent.parent.parent / '.env'
if _env_file.exists():
    from dotenv import load_dotenv
    load_dotenv(_env_file)


class Settings(BaseSettings):
    DB_HOST: str              # ECS: !GetAtt Database.Endpoint.Address
    DB_PORT: int = 5432       # ECS: !GetAtt Database.Endpoint.Port
    DB_NAME: str = "postgres" # ECS: literal 'postgres'
    DB_USER: str              # ECS: !Ref DBUsername → 'appuser'
    DB_PASSWORD: str          # ECS: Secrets Manager → DB_PASSWORD
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    @property
    def DATABASE_URL(self) -> str:
        return f"postgresql+psycopg2://{quote_plus(self.DB_USER)}:{quote_plus(self.DB_PASSWORD)}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"


settings = Settings()
