from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from ..core.config import settings

# Create the SQLAlchemy engine using the database URL from settings
engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)

# Create a sessionmaker instance
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)