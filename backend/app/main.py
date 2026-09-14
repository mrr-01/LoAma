# backend/app/main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
import os
from app.api.routes import documents


# Set up logging
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO")
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Ollama Web UI",
    description="Local Ollama chat interface with history",
    version="0.1.0"
)

# Allow frontend to make requests (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict this to your domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
from app.api.routes import chat, conversations, documents
app.include_router(chat.router)
app.include_router(conversations.router)
app.include_router(documents.router)

# Health check endpoint
@app.get("/health")
async def health():
    """Check if API is running"""
    return {"status": "ok"}

# Initialize database on startup
@app.on_event("startup")
async def startup():
    logger.info("Starting Ollama Web UI...")
    from app.database import engine, Base
    Base.metadata.create_all(bind=engine)
    logger.info("Database initialized")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
