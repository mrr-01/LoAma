from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from typing import Generator
from fastapi import Depends
import os

#Read database URL from environment
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./chat_history.db")

#Create engine
# echo=True: logs all SQL (helpful for debugging)
# connect_args: SQLite-specific setting
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
    echo=os.getenv("DEBUG", False) == True
)

# SessionLocal: factory for creating database sessions
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base: parent class for all database models
Base = declarative_base()

# Dependency for FastAPI
def get_db() -> Generator:
    """
    Dependency injection for database session.
    FastAPI calls this automatically when a routes needs 'db'.
    """
    db = SessionLocal()
    try:
        yield db # Route uses the session
    finally:
        db.close() # Cleanup after route finishes
