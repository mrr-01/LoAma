from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.chat_service import ChatService
from app.services.ollama_service import OllamaService, OllamaConnectionError
from app.schemas.chat import ChatRequest, ChatResponse
import logging
import httpx

logger = logging.getLogger(__name__)

# Router prefix is set to /api
router = APIRouter(prefix="/api", tags=["chat"])

@router.get("/models")
async def get_available_models():
    """Fetches locally installed models directly from Ollama."""
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            # Connect to local Ollama instance (127.0.0.1 prevents IPv6 resolution delays)
            res = await client.get("http://127.0.0.1:11434/api/tags")
            if res.status_code == 200:
                data = res.json()
                models = [model["name"] for model in data.get("models", [])]
                if models:
                    return {"models": models}
    except Exception as e:
        logger.error(f"Failed to fetch Ollama models: {e}")

    # Fallback default if Ollama endpoint isn't reached
    return {"models": ["gemma3-1b:latest"]}

@router.post("/chat", response_model=ChatResponse)
async def send_message(
    request: ChatRequest,
    db: Session = Depends(get_db)
):
    try:
        ollama_service = OllamaService()
        chat_service = ChatService(db, ollama_service)

        # Handle existing vs new conversation creation
        if not request.conversation_id:
            conv = chat_service.create_conversation(model=request.model)
            conversation_id = conv.id
        else:
            conversation_id = request.conversation_id

        # Process message and generate response using the selected model
        result = chat_service.process_user_message(
            conversation_id=conversation_id,
            message_content=request.message,
            model_name=request.model  # Forward selected model
        )

        logger.info(f"Successfully processed message in {conversation_id} using model {request.model}")
        return result

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except OllamaConnectionError as e:
        logger.error(f"Ollama integration error: {e}")
        raise HTTPException(status_code=503, detail="Ollama service unavailable or model missing")
    except Exception as e:
        logger.error(f"Unhandled error in chat route: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
