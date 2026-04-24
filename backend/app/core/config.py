import os
from dotenv import load_dotenv
from urllib.parse import quote_plus
from pydantic_settings import BaseSettings

# load the environment variables from  .env file
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

class Settings(BaseSettings):
    """
    Pydantic model for application settings.
    It automatically reads environment variables.
    """
    DB_USER: str
    DB_PASSWORD: str
    DB_HOST: str
    DB_PORT: int
    DB_NAME: str

    @property
    def DATABASE_URL(self) -> str:
        return f"postgresql+psycopg2://{quote_plus(self.DB_USER)}:{quote_plus(self.DB_PASSWORD)}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"


# Create a single, reusable instance of the settings
settings = Settings()